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
import { sanitizeHtml } from "./src/lib/sanitize.js"; // your existing DOMPurify policy
import { getNoteRole } from "./src/collab/noteAccess.js"; // Step 4 helper
import { editorExtensions } from "./src/collab/extensions.js"; // Step 4 schema

const FIELD = "default"; // name of the shared rich-text field inside the Yjs doc (Tiptap's default)

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
    { _id: documentName }, // this note
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
    if (payload.noteId !== documentName) {
      // documentName = the note id the browser asked to open
      throw new Error("Token was issued for a different note"); // stops reusing a ticket for note A to open note B
    }

    await connectdb(); // make sure Mongo is connected
    const note = await Note.findById(documentName) // load the note...
      .select("user_id collaborators is_deleted") // ...only the fields needed for the access check
      .lean(); // plain object, faster
    const role = getNoteRole(note, payload.userId); // re-check access NOW (they may have been removed since the ticket was issued)
    if (!role || note.is_deleted) throw new Error("No access"); // no role or deleted note → refuse

    connectionConfig.readOnly = role === "viewer"; // Hocuspocus then silently ignores edits from viewers
    return { userId: payload.userId, role }; // becomes the "context" for this connection
  },

  extensions,
});

// Locally (and on any long-running host) we start listening ourselves.
if (!isVercel) server.listen(); // start accepting WebSocket connections

// Vercel needs the HTTP server as the default export to accept WebSockets.
export default server.httpServer;
