import { json } from '../../../lib/admin-auth.js';
import { cleanStoreId, ensureStoreSchema, ORDER_SELECT, publicOrderFromRow } from '../../../lib/store-db.js';

function reference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `TOY-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function onRequestPost(context) {
  const db = context.env.TOYSKUB_DB;
  if (!db) return json({ ok: false, error: 'ร้านค้ายังไม่พร้อมใช้งาน' }, 503);
  try { await ensureStoreSchema(db); }
  catch { return json({ ok: false, error: 'เตรียมฐานข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่' }, 503); }
  const body = await context.request.json().catch(() => ({}));
  const productId = cleanStoreId(body.productId);
  const quantity = Number(body.quantity);
  const customerName = String(body.customerName || '').trim().slice(0, 120);
  const customerPhone = String(body.customerPhone || '').trim().slice(0, 30);
  const shippingAddress = String(body.shippingAddress || '').trim().slice(0, 1000);
  const customerNote = String(body.customerNote || '').trim().slice(0, 500);
  const clientToken = String(body.clientToken || '').trim();
  if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return json({ ok: false, error: 'สินค้าและจำนวนไม่ถูกต้อง' }, 400);
  }
  if (!customerName || customerName.length < 2) return json({ ok: false, error: 'กรุณากรอกชื่อผู้รับ' }, 400);
  if (!/^[0-9+() -]{8,30}$/.test(customerPhone)) return json({ ok: false, error: 'เบอร์โทรไม่ถูกต้อง' }, 400);
  if (shippingAddress.length < 10) return json({ ok: false, error: 'กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน' }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(clientToken)) return json({ ok: false, error: 'รหัสคำขอไม่ถูกต้อง กรุณาเปิดหน้าสั่งซื้อใหม่' }, 400);

  const orderReference = reference();
  try {
    const existing = await db.prepare(`${ORDER_SELECT} WHERE client_token=?`).bind(clientToken).first();
    if (existing) return json({ ok: true, order: publicOrderFromRow(existing), duplicate: true });
    const result = await db.prepare(`INSERT INTO store_orders
      (reference,client_token,product_id,product_name,unit_price_satang,quantity,total_satang,
       customer_name,customer_phone,shipping_address,customer_note,status)
      SELECT ?,?,p.id,p.name,p.price_satang,?,p.price_satang*?,?,?,?,?,'pending'
      FROM store_products p
      WHERE p.id=? AND p.status='published' AND p.stock_quantity-COALESCE((
        SELECT SUM(o.quantity) FROM store_orders o
        WHERE o.product_id=p.id AND o.status IN ('pending','payment_review')
      ),0)>=?`).bind(orderReference,clientToken,quantity,quantity,customerName,customerPhone,shippingAddress,
        customerNote,productId,quantity).run();
    if (!result.meta?.changes) return json({ ok: false, error: 'สินค้าไม่พร้อมขายหรือจำนวนคงเหลือไม่พอ' }, 409);
    const row = await db.prepare(`${ORDER_SELECT} WHERE reference=?`).bind(orderReference).first();
    return json({ ok: true, order: publicOrderFromRow(row) }, 201);
  } catch {
    return json({ ok: false, error: 'สร้างคำสั่งซื้อไม่สำเร็จ' }, 500);
  }
}

export function onRequest() { return json({ ok: false, error: 'Method not allowed' }, 405); }
