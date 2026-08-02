const COOKIE_NAME = "toyskub_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textBytes(value) {
  return new TextEncoder().encode(String(value));
}

async function sign(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    textBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textBytes(payload));
  return base64Url(new Uint8Array(signature));
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function getAdminPassword(env) {
  return String(env.ADMIN_PASSWORD || "").trim();
}

export async function createSessionCookie(secret) {
  const payload = `${Date.now()}.${crypto.randomUUID()}`;
  const signature = await sign(secret, payload);
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function isAuthorized(request, env) {
  // รองรับทั้ง session สมาชิกที่มีสิทธิ์ และ cookie แอดมินเดิม
  try {
    const { getCurrentMember } = await import("./member-auth.js");
    const member = await getCurrentMember(request, env);
    if (member && ["super_admin", "admin", "editor"].includes(member.role)) return true;
  } catch {}
  const secret = getAdminPassword(env);
  if (!secret) return false;
  const value = getCookie(request, COOKIE_NAME);
  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0) return false;
  const payload = value.slice(0, lastDot);
  const suppliedSignature = value.slice(lastDot + 1);
  const [timestampText] = payload.split(".");
  const timestamp = Number(timestampText);
  if (!Number.isFinite(timestamp)) return false;
  if (Date.now() - timestamp > SESSION_SECONDS * 1000) return false;
  const expectedSignature = await sign(secret, payload);
  return safeEqual(suppliedSignature, expectedSignature);
}
