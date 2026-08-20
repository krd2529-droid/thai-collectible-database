import { isAuthorized, json } from '../../../../lib/admin-auth.js';
import { ORDER_STATUSES } from '../../../../lib/store-db.js';

const TRANSITIONS = {
  pending: new Set(['payment_review','cancelled']),
  payment_review: new Set(['paid','cancelled']),
  paid: new Set(),
  cancelled: new Set(),
};

export async function onRequestPut(context) {
  if (!(await isAuthorized(context.request, context.env))) return json({ ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
  const db = context.env.TOYSKUB_DB;
  if (!db) return json({ ok: false, error: 'ไม่พบ TOYSKUB_DB' }, 503);
  const id = Number(context.params.id);
  const body = await context.request.json().catch(() => ({}));
  const status = String(body.status || '');
  if (!Number.isInteger(id) || id < 1 || !ORDER_STATUSES.has(status)) return json({ ok: false, error: 'คำสั่งไม่ถูกต้อง' }, 400);
  const order = await db.prepare('SELECT id,product_id AS productId,quantity,status FROM store_orders WHERE id=?').bind(id).first();
  if (!order) return json({ ok: false, error: 'ไม่พบคำสั่งซื้อ' }, 404);
  if (!TRANSITIONS[order.status]?.has(status)) return json({ ok: false, error: 'ไม่สามารถเปลี่ยนสถานะตามลำดับนี้ได้' }, 409);

  if (status === 'paid') {
    try {
      const result = await db.prepare("UPDATE store_orders SET status='paid',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='payment_review'").bind(id).run();
      if (!result.meta?.changes) return json({ ok: false, error: 'สถานะถูกเปลี่ยนไปแล้ว' }, 409);
    } catch (error) {
      if (String(error?.message || error).includes('insufficient stock')) {
        return json({ ok: false, error: 'สต็อกไม่เพียงพอ' }, 409);
      }
      throw error;
    }
  } else {
    const result = await db.prepare('UPDATE store_orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?')
      .bind(status,id,order.status).run();
    if (!result.meta?.changes) return json({ ok: false, error: 'สถานะถูกเปลี่ยนไปแล้ว' }, 409);
  }
  return json({ ok: true, id, status });
}

export function onRequest() { return json({ ok: false, error: 'Method not allowed' }, 405); }
