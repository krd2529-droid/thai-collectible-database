import { isAuthorized, json } from '../../../../lib/admin-auth.js';
import { ORDER_SELECT, orderFromRow } from '../../../../lib/store-db.js';

export async function onRequestGet(context) {
  if (!(await isAuthorized(context.request, context.env))) return json({ ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
  const db = context.env.TOYSKUB_DB;
  if (!db) return json({ ok: false, error: 'ไม่พบ TOYSKUB_DB' }, 503);
  try {
    const result = await db.prepare(`${ORDER_SELECT} ORDER BY id DESC LIMIT 500`).all();
    return json({ ok: true, orders: (result.results || []).map(orderFromRow) });
  } catch { return json({ ok: false, error: 'ฐานข้อมูลสินค้าและคำสั่งซื้อยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ' }, 503); }
}

export function onRequest() { return json({ ok: false, error: 'Method not allowed' }, 405); }
