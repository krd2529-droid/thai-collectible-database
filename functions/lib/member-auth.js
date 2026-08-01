import { ensureMemberTables, isAdminRole } from './members-db.js';
const COOKIE_NAME = 'toyskub_member';
const SESSION_DAYS = 30;
function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function createMemberSession(db, userId) {
  await ensureMemberTables(db);
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db.prepare('INSERT INTO member_sessions(user_id,token_hash,expires_at) VALUES(?,?,?)').bind(userId, tokenHash, expires).run();
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
export function clearMemberCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export async function getCurrentMember(request, env) {
  const db = env.TOYSKUB_DB;
  if (!db) return null;
  await ensureMemberTables(db);
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const user = await db.prepare(`SELECT u.id,u.email,u.phone,u.first_name AS firstName,u.last_name AS lastName,
    u.display_name AS displayName,u.role,u.status,u.created_at AS createdAt
    FROM member_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP LIMIT 1`).bind(tokenHash).first();
  if (!user || user.status !== 'active') return null;
  await db.prepare('UPDATE member_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?').bind(tokenHash).run();
  return user;
}
export async function deleteCurrentMemberSession(request, env) {
  const db = env.TOYSKUB_DB;
  if (!db) return;
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return;
  await ensureMemberTables(db);
  await db.prepare('DELETE FROM member_sessions WHERE token_hash=?').bind(await sha256(token)).run();
}
export async function requireMember(context) {
  const user = await getCurrentMember(context.request, context.env);
  return user || null;
}
export async function requireAdminMember(context) {
  const user = await getCurrentMember(context.request, context.env);
  return user && isAdminRole(user.role) ? user : null;
}
