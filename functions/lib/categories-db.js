export async function ensureCategoriesTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export function normalizeCategoryInput(input = {}) {
  const name = String(input.name || "").trim();
  const slug = String(input.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  const description = String(input.description || "").trim();
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;
  const isActive = input.isActive === false ? 0 : 1;
  return { name, slug, description, sortOrder, isActive };
}
