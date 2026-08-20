ALTER TABLE store_products ADD COLUMN cost_price_satang INTEGER NOT NULL DEFAULT 0 CHECK(cost_price_satang >= 0);
