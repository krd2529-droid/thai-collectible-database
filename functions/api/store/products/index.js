import { json } from '../../../lib/admin-auth.js';
import { ensureStoreSchema, PRODUCT_SELECT, productFromRow, STORE_CATEGORY } from '../../../lib/store-db.js';

export async function onRequestGet(context) {
  const db = context.env.TOYSKUB_DB;
  if (!db) return json({ ok: false, error: 'ร้านค้ายังไม่พร้อมใช้งาน' }, 503);
  try {
    await ensureStoreSchema(db);
    const result = await db.prepare(`${PRODUCT_SELECT}
      WHERE p.category=? AND p.status IN ('published','sold_out')
      ORDER BY p.sort_order,p.id`).bind(STORE_CATEGORY).all();
    return json({ ok: true, products: (result.results || []).map(productFromRow) });
  } catch {
    return json({ ok: false, error: 'ร้านค้ายังไม่พร้อมใช้งาน' }, 503);
  }
}

export function onRequest() { return json({ ok: false, error: 'Method not allowed' }, 405); }
