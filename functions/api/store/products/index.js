import { json } from '../../../lib/admin-auth.js';
import { PRODUCT_SELECT, productFromRow, STORE_CATEGORIES, STORE_CATEGORY } from '../../../lib/store-db.js';

export async function onRequestGet(context) {
  const db = context.env.TOYSKUB_DB;
  if (!db) return json({ ok: false, error: 'ร้านค้ายังไม่พร้อมใช้งาน' }, 503);
  try {
    const requestedCategory = String(new URL(context.request?.url || 'https://toyskub.local/api/store/products').searchParams.get('category') || STORE_CATEGORY).trim().toLowerCase();
    if (!STORE_CATEGORIES.has(requestedCategory)) return json({ ok: false, error: 'ไม่พบหมวดสินค้านี้' }, 404);
    const result = await db.prepare(`${PRODUCT_SELECT}
      WHERE p.category=? AND p.status IN ('published','sold_out')
      ORDER BY p.sort_order,p.id`).bind(requestedCategory).all();
    return json({ ok: true, products: (result.results || []).map(productFromRow) }, 200, {
      'cache-control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60',
    });
  } catch {
    return json({ ok: false, error: 'ร้านค้ายังไม่พร้อมใช้งาน' }, 503);
  }
}

export function onRequest() { return json({ ok: false, error: 'Method not allowed' }, 405); }
