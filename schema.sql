-- Flyer Pipeline — SQLite Schema Reference
-- Applied automatically by outreach.py on first run.

CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    date         TEXT,
    venue        TEXT,
    location     TEXT,
    image_path   TEXT,
    extracted_at TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS races (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     INTEGER REFERENCES events(id) ON DELETE CASCADE,
    race_number  INTEGER,
    race_name    TEXT,
    distance     TEXT,
    surface      TEXT,
    purse        TEXT,
    horses       TEXT    -- JSON array: [{number, name, jockey, trainer, odds}, ...]
);

CREATE TABLE IF NOT EXISTS fans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    email        TEXT,
    phone        TEXT,
    source       TEXT,   -- picks | contest | markets | pick6
    created_at   TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS picks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fan_id       INTEGER REFERENCES fans(id) ON DELETE CASCADE,
    event_id     INTEGER REFERENCES events(id),
    race_id      INTEGER REFERENCES races(id),
    horse_name   TEXT,
    created_at   TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outreach_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     INTEGER REFERENCES events(id),
    output_type  TEXT    NOT NULL,
    file_path    TEXT    NOT NULL,
    created_at   TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pick6_cards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     INTEGER REFERENCES events(id),
    card_number  TEXT    UNIQUE NOT NULL,
    fan_id       INTEGER REFERENCES fans(id),
    picks        TEXT,   -- JSON: {"1": "HORSE NAME", "2": "...", ...}
    is_winner    INTEGER DEFAULT 0,
    created_at   TEXT    DEFAULT (datetime('now'))
);
