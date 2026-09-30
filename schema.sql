-- Automatically initialized on the first cloud-sync request.
CREATE TABLE IF NOT EXISTS weboss_desktops (
  id TEXT PRIMARY KEY NOT NULL,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL
);

-- Optional shared cache, initialized when generating a fallback icon with AI.
CREATE TABLE IF NOT EXISTS weboss_site_icons (
  icon_key TEXT PRIMARY KEY,
  design_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
