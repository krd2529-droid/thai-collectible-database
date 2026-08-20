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

  let form;
  try {
    form = await context.request.formData();
  } catch {
    return json({ ok: false, error: 'อ่านไฟล์อัปโหลดไม่สำเร็จ กรุณาเลือกไฟล์ใหม่' }, 400);
  }
  const file = form.get('file');
  const thumbnail = form.get('thumbnail');
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
  if (thumbnail && (!String(thumbnail.type || '').startsWith('image/') || thumbnail.size > 3 * 1024 * 1024)) {
    return json({ ok: false, error: 'ไฟล์รูปย่อไม่ถูกต้องหรือใหญ่เกิน 3 MB' }, 400);
  }

  const name = clean(file.name) || `${Date.now()}.webp`;
  const stamp = Date.now();
  const key = `catalog/${id}/${kind}/${stamp}-${name}`;
  const thumbnailName = clean(thumbnail?.name) || name.replace(/\.webp$/i, '-thumb.webp');
  const thumbnailKey = thumbnail ? `catalog/${id}/${kind}/${stamp}-${thumbnailName}` : '';

  const save = async (storageKey, mediaFile, variant) => context.env.TOYSKUB_MEDIA.put(
    storageKey,
    await mediaFile.arrayBuffer(),
    {
      httpMetadata: {
        contentType: mediaFile.type || 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: { catalogId: id, kind, variant },
    },
  );
  try {
    await Promise.all([
      save(key, file, 'display'),
      ...(thumbnail ? [save(thumbnailKey, thumbnail, 'thumbnail')] : []),
    ]);
  } catch (error) {
    console.error('media upload failed', { name: error?.name, message: error?.message });
    return json({ ok: false, error: 'บันทึกรูปลงพื้นที่จัดเก็บไม่สำเร็จ กรุณาตรวจ R2 binding หรือทดลองใหม่' }, 503);
  }

  return json({
    ok: true,
    url: `/media/${key}`,
    thumbnailUrl: thumbnailKey ? `/media/${thumbnailKey}` : `/media/${key}`,
    name,
    fileName: key.split('/').pop(),
  });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}
