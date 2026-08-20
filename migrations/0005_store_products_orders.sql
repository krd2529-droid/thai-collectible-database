CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'one-piece-card',
  price_satang INTEGER NOT NULL CHECK(price_satang >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','hidden','sold_out')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_products_category_status_sort
  ON store_products(category,status,sort_order,id);

CREATE TABLE IF NOT EXISTS store_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  client_token TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price_satang INTEGER NOT NULL CHECK(unit_price_satang >= 0),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  total_satang INTEGER NOT NULL CHECK(total_satang >= 0),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  customer_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','payment_review','paid','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  FOREIGN KEY(product_id) REFERENCES store_products(id)
);

CREATE INDEX IF NOT EXISTS idx_store_orders_status_created
  ON store_orders(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_orders_product_status
  ON store_orders(product_id,status);

-- Keep payment confirmation and physical stock deduction in one SQLite transaction.
-- Pending/payment_review orders reserve availability in queries; stock is deducted
-- exactly once only when an order reaches paid.
CREATE TRIGGER IF NOT EXISTS trg_store_orders_paid_stock
BEFORE UPDATE OF status ON store_orders
WHEN NEW.status = 'paid' AND OLD.status <> 'paid'
BEGIN
  SELECT CASE
    WHEN (SELECT stock_quantity FROM store_products WHERE id = NEW.product_id) < NEW.quantity
    THEN RAISE(ABORT, 'insufficient stock')
  END;

  UPDATE store_products
  SET stock_quantity = stock_quantity - NEW.quantity,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.product_id;
END;
