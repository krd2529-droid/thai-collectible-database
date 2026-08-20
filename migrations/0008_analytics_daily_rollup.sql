CREATE TABLE IF NOT EXISTS analytics_daily (
  day TEXT NOT NULL,
  page_id TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK(view_count >= 0),
  PRIMARY KEY (day, page_id)
);
CREATE TABLE IF NOT EXISTS analytics_totals (
  page_id TEXT PRIMARY KEY,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK(view_count >= 0)
);
INSERT INTO analytics_daily(day, page_id, view_count)
SELECT date(viewed_at), page_id, COUNT(DISTINCT visitor_id)
FROM analytics_views
GROUP BY date(viewed_at), page_id
ON CONFLICT(day, page_id) DO NOTHING;
INSERT INTO analytics_totals(page_id, view_count)
SELECT page_id, SUM(view_count)
FROM analytics_daily
GROUP BY page_id
ON CONFLICT(page_id) DO NOTHING;
