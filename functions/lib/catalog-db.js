async function addColumn(db, sql) { try { await db.prepare(sql).run(); } catch (_) {} }
export async function ensureCatalogTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'model',
    category_label TEXT NOT NULL DEFAULT '',
    category_code TEXT NOT NULL DEFAULT '',
    product_type TEXT NOT NULL DEFAULT '',
    product_type_code TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '',
    line TEXT NOT NULL DEFAULT '',
    line_code TEXT NOT NULL DEFAULT '',
    scale TEXT NOT NULL DEFAULT '',
    series TEXT NOT NULL DEFAULT '',
    manufacturer TEXT NOT NULL DEFAULT '',
    catalog_image TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    sort_order INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await addColumn(db, `ALTER TABLE catalog_items ADD COLUMN category_code TEXT NOT NULL DEFAULT ''`);
  await addColumn(db, `ALTER TABLE catalog_items ADD COLUMN product_type TEXT NOT NULL DEFAULT ''`);
  await addColumn(db, `ALTER TABLE catalog_items ADD COLUMN product_type_code TEXT NOT NULL DEFAULT ''`);
  await addColumn(db, `ALTER TABLE catalog_items ADD COLUMN line TEXT NOT NULL DEFAULT ''`);
  await addColumn(db, `ALTER TABLE catalog_items ADD COLUMN line_code TEXT NOT NULL DEFAULT ''`);
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_status_sort ON catalog_items(status,sort_order,id)`).run();
}
const code = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
export function normalizeCatalogInput(raw = {}) {
  const cleanList = (value) => Array.isArray(value) ? value.map(v => String(v || '').trim()).filter(Boolean) : String(value || '').split('\n').map(v => v.trim()).filter(Boolean);
  const cleanPairs = (value, a, b) => Array.isArray(value) ? value.map(x => ({[a]: String(x?.[a] || '').trim(), [b]: String(x?.[b] || '').trim()})).filter(x => x[a] || x[b]) : [];
  const id = code(raw.id);
  const line = String(raw.line || raw.grade || '').trim().toUpperCase();
  const p = {
    id,
    category: String(raw.category || 'model').trim(),
    categoryLabel: String(raw.categoryLabel || 'Gundam').trim(),
    categoryCode: code(raw.categoryCode || (String(raw.categoryLabel || '').toLowerCase() === 'gundam' ? 'gd' : raw.categoryLabel)),
    productType: String(raw.productType || 'Gunpla').trim(),
    productTypeCode: code(raw.productTypeCode || (String(raw.productType || '').toLowerCase() === 'gunpla' ? 'gp' : raw.productType)),
    line,
    lineCode: code(raw.lineCode || line),
    sku: String(raw.sku || id.toUpperCase()).trim(),
    rgNumber: raw.rgNumber === '' || raw.rgNumber == null ? null : Number(raw.rgNumber),
    name: String(raw.name || '').trim(),
    grade: line,
    scale: String(raw.scale || '').trim(),
    seriesGroup: String(raw.seriesGroup || '').trim(),
    seriesGroupOrder: Number(raw.seriesGroupOrder) || 0,
    series: String(raw.series || '').trim(),
    manufacturer: String(raw.manufacturer || '').trim(),
    releaseDate: String(raw.releaseDate || '').trim(),
    launchPriceJPY: raw.launchPriceJPY === '' || raw.launchPriceJPY == null ? null : Number(raw.launchPriceJPY),
    recommendedAge: String(raw.recommendedAge || '').trim(),
    heightCm: raw.heightCm === '' || raw.heightCm == null ? null : Number(raw.heightCm),
    images: cleanList(raw.images),
    videoEmbedUrl: String(raw.videoEmbedUrl || '').trim(),
    summary: String(raw.summary || '').trim(),
    highlights: cleanList(raw.highlights),
    whatsDifferent: cleanPairs(raw.whatsDifferent, 'title', 'detail'),
    boxContents: cleanList(raw.boxContents),
    notIncluded: cleanList(raw.notIncluded),
    pros: cleanList(raw.pros),
    considerations: cleanList(raw.considerations),
    faq: cleanPairs(raw.faq, 'q', 'a'),
    catalogStatus: String(raw.catalogStatus || 'draft').trim(),
    sourceName: String(raw.sourceName || '').trim(),
    sourceUrl: String(raw.sourceUrl || '').trim(),
    affiliateLinks: {
      shopee: String(raw.affiliateLinks?.shopee || '').trim(),
      lazada: String(raw.affiliateLinks?.lazada || '').trim(),
      tiktok: String(raw.affiliateLinks?.tiktok || '').trim(),
      page: String(raw.affiliateLinks?.page || '').trim(),
    },
    modelCode: String(raw.modelCode || '').trim(),
    priceTaxIncluded: Boolean(raw.priceTaxIncluded),
    references: cleanPairs(raw.references, 'label', 'url'),
    material: String(raw.material || '').trim(),
    manualImages: cleanList(raw.manualImages),
    catalogImage: String(raw.catalogImage || cleanList(raw.images)[0] || '').trim(),
    inStock: null,
    status: ['draft','published','hidden','trash','deleted'].includes(raw.status) ? raw.status : 'draft',
    sortOrder: Number(raw.sortOrder) || 0,
  };
  p.catalogPath = [p.categoryCode,p.productTypeCode,p.lineCode,code(p.series)].filter(Boolean).join('/');
  return p;
}
export function summaryFromPayload(p) {
  return {
    id:p.id, category:p.category, categoryLabel:p.categoryLabel, categoryCode:p.categoryCode,
    productType:p.productType, productTypeCode:p.productTypeCode, line:p.line, lineCode:p.lineCode,
    sku:p.sku, rgNumber:p.rgNumber, name:p.name, grade:p.grade, scale:p.scale,
    seriesGroup:p.seriesGroup, seriesGroupOrder:p.seriesGroupOrder, series:p.series, manufacturer:p.manufacturer, catalogImage:p.catalogImage,
    images:p.images?.length ? p.images : (p.catalogImage ? [p.catalogImage] : []),
    catalogPath:p.catalogPath, inStock:null, source:'d1'
  };
}

function isEmptyIncoming(value) {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function mergeCatalogPayload(base = {}, incoming = {}) {
  const out = { ...base };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (key === 'id' || key === 'status' || key === 'catalogStatus' || key === 'mergeMode') {
      if (value !== undefined && value !== null && value !== '') out[key] = value;
      continue;
    }
    if (key === 'affiliateLinks') {
      out[key] = { ...(base[key] || {}) };
      for (const [subKey, subValue] of Object.entries(value || {})) {
        if (!isEmptyIncoming(subValue)) out[key][subKey] = subValue;
      }
      continue;
    }
    if (!isEmptyIncoming(value)) out[key] = value;
  }
  return out;
}

export async function loadStaticCatalogItem(request, id) {
  try {
    const url = new URL(`/data/catalog/gundam/gunpla/rg/${encodeURIComponent(id)}.json`, request.url);
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch (_) {
    return null;
  }
}
