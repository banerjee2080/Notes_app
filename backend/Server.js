import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import notesRoutes from "./src/routes/notes.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import otpRoutes from "./src/routes/otp.routes.js";
import { connectdb } from "./src/config/db.js";
import rateLimiter from "./src/middleware/ratelimiter.middleware.js";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { startCronJobs } from "./src/services/cron.service.js";
import { isProduction, isServerless } from "./src/lib/env.js";

dotenv.config();

// On a serverless runtime a single stray async error tears down the whole
// function and turns every route into FUNCTION_INVOCATION_FAILED. Log it
// loudly and keep serving instead.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

const app = express();
app.set("trust proxy", 1);

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!isProduction) {
  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    }),
  );
}

const PORT = process.env.PORT || 5001;

const MONGO_STATES = [
  "disconnected",
  "connected",
  "connecting",
  "disconnecting",
];

// Reports whether the deployment is configured correctly. Only presence
// booleans are exposed here, never the values themselves.
app.get("/api/health", (req, res) => {
  const required = [
    "MONGO_DB_URI",
    "JWT_SECRET",
    "OTP_TOKEN_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "GOOGLE_CLIENT_ID",
    "RESEND_API_KEY",
    "CLOUDINARY_CLOUD_NAME",
  ];

  const env = {};
  for (const key of required) env[key] = Boolean(process.env[key]);

  res.status(200).json({
    ok: true,
    node: process.version,
    isProduction,
    isServerless,
    mongo: MONGO_STATES[mongoose.connection.readyState] ?? "unknown",
    env,
  });
});

// Every route below needs the database, and on a cold start the connection
// does not exist yet. Awaiting it here avoids Mongoose buffering timeouts and
// turns an unreachable database into a clear 503 instead of a crash.
app.use(async (req, res, next) => {
  try {
    await connectdb();
    next();
  } catch (error) {
    console.error("Database unavailable:", error);
    res.status(503).json({ message: "Database unavailable" });
  }
});

app.use(rateLimiter);
app.use("/api/notes", notesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

// Serve the static files from the React frontend build
if (!isProduction) {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
  });
}

// Anything a route throws lands here as JSON rather than killing the process.
app.use((error, req, res, next) => {
  console.error("Unhandled request error:", error);
  if (res.headersSent) return next(error);
  res.status(500).json({ message: "Internal server error" });
});

// node-cron keeps no state between serverless invocations, and binding a port
// inside a serverless function crashes it, so both are for long-lived servers.
if (!isServerless) {
  startCronJobs();

  connectdb().catch((error) => {
    console.error("Initial database connection failed:", error);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log("App listening on PORT:", PORT);
  });
}

export default app;
