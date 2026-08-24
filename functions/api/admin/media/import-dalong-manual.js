import { isAuthorized, json } from '../../../lib/admin-auth.js';

const clean = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const IMAGE_EXT = /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i;
const MANUAL_NAME = /m[_-]?\d{3,5}\.(?:jpe?g|png|webp)$/i;

function allowedDalongUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (host !== 'dalong.net' && host !== 'www.dalong.net') return null;
    url.protocol = 'https:';
    url.hostname = 'www.dalong.net';
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

export function extractManualUrls(html, pageUrl) {
  const found = [];
  const quoted = /["']([^"'<>\s]+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi;
  for (const match of html.matchAll(quoted)) {
    try {
      let raw = match[1].replace(/&amp;/g, '&');
      let url = new URL(raw, pageUrl);
      if (!allowedDalongUrl(url.href) || !IMAGE_EXT.test(url.pathname)) continue;
      if (url.pathname.includes('/th/s_')) url = new URL(url.href.replace('/th/s_', '/p/'));
      const name = decodeURIComponent(url.pathname.split('/').pop() || '');
      if (!MANUAL_NAME.test(name)) continue;
      url.protocol = 'https:';
      url.hostname = 'www.dalong.net';
      url.search = '';
      found.push(url.href);
    } catch {}
  }
  return [...new Set(found)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function extractCoverUrl(html, pageUrl) {
  const quoted = /["']([^"'<>\s]+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi;
  for (const match of html.matchAll(quoted)) {
    try {
      let url = new URL(match[1].replace(/&amp;/g, '&'), pageUrl);
      if (!allowedDalongUrl(url.href) || !IMAGE_EXT.test(url.pathname)) continue;
      if (url.pathname.includes('/th/s_')) url = new URL(url.href.replace('/th/s_', '/p/'));
      const name = decodeURIComponent(url.pathname.split('/').pop() || '');
      if (MANUAL_NAME.test(name) || /(?:runner|parts?|r_?\d+)\b/i.test(name)) continue;
      url.protocol = 'https:'; url.hostname = 'www.dalong.net'; url.search = '';
      return url.href;
    } catch {}
  }
  return '';
}

async function importImage(context, { sourceUrl, pageUrl, id, kind, index = 1 }) {
  const source = allowedDalongUrl(sourceUrl);
  if (!source) throw new Error('invalid source');
  const response = await fetch(source.href, { headers: { referer: pageUrl, 'user-agent': 'Toyskub Catalog Importer/1.0' }, redirect: 'follow' });
  const finalImageUrl = allowedDalongUrl(response.url || source.href);
  const type = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!response.ok || !finalImageUrl || !type.startsWith('image/')) throw new Error('image unavailable');
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 8 * 1024 * 1024) throw new Error('image too large');
  const sourceName = clean(decodeURIComponent(finalImageUrl.pathname.split('/').pop() || '')) || `${kind}-${index}.jpg`;
  const key = `catalog/${id}/${kind}/${Date.now()}-${String(index).padStart(3, '0')}-${sourceName}`;
  await context.env.TOYSKUB_MEDIA.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { catalogId: id, kind, variant: 'display', source: finalImageUrl.href } });
  const src = `/media/${key}`;
  return { src, thumbSrc: src, name: sourceName, width: null, height: null, sourceUrl: finalImageUrl.href };
}

export async function onRequestPost(context) {
  if (!(await isAuthorized(context.request, context.env))) return json({ ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
  if (!context.env.TOYSKUB_MEDIA) return json({ ok: false, error: 'ยังไม่ได้ผูก R2 binding ชื่อ TOYSKUB_MEDIA ใน Cloudflare' }, 503);

  const body = await context.request.json().catch(() => ({}));
  const id = clean(body.id);
  const includeCover = body.includeCover === true;
  const pageUrl = allowedDalongUrl(body.pageUrl);
  if (!id) return json({ ok: false, error: 'กรุณากรอกรหัสรายการก่อนดึงรูป' }, 400);
  if (!pageUrl) return json({ ok: false, error: 'รองรับเฉพาะลิงก์จาก dalong.net' }, 400);

  const pageResponse = await fetch(pageUrl.href, { headers: { 'user-agent': 'Toyskub Catalog Importer/1.0' }, redirect: 'follow' });
  if (!pageResponse.ok) return json({ ok: false, error: `เปิดหน้า Dalong ไม่สำเร็จ (${pageResponse.status})` }, 502);
  const finalPageUrl = allowedDalongUrl(pageResponse.url || pageUrl.href);
  if (!finalPageUrl) return json({ ok: false, error: 'Dalong เปลี่ยนเส้นทางไปยังเว็บที่ไม่รองรับ' }, 400);
  const html = await pageResponse.text();
  const coverUrl = includeCover ? extractCoverUrl(html, finalPageUrl.href) : null;
  const urls = extractManualUrls(html, finalPageUrl.href).slice(0, 80);
  if (!urls.length && !coverUrl) return json({ ok: false, error: 'ไม่พบรูปปกหรือหน้าคู่มือ กรุณาใช้ลิงก์หน้า Information ที่ลงท้าย _i.htm' }, 404);

  let cover = null;
  if (coverUrl) { try { cover = await importImage(context, { sourceUrl: coverUrl, pageUrl: finalPageUrl.href, id, kind: 'gallery' }); } catch {} }

  const images = [];
  let skipped = 0;
  for (let index = 0; index < urls.length; index += 1) {
    try {
      images.push(await importImage(context, { sourceUrl: urls[index], pageUrl: finalPageUrl.href, id, kind: 'manual', index: index + 1 }));
    } catch {
      skipped += 1;
    }
  }
  if (!images.length && !cover) return json({ ok: false, error: 'พบลิงก์รูป แต่ดาวน์โหลดรูปไม่ได้' }, 502);
  return json({ ok: true, cover, images, skipped, found: urls.length, pageUrl: finalPageUrl.href });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}
