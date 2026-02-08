import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "taskmint.db");

export function getDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

export function migrate(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bounties (
      id              INTEGER PRIMARY KEY,
      address         TEXT NOT NULL UNIQUE,
      creator         TEXT NOT NULL,
      title_hash      TEXT NOT NULL,
      proof_type      INTEGER NOT NULL,
      reward_amount   TEXT NOT NULL,
      deadline        INTEGER NOT NULL,
      block_number    INTEGER NOT NULL,
      tx_hash         TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claims (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_address  TEXT NOT NULL,
      executor        TEXT NOT NULL,
      payout          TEXT NOT NULL,
      block_number    INTEGER NOT NULL,
      tx_hash         TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(bounty_address, executor)
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_address  TEXT NOT NULL,
      creator         TEXT NOT NULL,
      amount          TEXT NOT NULL,
      block_number    INTEGER NOT NULL,
      tx_hash         TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key             TEXT PRIMARY KEY,
      value           TEXT NOT NULL
    );
  `);
}
