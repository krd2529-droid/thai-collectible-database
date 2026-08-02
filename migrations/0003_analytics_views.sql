CREATE TABLE IF NOT EXISTS analytics_views(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_views_date ON analytics_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_analytics_views_page ON analytics_views(page_id);
