import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.js";
import notesRoutes from "./routes/notes.js";
import { dbHealthcheck } from "./db.js";

const app = express();

app.use(helmet());
app.use(express.json());

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",").map(s => s.trim()) ?? true,
  credentials: false
}));

app.get("/health", async (req, res) => {
  const ok = await dbHealthcheck().catch(() => false);
  res.json({ ok });
});

app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`Backend running on :${port}`));
