-- Automatically initialized on the first cloud-sync request.
CREATE TABLE IF NOT EXISTS weboss_desktops (
  id TEXT PRIMARY KEY NOT NULL,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL
);
