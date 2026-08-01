-- Part 3.1: hierarchy codes for compact catalog paths
ALTER TABLE catalog_items ADD COLUMN category_code TEXT NOT NULL DEFAULT '';
ALTER TABLE catalog_items ADD COLUMN product_type TEXT NOT NULL DEFAULT '';
ALTER TABLE catalog_items ADD COLUMN product_type_code TEXT NOT NULL DEFAULT '';
ALTER TABLE catalog_items ADD COLUMN line TEXT NOT NULL DEFAULT '';
ALTER TABLE catalog_items ADD COLUMN line_code TEXT NOT NULL DEFAULT '';
