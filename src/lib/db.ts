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

    -- Live progress of each REST backfill range, one row per (symbol, interval).
    -- Written by the collector as it paginates; read by the collector's own console
    -- renderer and by the dashboard, so both describe the same fill from one source.
    CREATE TABLE IF NOT EXISTS backfill_progress (
      symbol      TEXT    NOT NULL,
      interval    TEXT    NOT NULL,
      kind        TEXT    NOT NULL DEFAULT 'live',
      phase       TEXT    NOT NULL DEFAULT 'pending',
      reason      TEXT    NOT NULL DEFAULT '',
      range_start INTEGER NOT NULL DEFAULT 0,
      range_end   INTEGER NOT NULL DEFAULT 0,
      cursor_time INTEGER NOT NULL DEFAULT 0,
      written     INTEGER NOT NULL DEFAULT 0,
      pages       INTEGER NOT NULL DEFAULT 0,
      started_at  INTEGER NOT NULL DEFAULT 0,
      updated_at  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (symbol, interval)
    );

    -- Single-row (id = 1) snapshot of the collector process + REST usage.
    CREATE TABLE IF NOT EXISTS system_metrics (
      id                 INTEGER PRIMARY KEY CHECK (id = 1),
      cpu_pct            REAL    NOT NULL DEFAULT 0,
      rss_bytes          INTEGER NOT NULL DEFAULT 0,
      uptime_sec         REAL    NOT NULL DEFAULT 0,
      rest_calls_total   INTEGER NOT NULL DEFAULT 0,
      rest_calls_rate    REAL    NOT NULL DEFAULT 0,
      rest_retry_count   INTEGER NOT NULL DEFAULT 0,
      rate_limited_count INTEGER NOT NULL DEFAULT 0,
      server_error_count INTEGER NOT NULL DEFAULT 0,
      used_weight        INTEGER NOT NULL DEFAULT 0,
      weight_limit       INTEGER NOT NULL DEFAULT 6000,
      updated_at         INTEGER NOT NULL DEFAULT 0
    );

    INSERT OR IGNORE INTO system_metrics (id) VALUES (1);
  `);

  // Additive migrations for pipeline_status columns introduced after v0.1.
  // Columns dropped since (message_count, error_count) are simply no longer created:
  // an existing DB keeps them, unread and harmless, rather than needing a rewrite.
  ensureColumns(db, "pipeline_status", {
    ws_msg_rate: "REAL NOT NULL DEFAULT 0",
    reconnect_count: "INTEGER NOT NULL DEFAULT 0",
    best_bid: "REAL",
    best_ask: "REAL",
    ticker_updated_at: "INTEGER",
  });
}

/** Add any missing columns to an existing table (idempotent, safe on old DBs). */
function ensureColumns(db: DB, table: string, columns: Record<string, string>): void {
  const existing = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name),
  );
  for (const [name, def] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
  }
}
