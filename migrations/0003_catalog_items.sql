CREATE TABLE IF NOT EXISTS catalog_items (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'model', category_label TEXT NOT NULL DEFAULT '', grade TEXT NOT NULL DEFAULT '', scale TEXT NOT NULL DEFAULT '', series TEXT NOT NULL DEFAULT '', manufacturer TEXT NOT NULL DEFAULT '', catalog_image TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_status_sort ON catalog_items(status,sort_order,id);
