import { isAuthorized, json } from "../../../lib/admin-auth.js";
import { ensureCategoriesTable, normalizeCategoryInput } from "../../../lib/categories-db.js";

async function requireAdmin(context) {
  if (!(await isAuthorized(context.request, context.env))) {
    return json({ ok: false, error: "กรุณาเข้าสู่ระบบใหม่" }, 401);
  }
  if (!context.env.TOYSKUB_DB) {
    return json({ ok: false, error: "ไม่พบ D1 binding ชื่อ TOYSKUB_DB" }, 503);
  }
  return null;
}

export async function onRequestGet(context) {
  const denied = await requireAdmin(context);
  if (denied) return denied;
  const db = context.env.TOYSKUB_DB;
  await ensureCategoriesTable(db);
  const result = await db.prepare(`
    SELECT id, name, slug, description, sort_order AS sortOrder,
           is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
    FROM categories
    ORDER BY sort_order ASC, name COLLATE NOCASE ASC
  `).all();
  return json({ ok: true, categories: result.results || [] });
}

export async function onRequestPost(context) {
  const denied = await requireAdmin(context);
  if (denied) return denied;
  const body = await context.request.json().catch(() => ({}));
  const category = normalizeCategoryInput(body);
  if (!category.name) return json({ ok: false, error: "กรุณากรอกชื่อหมวด" }, 400);
  if (!category.slug) return json({ ok: false, error: "กรุณากรอก Slug เป็นภาษาอังกฤษ" }, 400);
  const db = context.env.TOYSKUB_DB;
  await ensureCategoriesTable(db);
  try {
    const result = await db.prepare(`
      INSERT INTO categories (name, slug, description, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).bind(category.name, category.slug, category.description, category.sortOrder, category.isActive).run();
    return json({ ok: true, id: result.meta?.last_row_id, message: "เพิ่มหมวดเรียบร้อย" }, 201);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return json({ ok: false, error: "Slug นี้มีอยู่แล้ว" }, 409);
    }
    return json({ ok: false, error: "บันทึกหมวดไม่สำเร็จ" }, 500);
  }
}

export function onRequest() {
  return json({ ok: false, error: "Method not allowed" }, 405);
}
