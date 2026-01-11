import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Optional: einfache DB-Verbindung prüfen
export async function dbHealthcheck() {
  const res = await pool.query("SELECT 1 as ok");
  return res.rows?.[0]?.ok === 1;
}
