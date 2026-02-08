import express from "express";
import cors from "cors";
import type Database from "better-sqlite3";

export function createApi(db: Database.Database, port: number) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // -- GET /bounties --
  app.get("/bounties", (_req, res) => {
    const rows = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM claims c WHERE c.bounty_address = b.address) as winners_count
      FROM bounties b
      ORDER BY b.id DESC
    `).all();
    res.json(rows);
  });

  // -- GET /bounties/:id --
  app.get("/bounties/:id", (req, res) => {
    const row = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM claims c WHERE c.bounty_address = b.address) as winners_count
      FROM bounties b
      WHERE b.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  // -- GET /bounties/:id/claims --
  app.get("/bounties/:id/claims", (req, res) => {
    const bounty = db.prepare(`SELECT address FROM bounties WHERE id = ?`).get(req.params.id) as
      | { address: string }
      | undefined;
    if (!bounty) return res.status(404).json({ error: "Bounty not found" });

    const rows = db.prepare(`SELECT * FROM claims WHERE bounty_address = ? ORDER BY created_at DESC`).all(
      bounty.address
    );
    res.json(rows);
  });

  // -- GET /claims/:wallet --
  app.get("/claims/:wallet", (req, res) => {
    const rows = db.prepare(`SELECT * FROM claims WHERE executor = ? ORDER BY created_at DESC`).all(
      req.params.wallet.toLowerCase()
    );
    res.json(rows);
  });

  // -- Health --
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`);
  });
}
