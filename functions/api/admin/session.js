import { getAdminPassword, isAuthorized, json } from "../../lib/admin-auth.js";

export async function onRequestGet(context) {
  const configured = Boolean(getAdminPassword(context.env));
  if (!configured) {
    return json({ ok: false, configured: false, error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD" }, 503);
  }

  const authorized = await isAuthorized(context.request, context.env);
  if (!authorized) {
    return json({ ok: false, configured: true, authenticated: false }, 401);
  }

  let databaseConnected = false;
  try {
    if (context.env.TOYSKUB_DB) {
      await context.env.TOYSKUB_DB.prepare("SELECT 1 AS ok").first();
      databaseConnected = true;
    }
  } catch {
    databaseConnected = false;
  }

  return json({
    ok: true,
    configured: true,
    authenticated: true,
    admin: { email: String(context.env.ADMIN_EMAIL || "เจ้าของเว็บไซต์") },
    database: { binding: "TOYSKUB_DB", connected: databaseConnected },
    version: "Admin Panel v2",
  });
}

export function onRequest() {
  return json({ ok: false, error: "Method not allowed" }, 405);
}
