import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db.js";

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200)
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200)
});

function signToken(user) {
  const token = jwt.sign(
    { email: user.email },
    process.env.JWT_SECRET,
    { subject: String(user.id), expiresIn: "7d" }
  );
  return token;
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), passwordHash]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (e) {
    // Unique violation
    if (e?.code === "23505") return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { email, password } = parsed.data;

  const result = await pool.query(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email } });
});

export default router;
