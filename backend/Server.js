import express from "express";
import cookieParser from "cookie-parser";
import notesRoutes from "./src/routes/notes.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import { connectdb } from "./src/config/db.js";
import rateLimiter from "./src/middleware/ratelimiter.middleware.js";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.MODE !== "production") {
  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    }),
  );
}

const PORT = process.env.PORT || 5001;

app.use(rateLimiter);
app.use("/api/notes", notesRoutes);
app.use("/api/auth", authRoutes);

// Serve the static files from the React frontend build
if (process.env.MODE !== "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
  });
}

connectdb();

if (process.env.MODE !== "production") {
  app.listen(PORT, () => {
    console.log("App listening on PORT:", PORT);
  });
}

export default app;
