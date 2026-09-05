import mongoose from "mongoose";

// A warm serverless container is reused across invocations, so the connection
// is cached on globalThis rather than reopened on every request.
const cached = globalThis.__mongooseConnection ?? { conn: null, promise: null };
globalThis.__mongooseConnection = cached;

export const connectdb = async () => {
  if (cached.conn) return cached.conn;

  if (!process.env.MONGO_DB_URI) {
    throw new Error("MONGO_DB_URI is not set");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_DB_URI, {
        serverSelectionTimeoutMS: 10000,
      })
      .then((instance) => {
        console.log("DB SUCCESSFULLY CONNECTED");
        return instance.connection;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Drop the rejected promise so the next request retries instead of
    // replaying the same failure forever.
    cached.promise = null;
    console.log("ERROR IN CONNECTING TO DB", error);
    throw error;
  }

  return cached.conn;
};
