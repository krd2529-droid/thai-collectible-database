async function getColumns(db) {
  const result = await db.prepare("PRAGMA table_info(categories)").all();
  return new Set((result.results || []).map((row) => row.name));
}

async function addColumnIfMissing(db, columns, name, definition) {
  if (columns.has(name)) return;
  await db.prepare(`ALTER TABLE categories ADD COLUMN ${name} ${definition}`).run();
  columns.add(name);
}

export async function ensureCategoriesTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      parent_id INTEGER,
      node_type TEXT NOT NULL DEFAULT 'category',
      source_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  const columns = await getColumns(db);
  await addColumnIfMissing(db, columns, "parent_id", "INTEGER");
  await addColumnIfMissing(db, columns, "node_type", "TEXT NOT NULL DEFAULT 'category'");
  await addColumnIfMissing(db, columns, "source_path", "TEXT NOT NULL DEFAULT ''");
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_categories_parent_sort ON categories(parent_id, sort_order, name)").run();
}

export function normalizeCategoryInput(input = {}) {
  const name = String(input.name || "").trim();
  const slug = String(input.slug || "")
    .trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  const description = String(input.description || "").trim();
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;
  const isActive = input.isActive === false ? 0 : 1;
  const parentId = Number.isInteger(Number(input.parentId)) && Number(input.parentId) > 0 ? Number(input.parentId) : null;
  const allowedTypes = new Set(["category", "product_type", "grade"]);
  const nodeType = allowedTypes.has(input.nodeType) ? input.nodeType : "category";
  const sourcePath = String(input.sourcePath || "").trim();
  return { name, slug, description, sortOrder, isActive, parentId, nodeType, sourcePath };
}
