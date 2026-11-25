-- Security and booking integrity. Safe to run on the existing database.
-- Existing sign-in sessions are cleared; everyone signs in again.

DELETE FROM sessions;

ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

ALTER TABLE sessions ADD COLUMN token_hash TEXT;
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

ALTER TABLE requests ADD COLUMN decline_reason TEXT;
ALTER TABLE requests ADD COLUMN package TEXT;

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  user_id TEXT,
  role TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  ip TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
