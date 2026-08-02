import { isAuthorized, json } from '../../../lib/admin-auth.js';

const clean = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export async function onRequestPost(context) {
  if (!(await isAuthorized(context.request, context.env))) {
    return json({ ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
  }

  if (!context.env.TOYSKUB_MEDIA) {
    return json(
      { ok: false, error: 'ยังไม่ได้ผูก R2 binding ชื่อ TOYSKUB_MEDIA ใน Cloudflare' },
      503,
    );
  }

  const form = await context.request.formData();
  const file = form.get('file');
  const id = clean(form.get('id'));
  const kind = clean(form.get('kind') || 'gallery');

  if (!id) return json({ ok: false, error: 'กรุณากรอกรหัสรายการก่อนอัปโหลดรูป' }, 400);
  if (!file || typeof file.arrayBuffer !== 'function') {
    return json({ ok: false, error: 'ไม่พบไฟล์รูป' }, 400);
  }
  if (!String(file.type || '').startsWith('image/')) {
    return json({ ok: false, error: 'รองรับเฉพาะไฟล์รูป' }, 400);
  }
  if (file.size > 8 * 1024 * 1024) {
    return json({ ok: false, error: 'ไฟล์ใหญ่เกิน 8 MB' }, 400);
  }

  const name = clean(file.name) || `${Date.now()}.webp`;
  const key = `catalog/${id}/${kind}/${Date.now()}-${name}`;

  await context.env.TOYSKUB_MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { catalogId: id, kind },
  });

  return json({
    ok: true,
    url: `/media/${key}`,
    name,
    fileName: key.split('/').pop(),
  });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}
