import { isAuthorized, json } from '../../../../lib/admin-auth.js';
import { cleanStoreId, ensureStoreSchema, normalizeProduct, validateProduct } from '../../../../lib/store-db.js';

export async function onRequestPut(context) {
  if (!(await isAuthorized(context.request, context.env))) return json({ ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
  const db = context.env.TOYSKUB_DB;
  if (!db) return json({ ok: false, error: 'ไม่พบ TOYSKUB_DB' }, 503);
  try { await ensureStoreSchema(db); }
  catch { return json({ ok: false, error: 'เตรียมฐานข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่' }, 503); }
  const routeId = cleanStoreId(context.params.id);
  const product = normalizeProduct({ ...(await context.request.json().catch(() => ({}))), id: routeId });
  const error = validateProduct(product); if (error) return json({ ok: false, error }, 400);
  try {
    const reserved = await db.prepare(`SELECT COALESCE(SUM(quantity),0) AS total FROM store_orders
      WHERE product_id=? AND status IN ('pending','payment_review')`).bind(routeId).first();
    if (product.stockQuantity < Number(reserved?.total || 0)) {
      return json({ ok: false, error: 'จำนวนคงเหลือต่ำกว่าจำนวนที่ถูกจอง กรุณายกเลิกคำสั่งซื้อก่อน' }, 409);
    }
    const result = await db.prepare(`UPDATE store_products SET name=?,description=?,level=?,category=?,price_satang=?,cost_price_satang=?,
      stock_quantity=?,image_url=?,status=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(product.name,product.description,product.level,product.category,product.priceSatang,product.costPriceSatang,product.stockQuantity,
        product.imageUrl,product.status,product.sortOrder,routeId).run();
    if (!result.meta?.changes) return json({ ok: false, error: 'ไม่พบสินค้านี้' }, 404);
    return json({ ok: true, product });
  } catch { return json({ ok: false, error: 'แก้ไขสินค้าไม่สำเร็จ' }, 500); }
}

export function onRequest() { return json({ ok: false, error: 'Method not allowed' }, 405); }
