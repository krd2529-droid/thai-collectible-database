import { createSessionCookie, getAdminPassword, json } from "../../lib/admin-auth.js";

export async function onRequestPost(context) {
  const configuredPassword = getAdminPassword(context.env);
  if (!configuredPassword) {
    return json({ ok: false, error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD ใน Cloudflare" }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, 400);
  }

  const password = String(body.password || "");
  if (password !== configuredPassword) {
    return json({ ok: false, error: "รหัสผ่านไม่ถูกต้อง" }, 401);
  }

  const cookie = await createSessionCookie(configuredPassword);
  return json({ ok: true }, 200, { "set-cookie": cookie });
}

export function onRequest() {
  return json({ ok: false, error: "Method not allowed" }, 405);
}
