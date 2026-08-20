export const STORE_CATEGORY = 'one-piece-card';
export const PRODUCT_STATUSES = new Set(['draft', 'published', 'hidden', 'sold_out']);
export const ORDER_STATUSES = new Set(['pending', 'payment_review', 'paid', 'cancelled']);

const STORE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS store_products (
    id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',level TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'one-piece-card',price_satang INTEGER NOT NULL CHECK(price_satang >= 0),
    cost_price_satang INTEGER NOT NULL DEFAULT 0 CHECK(cost_price_satang >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),image_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','hidden','sold_out')),
    sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_store_products_category_status_sort ON store_products(category,status,sort_order,id)`,
  `CREATE TABLE IF NOT EXISTS store_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,reference TEXT NOT NULL UNIQUE,client_token TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL,product_name TEXT NOT NULL,unit_price_satang INTEGER NOT NULL CHECK(unit_price_satang >= 0),
    quantity INTEGER NOT NULL CHECK(quantity > 0),total_satang INTEGER NOT NULL CHECK(total_satang >= 0),
    customer_name TEXT NOT NULL,customer_phone TEXT NOT NULL,shipping_address TEXT NOT NULL,
    customer_note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','payment_review','paid','cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TEXT,FOREIGN KEY(product_id) REFERENCES store_products(id))`,
  `CREATE INDEX IF NOT EXISTS idx_store_orders_status_created ON store_orders(status,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_store_orders_product_status ON store_orders(product_id,status)`,
  `CREATE TRIGGER IF NOT EXISTS trg_store_orders_paid_stock BEFORE UPDATE OF status ON store_orders
    WHEN NEW.status = 'paid' AND OLD.status <> 'paid' BEGIN
      SELECT CASE WHEN (SELECT stock_quantity FROM store_products WHERE id = NEW.product_id) < NEW.quantity
        THEN RAISE(ABORT, 'insufficient stock') END;
      UPDATE store_products SET stock_quantity = stock_quantity - NEW.quantity,updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.product_id;
    END`,
];

export async function ensureStoreSchema(db) {
  await db.prepare(STORE_SCHEMA_STATEMENTS[0]).run();
  const additiveColumns = [
    ['level', "ALTER TABLE store_products ADD COLUMN level TEXT NOT NULL DEFAULT ''"],
    ['cost_price_satang', 'ALTER TABLE store_products ADD COLUMN cost_price_satang INTEGER NOT NULL DEFAULT 0 CHECK(cost_price_satang >= 0)'],
  ];
  for (const [column, sql] of additiveColumns) {
    try { await db.prepare(`SELECT ${column} FROM store_products LIMIT 1`).first(); }
    catch {
      try { await db.prepare(sql).run(); }
      catch (error) { if (!/duplicate column/i.test(String(error))) throw error; }
    }
  }
  for (const statement of STORE_SCHEMA_STATEMENTS.slice(1)) await db.prepare(statement).run();
}

export function cleanStoreId(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function normalizeProduct(raw = {}) {
  const price = Number(raw.price);
  const costPrice = Number(raw.costPrice);
  const stock = Number(raw.stockQuantity);
  const sortOrder = Number(raw.sortOrder);
  return {
    id: cleanStoreId(raw.id),
    name: String(raw.name || '').trim().slice(0, 160),
    description: String(raw.description || '').trim().slice(0, 5000),
    level: String(raw.level || '').trim().slice(0, 80),
    category: STORE_CATEGORY,
    priceSatang: Number.isFinite(price) ? Math.round(price * 100) : -1,
    costPriceSatang: Number.isFinite(costPrice) ? Math.round(costPrice * 100) : 0,
    stockQuantity: Number.isInteger(stock) ? stock : -1,
    imageUrl: String(raw.imageUrl || '').trim().slice(0, 1000),
    status: PRODUCT_STATUSES.has(raw.status) ? raw.status : 'draft',
    sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
  };
}

export function validateProduct(product) {
  if (!product.id) return 'กรุณากรอกรหัสสินค้า';
  if (!product.name) return 'กรุณากรอกชื่อสินค้า';
  if (product.priceSatang < 0) return 'ราคาสินค้าต้องไม่ติดลบ';
  if (product.costPriceSatang < 0) return 'ราคาต้นทุนต้องไม่ติดลบ';
  if (product.stockQuantity < 0) return 'จำนวนสินค้าต้องเป็นจำนวนเต็มที่ไม่ติดลบ';
  if (product.imageUrl && !/^(?:\/media\/|\/images\/|https:\/\/)/i.test(product.imageUrl)) {
    return 'URL รูปสินค้าต้องเป็น HTTPS หรือ path รูปภายในเว็บไซต์';
  }
  return '';
}

export function productFromRow(row = {}, { includeCost = false } = {}) {
  const stockQuantity = Number(row.stockQuantity || 0);
  const reservedQuantity = Number(row.reservedQuantity || 0);
  const availableStock = Math.max(0, stockQuantity - reservedQuantity);
  const product = {
    id: row.id,
    name: row.name,
    description: row.description,
    level: row.level || '',
    category: row.category,
    price: Number(row.priceSatang || 0) / 100,
    stockQuantity,
    reservedQuantity,
    availableStock,
    imageUrl: row.imageUrl || '',
    status: availableStock === 0 && row.status === 'published' ? 'sold_out' : row.status,
    sortOrder: Number(row.sortOrder || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (includeCost) product.costPrice = Number(row.costPriceSatang || 0) / 100;
  return product;
}

export const PRODUCT_SELECT = `SELECT p.id,p.name,p.description,p.level,p.category,
  p.price_satang AS priceSatang,p.cost_price_satang AS costPriceSatang,
  p.stock_quantity AS stockQuantity,p.image_url AS imageUrl,
  p.status,p.sort_order AS sortOrder,p.created_at AS createdAt,p.updated_at AS updatedAt,
  COALESCE((SELECT SUM(o.quantity) FROM store_orders o
    WHERE o.product_id=p.id AND o.status IN ('pending','payment_review')),0) AS reservedQuantity
  FROM store_products p`;

export function orderFromRow(row = {}) {
  return {
    id: Number(row.id),
    reference: row.reference,
    productId: row.productId,
    productName: row.productName,
    unitPrice: Number(row.unitPriceSatang || 0) / 100,
    quantity: Number(row.quantity || 0),
    total: Number(row.totalSatang || 0) / 100,
    customerName: row.customerName || '',
    customerPhone: row.customerPhone || '',
    shippingAddress: row.shippingAddress || '',
    customerNote: row.customerNote || '',
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    paidAt: row.paidAt || null,
  };
}

export function publicOrderFromRow(row = {}) {
  const order = orderFromRow(row);
  return { reference:order.reference, productId:order.productId, productName:order.productName,
    unitPrice:order.unitPrice, quantity:order.quantity, total:order.total, status:order.status };
}

export const ORDER_SELECT = `SELECT id,reference,client_token AS clientToken,product_id AS productId,product_name AS productName,
  unit_price_satang AS unitPriceSatang,quantity,total_satang AS totalSatang,
  customer_name AS customerName,customer_phone AS customerPhone,
  shipping_address AS shippingAddress,customer_note AS customerNote,status,
  created_at AS createdAt,updated_at AS updatedAt,paid_at AS paidAt FROM store_orders`;
