import { isAuthorized, json } from '../../../lib/admin-auth.js';

const catalogSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id','sku','name','rgNumber','mgsdNumber','modelCode','manufacturer','series','scale','releaseDate',
    'launchPriceJPY','heightCm','recommendedAge','productType','material','seriesGroup','summary',
    'highlights','whatsDifferent','boxContents','notIncluded','pros','considerations','faq','references','dalongPageUrl'
  ],
  properties: {
    id: { type: ['string','null'] },
    sku: { type: ['string','null'] },
    name: { type: ['string','null'], description: 'Official Gundam/model name in English only; do not use Thai script' },
    rgNumber: { type: ['integer','null'] },
    mgsdNumber: { type: ['integer','null'] },
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
  const catalogLine = String(body.catalogLine || 'RG').trim().toUpperCase() === 'MGSD' ? 'MGSD' : 'RG';
  const lineRule = catalogLine === 'MGSD'
    ? '- งานนี้เป็น MGSD เท่านั้น: id ใช้ mgsd-เลขสามหลัก เช่น mgsd-001, sku ใช้ MGSD-001, mgsdNumber ใส่ลำดับ, rgNumber เป็น null, scale เป็น Non-scale และห้ามนำข้อมูลรุ่น RG มาปะปน'
    : '- งานนี้เป็น Real Grade เท่านั้น: id ใช้ rg-เลขสามหลัก เช่น rg-039, sku ใช้ RG-039, rgNumber ใส่ลำดับ และ mgsdNumber เป็น null';
  const prompt = `ค้นคว้าข้อมูลสินค้า ${catalogLine} ต่อไปนี้เพื่อกรอกฐานข้อมูล TOYSKUB: "${query}"\n\nกติกา:\n- เน้นข้อมูลทางการจาก Bandai Hobby Site / Bandai Spirits และใช้ Dalong.net เป็นแหล่งเสริมเมื่อเกี่ยวข้อง\n${lineRule}\n- ห้ามเดาข้อมูลเชิงข้อเท็จจริง ถ้ายืนยันไม่ได้ให้คืน null หรือ array ว่าง\n- ราคา launchPriceJPY ต้องเป็นราคาเปิดตัวญี่ปุ่นก่อนภาษี\n- releaseDate ใช้ YYYY-MM-DD เฉพาะเมื่อยืนยันวันได้\n- series ต้องเป็นชื่อซีรีส์/ผลงานต้นทางที่ตัวหุ่นปรากฏ เช่น Mobile Suit Gundam SEED หรือ Mobile Suit Gundam: Iron-Blooded Orphans เท่านั้น ห้ามใส่ชื่อเกรดสินค้า RG, Real Grade, MGSD หรือคำว่า Gundam ลอย ๆ\n- grade ของหน้านี้กำหนดจาก catalogLine อยู่แล้ว จึงห้ามนำชื่อเกรดไปกรอกซ้ำใน series\n- seriesGroup เลือก Gundam หรือ Special Version สำหรับ MGSD; ส่วน RG เลือก Gundam, Evangelion, Gaogaigar, Patlabor หรือ Special Version ตามที่เหมาะสม\n- เขียนภาษาไทยอ่านง่าย ไม่โฆษณาเกินจริง\n- references ใส่เฉพาะ URL ที่ค้นพบจริง พร้อมชื่อเว็บไซต์\n- หา Dalong Information URL ที่ตรงรุ่นและลงท้าย _i.htm ใส่ dalongPageUrl; MGSD อยู่ในหมวด /reviews/sd/mgsdXX/ ส่วน RG อยู่ใน /reviews/rg/rgXX/; ถ้ายืนยันไม่ได้ให้คืน null\n- ไม่ต้องเดา URL รูปโดยตรง ระบบจะตรวจและนำเข้ารูปปกกับคู่มือจากหน้า Dalong เอง\n- ไม่ต้องหา YouTube Shopee Lazada TikTok หรือ Affiliate\n${includeEditorial ? '- สร้างจุดเด่น ข้อแตกต่าง ข้อดี ข้อควรพิจารณา และ FAQ จากข้อมูลที่รองรับ' : '- highlights, whatsDifferent, pros, considerations และ faq ให้เป็น array ว่าง'}\n${includeBox ? '- เติมอุปกรณ์ในกล่องเฉพาะที่มีหลักฐานรองรับ' : '- boxContents และ notIncluded ให้เป็น array ว่าง'}`;

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
  item.series = normalizeCatalogSeries(item.series);
  item.name = normalizeCatalogName(item.name);
  item.recommendedAge = normalizeRecommendedAge();

  return json({ ok: true, item, responseId: data.id || null });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}
