import { isAuthorized, json } from '../../../../lib/admin-auth.js';
import { ensureStoreSchema, normalizeProduct, PRODUCT_SELECT, productFromRow, validateProduct } from '../../../../lib/store-db.js';

async function guard(context) {
  if (!(await isAuthorized(context.request, context.env))) return json({ ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
  if (!context.env.TOYSKUB_DB) return json({ ok: false, error: 'ไม่พบ TOYSKUB_DB' }, 503);
  return null;
}

export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  try {
    await ensureStoreSchema(context.env.TOYSKUB_DB);
    const result = await context.env.TOYSKUB_DB.prepare(`${PRODUCT_SELECT} ORDER BY p.sort_order,p.id`).all();
    return json({ ok: true, products: (result.results || []).map(row => productFromRow(row, { includeCost: true })) });
  } catch { return json({ ok: false, error: 'ฐานข้อมูลสินค้าและคำสั่งซื้อยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ' }, 503); }
}

export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  try { await ensureStoreSchema(context.env.TOYSKUB_DB); }
  catch { return json({ ok: false, error: 'เตรียมฐานข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่' }, 503); }
  const product = normalizeProduct(await context.request.json().catch(() => ({})));
  const error = validateProduct(product); if (error) return json({ ok: false, error }, 400);
  try {
    await context.env.TOYSKUB_DB.prepare(`INSERT INTO store_products
      (id,name,description,level,category,price_satang,cost_price_satang,stock_quantity,image_url,status,sort_order)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(product.id,product.name,product.description,product.level,product.category,
      product.priceSatang,product.costPriceSatang,product.stockQuantity,product.imageUrl,product.status,product.sortOrder).run();
    return json({ ok: true, product }, 201);
  } catch (errorValue) {
    const conflict = String(errorValue).toLowerCase().includes('unique');
    return json({ ok: false, error: conflict ? 'รหัสสินค้านี้มีอยู่แล้ว' : 'เพิ่มสินค้าไม่สำเร็จ' }, conflict ? 409 : 500);
  }
}

export function onRequest() { return json({ ok: false, error: 'Method not allowed' }, 405); }
