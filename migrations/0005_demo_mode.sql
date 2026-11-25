-- Demo mode setting. On by default while sample records exist.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);

INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES ('demo_mode', '1', '2026-11-26T00:00:00.000Z');
