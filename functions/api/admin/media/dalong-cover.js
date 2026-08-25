import { isAuthorized, json } from '../../../lib/admin-auth.js';

export function buildDalongCoverUrl(id) {
  const match = String(id || '').trim().toLowerCase().match(/^rg-0*(\d+)$/);
  if (!match) return '';
  const number = Number(match[1]);
  if (!Number.isInteger(number) || number < 1) return '';
  return `https://www.dalong.net/reviews/rg/rg${number}/p/rg${number}.jpg`;
}

export async function onRequestGet(context) {
  if (!(await isAuthorized(context.request, context.env))) return json({ ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
  const sourceUrl = buildDalongCoverUrl(new URL(context.request.url).searchParams.get('id'));
  if (!sourceUrl) return json({ ok: false, error: 'รหัส RG ไม่ถูกต้อง' }, 400);

  const number = Number(sourceUrl.match(/rg(\d+)\/p/)?.[1]);
  const pageUrl = `https://www.dalong.net/reviews/rg/rg${number}/rg${number}_i.htm`;
  let response;
  try {
    response = await fetch(sourceUrl, {
      headers: { referer: pageUrl, 'user-agent': 'Toyskub Catalog Cover/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return json({ ok: false, error: 'โหลดรูปปก Dalong ไม่สำเร็จ' }, 502);
  }
  const type = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!response.ok || !type.startsWith('image/')) return json({ ok: false, error: 'โหลดรูปปก Dalong ไม่สำเร็จ' }, 502);
  return new Response(response.body, {
    headers: {
      'content-type': type,
      'cache-control': 'private, max-age=86400',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}
