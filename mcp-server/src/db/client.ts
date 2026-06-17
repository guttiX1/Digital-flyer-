import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH =
  process.env.DB_PATH ??
  path.resolve(__dirname, "../../../carrerasos.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  applyMerchSchema(_db);
  return _db;
}

function applyMerchSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trends (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      topic       TEXT    NOT NULL,
      type        TEXT    NOT NULL DEFAULT 'horse',
      score       REAL    NOT NULL DEFAULT 0,
      mentions    INTEGER NOT NULL DEFAULT 0,
      growth_pct  REAL    NOT NULL DEFAULT 0,
      sentiment   TEXT    NOT NULL DEFAULT 'neutral',
      first_seen  TEXT    DEFAULT (datetime('now')),
      last_seen   TEXT    DEFAULT (datetime('now')),
      UNIQUE(topic)
    );

    CREATE TABLE IF NOT EXISTS designs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      trend_id         INTEGER REFERENCES trends(id),
      style            TEXT    NOT NULL DEFAULT 'vintage_western',
      brief            TEXT    NOT NULL DEFAULT '',
      image_path       TEXT,
      is_personal      INTEGER NOT NULL DEFAULT 0,
      personal_context TEXT,
      status           TEXT    NOT NULL DEFAULT 'brief',
      created_at       TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merch_products (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      design_id           INTEGER NOT NULL REFERENCES designs(id),
      printify_product_id TEXT,
      product_type        TEXT    NOT NULL,
      mockup_url          TEXT,
      status              TEXT    NOT NULL DEFAULT 'draft',
      created_at          TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merch_listings (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL REFERENCES merch_products(id),
      etsy_listing_id TEXT,
      title           TEXT    NOT NULL,
      description     TEXT    NOT NULL DEFAULT '',
      tags            TEXT    NOT NULL DEFAULT '',
      price           REAL    NOT NULL DEFAULT 29.99,
      status          TEXT    NOT NULL DEFAULT 'draft',
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merch_sales (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES merch_listings(id),
      revenue    REAL    NOT NULL DEFAULT 0,
      units      INTEGER NOT NULL DEFAULT 1,
      platform   TEXT    NOT NULL DEFAULT 'etsy',
      sold_at    TEXT    DEFAULT (datetime('now'))
    );
  `);
}
