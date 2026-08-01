import { clearSessionCookie, json } from "../../lib/admin-auth.js";

export function onRequestPost() {
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}

export function onRequest() {
  return json({ ok: false, error: "Method not allowed" }, 405);
}
