import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

export type DB = Database.Database;

/**
 * SQLite is shared by two processes (collector writes, web reads).
 * WAL mode allows concurrent readers alongside a single writer without locking.
 * A module-level singleton is cached on globalThis so Next.js hot-reload does not
 * open a new handle on every request.
 */
const globalForDb = globalThis as unknown as { __db?: DB };

export function getDb(): DB {
  if (globalForDb.__db) return globalForDb.__db;

  const dir = path.dirname(config.DB_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(config.DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  migrate(db);

  globalForDb.__db = db;
  return db;
}

function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS klines (
      symbol          TEXT    NOT NULL,
      interval        TEXT    NOT NULL,
      open_time       INTEGER NOT NULL,
      open            REAL    NOT NULL,
      high            REAL    NOT NULL,
      low             REAL    NOT NULL,
      close           REAL    NOT NULL,
      volume          REAL    NOT NULL,
      close_time      INTEGER NOT NULL,
      quote_volume    REAL    NOT NULL,
      trades          INTEGER NOT NULL,
      taker_buy_base  REAL    NOT NULL,
      taker_buy_quote REAL    NOT NULL,
      is_final        INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (symbol, interval, open_time)
    );

    CREATE INDEX IF NOT EXISTS idx_klines_symbol_time
      ON klines (symbol, interval, open_time DESC);

    CREATE TABLE IF NOT EXISTS pipeline_status (
      symbol               TEXT PRIMARY KEY,
      ws_connected         INTEGER NOT NULL DEFAULT 0,
      last_message_at      INTEGER,
      last_kline_open_time INTEGER,
      backfilled_count     INTEGER NOT NULL DEFAULT 0,
      gaps_detected        INTEGER NOT NULL DEFAULT 0,
      gaps_filled          INTEGER NOT NULL DEFAULT 0,
      error_count          INTEGER NOT NULL DEFAULT 0,
      reconcile_last_run   INTEGER,
      updated_at           INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pipeline_events (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      ts     INTEGER NOT NULL,
      symbol TEXT    NOT NULL,
      type   TEXT    NOT NULL,
      detail TEXT    NOT NULL DEFAULT '',
      count  INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_events_ts ON pipeline_events (ts DESC);
  `);
}
