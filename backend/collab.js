import "dotenv/config"; // loads backend/.env into process.env (must come first; on Vercel the dashboard env vars are used)
import jwt from "jsonwebtoken"; // verifies the collab tickets
import * as Y from "yjs"; // the CRDT library
import { Redis as IORedis } from "ioredis"; // Redis client (TCP) for the Redis extension
import { waitUntil } from "@vercel/functions"; // keeps a Vercel instance alive until a promise settles (no-op locally)
import { Server } from "@hocuspocus/server"; // the WebSocket server class
import { Database } from "@hocuspocus/extension-database"; // gives us fetch/store hooks
import { Redis } from "@hocuspocus/extension-redis"; // relays updates between server instances
import { TiptapTransformer } from "@hocuspocus/transformer"; // Yjs doc ↔ Tiptap JSON
import { generateHTML, generateJSON } from "@tiptap/html"; // Tiptap JSON ↔ HTML (Node build is chosen automatically)
import { connectdb } from "./src/config/db.js"; // your existing cached Mongo connection
import Note from "./src/models/note.model.js"; // your Note model (updated in Step 3)
import NoteUpdate from "./src/models/noteUpdate.model.js"; // encrypted update log (E2E notes)
import { sanitizeHtml } from "./src/lib/sanitize.js"; // your existing DOMPurify policy
import { getNoteRole } from "./src/collab/noteAccess.js"; // Step 4 helper
import { editorExtensions } from "./src/collab/extensions.js"; // Step 4 schema

const FIELD = "default";

// Encrypted notes use the document name "enc:<noteId>". On that channel the
// server never touches a Y.Doc: clients send AES-GCM ciphertext as stateless
// messages, and the server only numbers, stores and rebroadcasts them.
const ENC_PREFIX = "enc:";
const isEncChannel = (name) => name.startsWith(ENC_PREFIX);
const MAX_UPDATE_CHARS = 2_000_000; // base64; one pasted image-heavy chunk at most // name of the shared rich-text field inside the Yjs doc (Tiptap's default)

// Vercel sets VERCEL=1. There the platform starts the HTTP server itself from
// the default export at the bottom of this file, so we must not call listen().
const isVercel = Boolean(process.env.VERCEL);

// Saves the CRDT state plus an HTML snapshot of it.
const saveDocument = async ({ documentName, state, document }) => {
  const json = TiptapTransformer.fromYdoc(document, FIELD); // Yjs → Tiptap JSON
  const html = await sanitizeHtml(generateHTML(json, editorExtensions)); // JSON → HTML, then your sanitiser as a safety net
  const title = String(document.getMap("meta").get("title") ?? "").slice(0, 300); // read the shared title, cap its length
  await connectdb(); // ensure DB connection
  await Note.updateOne(
    // this note - unless it was encrypted meanwhile: then the plaintext this
    // instance still holds in memory must never be written back
    { _id: documentName, is_encrypted: { $ne: true } },
    {
      $set: {
        ydoc: state, // the CRDT state (source of truth)
        content: html, // HTML snapshot for the list/search/offline cache
        title, // plain title for the list
        updated_at: new Date(), // so /sync on other devices sees a newer version
        is_collaborative: true, // flag (idempotent)
      },
    },
  ); // mongoose timestamps also bump updatedAt → picked up by /sync
};

const extensions = [
  new Database({
    async fetch({ documentName }) {
      if (isEncChannel(documentName)) return null; // relay only: no server-side doc
      // called when the first person opens a note
      await connectdb(); // ensure DB connection
      const note = await Note.findById(documentName) // load the note
        .select("+ydoc title content"); // "+ydoc" because it's select:false in the schema
      if (!note) return null; // unknown note → start empty (onAuthenticate already blocks this)
      if (note.ydoc) return new Uint8Array(note.ydoc); // already collaborative → hand back the stored Yjs bytes

      // First time this note is opened collaboratively: convert its old HTML into a Yjs doc ("seeding").
      const json = generateJSON(note.content || "<p></p>", editorExtensions); // HTML → Tiptap JSON using our schema
      const ydoc = TiptapTransformer.toYdoc(json, FIELD, editorExtensions); // Tiptap JSON → Yjs doc
      const meta = ydoc.getMap("meta"); // a second shared structure for non-body data
      meta.set("title", note.title || ""); // the title becomes collaborative too
      meta.set("seeded", true); // marker: "this doc came from the server" (used by the client)
      const seed = Buffer.from(Y.encodeStateAsUpdate(ydoc)); // serialise the whole doc to bytes

      // Save the seed immediately, but only if nobody else saved one first.
      // If we didn't save now and the server restarted, a SECOND, different seed would be created,
      // and clients holding the first one would merge both → duplicated text.
      // On Vercel two instances can even seed the same note at the same moment.
      const result = await Note.updateOne(
        { _id: documentName, ydoc: { $exists: false } }, // condition: still no ydoc
        { $set: { ydoc: seed, is_collaborative: true } }, // store bytes + flag
      );
      if (result.modifiedCount === 0) {
        // someone beat us to it...
        const fresh = await Note.findById(documentName).select("+ydoc"); // ...so use theirs
        return fresh?.ydoc ? new Uint8Array(fresh.ydoc) : null;
      }
      return new Uint8Array(seed); // our seed is the official one
    },

    // Called (debounced) after changes. Vercel pauses an instance once its last
    // connection closes, which could freeze a save half-way; waitUntil keeps
    // the instance alive until the save has finished.
    store(data) {
      if (isEncChannel(data.documentName)) return Promise.resolve();
      const saving = saveDocument(data);
      waitUntil(saving);
      return saving;
    },
  }),
];

// Where the Redis extension connects. It needs a lasting TCP connection for
// pub/sub, which the REST API can't provide - but Upstash serves the same
// database over TCP on the same host, and the REST token doubles as the TCP
// password. So the existing UPSTASH_REDIS_REST_* variables are enough.
// REDIS_URL (rediss://...) overrides them, e.g. for a non-Upstash Redis.
const redisConnection = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !token) return null;
  return {
    host: new URL(restUrl).hostname, // https://<name>.upstash.io -> <name>.upstash.io
    port: 6379,
    username: "default",
    password: token,
    tls: {}, // Upstash only accepts TLS connections
  };
};
const redis = redisConnection();

// Two people on the same note can be connected to different Vercel instances,
// each holding its own copy of the note in memory. The Redis extension relays
// every update (and cursor) between instances, and locks saving so only one
// instance writes a note to MongoDB at a time.
if (redis) {
  extensions.push(
    new Redis({
      createClient: () => {
        const client = new IORedis(redis);
        // ioredis reconnects by itself; log one line instead of a stack trace per retry.
        client.on("error", (error) => console.error("Redis error:", error.message));
        return client;
      },
      prefix: "notejs-collab", // keeps these keys apart from the rate-limit keys
    }),
  );
} else if (isVercel) {
  console.warn(
    "No Redis configured (UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL): collaborators on different instances won't see each other's edits live.",
  );
}

const server = new Server({
  // create the server (v4 API: `new Server`, not Server.configure)
  port: Number(process.env.COLLAB_PORT || process.env.PORT || 1234), // local port; Render/Railway inject PORT
  address: "0.0.0.0", // listen on all network interfaces (needed in containers)
  debounce: 2000, // save to Mongo 2s after typing pauses...
  maxDebounce: 10000, // ...but at least every 10s during non-stop typing
  quiet: isVercel, // no startup banner in the Vercel logs
  stopOnSignals: !isVercel, // Vercel manages the process lifecycle itself

  async onAuthenticate({ token, documentName, connectionConfig }) {
    // runs once per connection, before any data is exchanged
    let payload; // will hold the decoded ticket
    try {
      payload = jwt.verify(token, process.env.COLLAB_TOKEN_SECRET); // checks signature + expiry; throws if bad
    } catch {
      throw new Error("Invalid or expired collab token"); // throwing = Hocuspocus refuses the connection
    }
    const encrypted = isEncChannel(documentName);
    const noteId = encrypted ? documentName.slice(ENC_PREFIX.length) : documentName;
    if (payload.noteId !== noteId) {
      // documentName = the note id the browser asked to open
      throw new Error("Token was issued for a different note"); // stops reusing a ticket for note A to open note B
    }

    await connectdb(); // make sure Mongo is connected
    const note = await Note.findById(noteId) // load the note...
      .select("user_id collaborators is_deleted is_encrypted") // ...only the fields needed for the access check
      .lean(); // plain object, faster
    const role = getNoteRole(note, payload.userId); // re-check access NOW (they may have been removed since the ticket was issued)
    if (!role || note.is_deleted) throw new Error("No access"); // no role or deleted note → refuse

    // Each note is on exactly one channel: plaintext notes on "<id>", encrypted
    // ones on "enc:<id>". This also cuts off plaintext editors once a note is encrypted.
    if (encrypted !== !!note.is_encrypted) throw new Error("Wrong channel for this note");

    // Viewers can't edit. On the encrypted channel nobody writes the server's
    // (empty) Y.Doc; edits arrive as stateless messages, checked in onStateless.
    connectionConfig.readOnly = encrypted || role === "viewer";
    return { userId: payload.userId, role, noteId, encrypted }; // becomes the "context" for this connection
  },

  // Stateless messages: the encrypted-note relay, plus "this note just got
  // encrypted / re-keyed" notices. Hocuspocus doesn't await this, so it must
  // never throw.
  async onStateless({ connection, document, payload }) {
    try {
      await handleStateless(connection, document, payload);
    } catch (error) {
      console.error("Stateless message error:", error);
    }
  },

  extensions,
});

const reply = (connection, message) => connection.sendStateless(JSON.stringify(message));

async function handleStateless(connection, document, raw) {
  const ctx = connection.context ?? {};
  if (raw.length > MAX_UPDATE_CHARS + 1000) return;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  const manager = ctx.role === "owner" || ctx.role === "admin";

  // A manager tells everyone on the note to re-read it (encryption was just
  // turned on, or the key was replaced). Carries no data.
  if (msg.t === "encrypted" || msg.t === "rekeyed") {
    if (manager) document.broadcastStateless(JSON.stringify({ t: msg.t }));
    return;
  }

  // { t: "push", cid, v, iv, ct }: one encrypted Yjs update from a client.
  if (msg.t !== "push" || !ctx.encrypted) return;
  const { cid, v, iv, ct } = msg;
  if (ctx.role === "viewer") return reply(connection, { t: "error", cid, message: "read-only" });
  if (
    !Number.isInteger(v) ||
    typeof iv !== "string" || iv.length !== 16 ||
    typeof ct !== "string" || ct.length === 0 || ct.length > MAX_UPDATE_CHARS
  ) {
    return reply(connection, { t: "error", cid, message: "bad update" });
  }

  await connectdb();
  // Next sequence number, only if the client used the current key. The
  // version check and the increment are one atomic step.
  const note = await Note.findOneAndUpdate(
    { _id: ctx.noteId, is_encrypted: true, is_deleted: { $ne: true }, key_version: v },
    { $inc: { enc_seq: 1 } },
    { new: true, projection: { enc_seq: 1 } },
  ).lean();
  if (!note) return reply(connection, { t: "stale", cid }); // key replaced: client reloads keys and re-sends

  const seq = note.enc_seq;
  const saving = NoteUpdate.create({ note: ctx.noteId, seq, v, iv, ct });
  waitUntil(saving);
  await saving;
  // To everyone on the note, sender included (that's the sender's ack).
  // The Redis extension carries it to connections on other instances.
  document.broadcastStateless(JSON.stringify({ t: "u", seq, v, iv, ct, cid }));
}

// Locally (and on any long-running host) we start listening ourselves.
if (!isVercel) server.listen(); // start accepting WebSocket connections

// Vercel needs the HTTP server as the default export to accept WebSockets.
export default server.httpServer;
