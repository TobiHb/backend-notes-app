import express from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const noteCreateSchema = z.object({
  title: z.string().max(200).optional().default(""),
  content: z.string().max(20000).optional().default("")
});

const noteUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(20000).optional()
}).refine((d) => d.title !== undefined || d.content !== undefined, {
  message: "Provide at least one field to update"
});

// alle Notizen des Users
router.get("/", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, title, content, created_at, updated_at FROM notes WHERE user_id = $1 ORDER BY updated_at DESC",
    [req.user.id]
  );
  res.json({ notes: result.rows });
});

// einzelne Notiz
router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const result = await pool.query(
    "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = $1 AND user_id = $2",
    [id, req.user.id]
  );
  const note = result.rows[0];
  if (!note) return res.status(404).json({ error: "Not found" });

  res.json({ note });
});

// Notiz erstellen
router.post("/", requireAuth, async (req, res) => {
  const parsed = noteCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { title, content } = parsed.data;
  const result = await pool.query(
    "INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, title, content, created_at, updated_at",
    [req.user.id, title, content]
  );

  res.status(201).json({ note: result.rows[0] });
});

// Notiz updaten
router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = noteUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { title, content } = parsed.data;

  const result = await pool.query(
    `UPDATE notes
     SET title = COALESCE($1, title),
         content = COALESCE($2, content)
     WHERE id = $3 AND user_id = $4
     RETURNING id, title, content, created_at, updated_at`,
    [title ?? null, content ?? null, id, req.user.id]
  );

  const note = result.rows[0];
  if (!note) return res.status(404).json({ error: "Not found" });

  res.json({ note });
});

// Notiz löschen
router.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const result = await pool.query(
    "DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, req.user.id]
  );

  if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

export default router;
