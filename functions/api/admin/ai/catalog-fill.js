import { isAuthorized, json } from '../../../lib/admin-auth.js';

const catalogSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id','sku','name','rgNumber','mgsdNumber','mgNumber','modelCode','manufacturer','series','scale','releaseDate',
    'launchPriceJPY','heightCm','recommendedAge','productType','material','seriesGroup','summary',
    'highlights','whatsDifferent','boxContents','notIncluded','pros','considerations','faq','references','dalongPageUrl'
  ],
  properties: {
    id: { type: ['string','null'] },
    sku: { type: ['string','null'] },
    name: { type: ['string','null'], description: 'Official Gundam/model name in English only; do not use Thai script' },
    rgNumber: { type: ['integer','null'] },
    mgsdNumber: { type: ['integer','null'] },
    mgNumber: { type: ['integer','null'] },
    modelCode: { type: ['string','null'] },
    manufacturer: { type: ['string','null'] },
    series: { type: ['string','null'], description: 'ชื่ออนิเมะ ภาพยนตร์ หรือผลงานต้นทาง เช่น Mobile Suit Gundam SEED; ห้ามใส่ชื่อเกรด เช่น Real Grade หรือ RG' },
    scale: { type: ['string','null'] },
    releaseDate: { type: ['string','null'], description: 'YYYY-MM-DD when verified, otherwise null' },
    launchPriceJPY: { type: ['integer','null'], description: 'Japanese launch price before tax' },
    heightCm: { type: ['number','null'], description: 'Completed model height in centimeters, verified from bandai-hobby.net by searching the official Japanese product name' },
    recommendedAge: { type: ['string','null'], description: 'Always return 15 ปีขึ้นไป' },
    productType: { type: ['string','null'] },
    material: { type: ['string','null'] },
    seriesGroup: { type: ['string','null'] },
    summary: { type: ['string','null'] },
    highlights: { type: 'array', items: { type: 'string' } },
    whatsDifferent: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['title','detail'],
        properties: { title: { type: 'string' }, detail: { type: 'string' } }
      }
    },
    boxContents: { type: 'array', items: { type: 'string' } },
    notIncluded: { type: 'array', items: { type: 'string' } },
    pros: { type: 'array', items: { type: 'string' } },
    considerations: { type: 'array', items: { type: 'string' } },
    faq: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['q','a'],
        properties: { q: { type: 'string' }, a: { type: 'string' } }
      }
    },
    references: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['label','url'],
        properties: { label: { type: 'string' }, url: { type: 'string' } }
      }
    },
    dalongPageUrl: { type: ['string','null'], description: 'Verified matching Dalong Information page URL ending in _i.htm, otherwise null' }
  }
};

function outputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export function normalizeCatalogSeries(value) {
  const series = String(value || '').trim();
  if (!series) return null;
  if (/^(?:real\s*grade(?:\s*\(\s*rg\s*\))?|rg|mgsd|master\s*grade\s*sd)$/i.test(series)) return null;
  return series;
}

export function normalizeCatalogName(value) {
  const name = String(value || '').trim();
  if (!name || /[\u0E00-\u0E7F]/u.test(name)) return null;
  return name;
}

export function normalizeRecommendedAge() {
  return '15 ปีขึ้นไป';
}

function catalogIdentityKey(value, catalogLine) {
  const line = String(catalogLine || '').trim().toUpperCase();
  let name = String(value || '').trim().toLowerCase();
  if (!name) return '';
  if (line === 'RG') name = name.replace(/^rg\s*(?:1\s*\/\s*144)?\s*/i, '');
  else if (line === 'MGSD') name = name.replace(/^mgsd\s*/i, '');
  else if (line === 'MG') name = name.replace(/^mg\s*(?:1\s*\/\s*100)?\s*/i, '');
  return name.replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function applyCatalogIdentity(catalogLine, item, candidate) {
  let stored = {};
  try { stored = JSON.parse(candidate.payloadJson || '{}'); } catch {}
  const line = String(catalogLine || '').trim().toUpperCase();
  const numberKey = line === 'MGSD' ? 'mgsdNumber' : line === 'MG' ? 'mgNumber' : 'rgNumber';
  const numberMatch = String(candidate.id || '').match(/-(\d+)$/);
  return {
    ...item,
    id: candidate.id,
    sku: line === 'MG' ? null : candidate.sku || stored.sku || String(candidate.id || '').toUpperCase(),
    [numberKey]: candidate[numberKey] ?? stored[numberKey] ?? (numberMatch ? Number(numberMatch[1]) : null),
  };
}

function matchCatalogIdentity(candidates, catalogLine, query, item) {
  const line = String(catalogLine || '').trim().toUpperCase();
  const wanted = new Set([catalogIdentityKey(query, line), catalogIdentityKey(item.name, line)].filter(Boolean));
  if (!wanted.size) return item;
  const matches = (candidates || []).filter(row => wanted.has(catalogIdentityKey(row.name, line)));
  return matches.length === 1 ? applyCatalogIdentity(line, item, matches[0]) : item;
}

const CATALOG_IDENTITY = {
  RG: { folder: 'rg', prefix: 'rg', skuPrefix: 'RG', numberKey: 'rgNumber' },
  MGSD: { folder: 'mgsd', prefix: 'mgsd', skuPrefix: 'MGSD', numberKey: 'mgsdNumber' },
  MG: { folder: 'mg', prefix: 'mg', skuPrefix: null, numberKey: 'mgNumber' },
};

async function loadStaticCatalogCandidates(request, catalogLine) {
  const config = CATALOG_IDENTITY[String(catalogLine || '').trim().toUpperCase()];
  if (!config) return [];
  const url = new URL(`/data/catalog/gundam/gunpla/${config.folder}/index.json`, request.url);
  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!response.ok) return [];
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
}

export async function resolveStaticCatalogIdentity(request, catalogLine, query, item = {}) {
  const candidates = await loadStaticCatalogCandidates(request, catalogLine);
  return matchCatalogIdentity(candidates, catalogLine, query, item);
}

export async function resolveExistingCatalogIdentity(db, catalogLine, query, item = {}) {
  if (!db?.prepare) return item;
  const line = String(catalogLine || '').trim().toUpperCase();
  const result = await db.prepare(`SELECT id,name,sku,payload_json AS payloadJson FROM catalog_items WHERE UPPER(COALESCE(NULLIF(line,''),grade))=?`).bind(line).all();
  return matchCatalogIdentity(result.results || [], line, query, item);
}

export async function allocateNextCatalogIdentity(request, db, catalogLine, item = {}) {
  const line = String(catalogLine || '').trim().toUpperCase();
  const config = CATALOG_IDENTITY[line];
  if (!config) return item;
  const validId = new RegExp(`^${config.prefix}-\\d+$`, 'i');
  if (validId.test(String(item.id || ''))) return line === 'MG' ? { ...item, sku: null } : item;
  const staticCandidates = await loadStaticCatalogCandidates(request, line).catch(() => []);
  let databaseCandidates = [];
  try {
    if (db?.prepare) {
      const result = await db.prepare(`SELECT id FROM catalog_items WHERE UPPER(COALESCE(NULLIF(line,''),grade))=?`).bind(line).all();
      databaseCandidates = result.results || [];
    }
  } catch { databaseCandidates = []; }
  const usedNumbers = [...staticCandidates, ...databaseCandidates].map(candidate => {
    const match = String(candidate?.id || '').match(new RegExp(`^${config.prefix}-(\\d+)$`, 'i'));
    return match ? Number(match[1]) : 0;
  });
  const nextNumber = Math.max(0, ...usedNumbers) + 1;
  const padded = String(nextNumber).padStart(3, '0');
  return {
    ...item,
    id: `${config.prefix}-${padded}`,
    sku: config.skuPrefix ? `${config.skuPrefix}-${padded}` : null,
    rgNumber: line === 'RG' ? nextNumber : null,
    mgsdNumber: line === 'MGSD' ? nextNumber : null,
    mgNumber: line === 'MG' ? nextNumber : null,
    [config.numberKey]: nextNumber,
  };
}

export async function onRequestPost(context) {
  if (!(await isAuthorized(context.request, context.env))) {
    return json({ ok: false, error: 'กรุณาเข้าสู่ระบบแอดมินใหม่' }, 401);
  }
  const apiKey = String(context.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Secret ชื่อ OPENAI_API_KEY ใน Cloudflare' }, 503);

  const body = await context.request.json().catch(() => ({}));
  const query = String(body.query || '').trim();
  if (!query) return json({ ok: false, error: 'กรุณากรอกชื่อรุ่นหรือรหัสสินค้า' }, 400);

  const includeEditorial = body.includeEditorial !== false;
  const includeBox = body.includeBox !== false;
  const requestedLine = String(body.catalogLine || 'RG').trim().toUpperCase();
  const catalogLine = ['RG','MGSD','MG'].includes(requestedLine) ? requestedLine : 'RG';
  let lineRule = catalogLine === 'MGSD'
    ? '- งานนี้เป็น MGSD เท่านั้น: id ใช้ mgsd-เลขสามหลัก เช่น mgsd-001, sku ใช้ MGSD-001, mgsdNumber ใส่ลำดับ, rgNumber และ mgNumber เป็น null, scale เป็น Non-scale, seriesGroup ใช้ MGSD หรือ Special Version และห้ามนำข้อมูลรุ่น RG/MG มาปะปน'
    : catalogLine === 'MG'
      ? '- งานนี้เป็น Master Grade เท่านั้น: id ใช้ mg-เลขสามหลัก เช่น mg-001 เป็นรหัสภายในสำหรับ URL และไฟล์รูป, sku ต้องเป็น null เพราะ MG ไม่มี SKU ของ TOYSKUB, mgNumber ใส่ลำดับ, rgNumber และ mgsdNumber เป็น null, scale เป็น 1/100, seriesGroup ต้องเป็นหมวดซีรีส์ตาม Dalong เช่น FIRST GUNDAM, MSV, Z & ZZ GUNDAM, GUNDAM SENTINEL, CHAR\'S COUNTER ATTACK, GUNDAM 0080, GUNDAM F91 / CROSSBONE, GUNDAM 0083, VICTORY GUNDAM, G GUNDAM, GUNDAM W / ENDLESS WALTZ, THE 08TH MS TEAM, GUNDAM X, TURN A GUNDAM, GUNDAM SEED / ASTRAY, GUNDAM OO, UNICORN / NARRATIVE, GUNDAM AGE, GUNDAM BUILD SERIES, IRON-BLOODED ORPHANS, ETC, PATLABOR / DUNBINE หรือ SPECIAL VERSION และห้ามนำข้อมูลรุ่น RG/MGSD มาปะปน'
      : '- งานนี้เป็น Real Grade เท่านั้น: id ใช้ rg-เลขสามหลัก เช่น rg-039, sku ใช้ RG-039, rgNumber ใส่ลำดับ และ mgsdNumber กับ mgNumber เป็น null';
  if (catalogLine === 'MG') lineRule += '\n- หน้า Dalong ของ MG ต้องอยู่ใน /reviews/mg/mgXX/ และลงท้าย _i.htm';
  const prompt = `ค้นคว้าข้อมูลสินค้า ${catalogLine} ต่อไปนี้เพื่อกรอกฐานข้อมูล TOYSKUB: "${query}"\n\nกติกา:\n- เน้นข้อมูลทางการจาก Bandai Hobby Site / Bandai Spirits และใช้ Dalong.net เป็นแหล่งเสริมเมื่อเกี่ยวข้อง\n${lineRule}\n- id, sku และเลขลำดับเป็นรหัสภายในของ TOYSKUB: ถ้ายืนยันจากคำค้นไม่ได้ให้คืน null ระบบจะจับคู่จากแคตตาล็อกเอง ห้ามเดา\n- ห้ามเดาข้อมูลเชิงข้อเท็จจริง ถ้ายืนยันไม่ได้ให้คืน null หรือ array ว่าง\n- ราคา launchPriceJPY ต้องเป็นราคาเปิดตัวญี่ปุ่นก่อนภาษี\n- releaseDate ใช้ YYYY-MM-DD เฉพาะเมื่อยืนยันวันได้\n- series ต้องเป็นชื่อซีรีส์/ผลงานต้นทางที่ตัวหุ่นปรากฏ เช่น Mobile Suit Gundam SEED หรือ Mobile Suit Gundam: Iron-Blooded Orphans เท่านั้น ห้ามใส่ชื่อเกรดสินค้า RG, Real Grade, MGSD หรือคำว่า Gundam ลอย ๆ\n- grade ของหน้านี้กำหนดจาก catalogLine อยู่แล้ว จึงห้ามนำชื่อเกรดไปกรอกซ้ำใน series\n- seriesGroup เลือก Gundam หรือ Special Version สำหรับ MGSD; ส่วน RG เลือก Gundam, Evangelion, Gaogaigar, Patlabor หรือ Special Version ตามที่เหมาะสม\n- เขียนภาษาไทยอ่านง่าย ไม่โฆษณาเกินจริง\n- references ใส่เฉพาะ URL ที่ค้นพบจริง พร้อมชื่อเว็บไซต์\n- หา Dalong Information URL ที่ตรงรุ่นและลงท้าย _i.htm ใส่ dalongPageUrl; MGSD อยู่ในหมวด /reviews/sd/mgsdXX/ ส่วน RG อยู่ใน /reviews/rg/rgXX/; ถ้ายืนยันไม่ได้ให้คืน null\n- ไม่ต้องเดา URL รูปโดยตรง ระบบจะตรวจและนำเข้ารูปปกกับคู่มือจากหน้า Dalong เอง\n- ไม่ต้องหา YouTube Shopee Lazada TikTok หรือ Affiliate\n${includeEditorial ? '- สร้างจุดเด่น ข้อแตกต่าง ข้อดี ข้อควรพิจารณา และ FAQ จากข้อมูลที่รองรับ' : '- highlights, whatsDifferent, pros, considerations และ faq ให้เป็น array ว่าง'}\n${includeBox ? '- เติมอุปกรณ์ในกล่องเฉพาะที่มีหลักฐานรองรับ' : '- boxContents และ notIncluded ให้เป็น array ว่าง'}`;

  const requestBody = {
    model: String(context.env.OPENAI_MODEL || 'gpt-5-mini'),
    tools: [{ type: 'web_search', search_context_size: 'medium' }],
    input: [
      { role: 'system', content: 'คุณคือ JARVIS ผู้ช่วยจัดทำฐานข้อมูลของสะสมไทย ให้ความสำคัญกับความถูกต้อง แหล่งอ้างอิง และไม่เดาข้อมูล ช่อง name ต้องใช้ชื่อรุ่นภาษาอังกฤษทางการเท่านั้น ห้ามใช้ชื่อภาษาไทย ตั้ง recommendedAge เป็น 15 ปีขึ้นไป สำหรับ heightCm ให้หาชื่อสินค้าภาษาญี่ปุ่นทางการก่อน แล้วใช้ชื่อนั้นค้นเฉพาะ bandai-hobby.net เพื่อยืนยันความสูงเมื่อประกอบ และเพิ่มหน้า Bandai Hobby ที่ใช้เป็นหลักฐานใน references' },
      { role: 'user', content: prompt }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'toyskub_catalog_item',
        strict: true,
        schema: catalogSchema
      }
    }
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI API HTTP ${response.status}`;
    return json({ ok: false, error: message }, response.status >= 500 ? 502 : 400);
  }

  const text = outputText(data);
  if (!text) return json({ ok: false, error: 'AI ไม่ได้ส่งข้อมูลกลับมา' }, 502);
  let item;
  try { item = JSON.parse(text); }
  catch { return json({ ok: false, error: 'รูปแบบข้อมูลจาก AI ไม่ถูกต้อง กรุณาลองใหม่' }, 502); }
  try { item = await resolveStaticCatalogIdentity(context.request, catalogLine, query, item); }
  catch { /* D1 lookup below remains authoritative when the static catalog is unavailable. */ }
  try { item = await resolveExistingCatalogIdentity(context.env.TOYSKUB_DB, catalogLine, query, item); }
  catch { /* AI data remains usable when the catalog lookup is temporarily unavailable. */ }
  try { item = await allocateNextCatalogIdentity(context.request, context.env.TOYSKUB_DB, catalogLine, item); }
  catch { /* The client will show its existing missing-id error if allocation is unavailable. */ }
  if (catalogLine === 'MG') item.sku = null;
  if (catalogLine === 'MGSD' && (!item.seriesGroup || item.seriesGroup === 'Gundam')) item.seriesGroup = 'MGSD';
  if (catalogLine === 'MG' && !item.seriesGroup) item.seriesGroup = item.series || 'ETC';
  item.series = normalizeCatalogSeries(item.series);
  item.name = normalizeCatalogName(item.name);
  item.recommendedAge = normalizeRecommendedAge();

  return json({ ok: true, item, responseId: data.id || null });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}
