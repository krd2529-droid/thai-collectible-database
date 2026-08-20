export const STORE_CATEGORY = 'one-piece-card';
export const PRODUCT_STATUSES = new Set(['draft', 'published', 'hidden', 'sold_out']);
export const ORDER_STATUSES = new Set(['pending', 'payment_review', 'paid', 'cancelled']);

export function cleanStoreId(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function normalizeProduct(raw = {}) {
  const price = Number(raw.price);
  const stock = Number(raw.stockQuantity);
  const sortOrder = Number(raw.sortOrder);
  return {
    id: cleanStoreId(raw.id),
    name: String(raw.name || '').trim().slice(0, 160),
    description: String(raw.description || '').trim().slice(0, 5000),
    category: STORE_CATEGORY,
    priceSatang: Number.isFinite(price) ? Math.round(price * 100) : -1,
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
  if (product.stockQuantity < 0) return 'จำนวนสินค้าต้องเป็นจำนวนเต็มที่ไม่ติดลบ';
  if (product.imageUrl && !/^(?:\/media\/|\/images\/|https:\/\/)/i.test(product.imageUrl)) {
    return 'URL รูปสินค้าต้องเป็น HTTPS หรือ path รูปภายในเว็บไซต์';
  }
  return '';
}

export function productFromRow(row = {}) {
  const stockQuantity = Number(row.stockQuantity || 0);
  const reservedQuantity = Number(row.reservedQuantity || 0);
  const availableStock = Math.max(0, stockQuantity - reservedQuantity);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
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
}

export const PRODUCT_SELECT = `SELECT p.id,p.name,p.description,p.category,
  p.price_satang AS priceSatang,p.stock_quantity AS stockQuantity,p.image_url AS imageUrl,
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
