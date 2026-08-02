import { isAuthorized, json } from '../../../lib/admin-auth.js';

const catalogSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id','sku','name','rgNumber','modelCode','manufacturer','series','scale','releaseDate',
    'launchPriceJPY','heightCm','recommendedAge','productType','material','seriesGroup','summary',
    'highlights','whatsDifferent','boxContents','notIncluded','pros','considerations','faq','references'
  ],
  properties: {
    id: { type: ['string','null'] },
    sku: { type: ['string','null'] },
    name: { type: ['string','null'] },
    rgNumber: { type: ['integer','null'] },
    modelCode: { type: ['string','null'] },
    manufacturer: { type: ['string','null'] },
    series: { type: ['string','null'] },
    scale: { type: ['string','null'] },
    releaseDate: { type: ['string','null'], description: 'YYYY-MM-DD when verified, otherwise null' },
    launchPriceJPY: { type: ['integer','null'], description: 'Japanese launch price before tax' },
    heightCm: { type: ['number','null'] },
    recommendedAge: { type: ['string','null'] },
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
    }
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
  const prompt = `ค้นคว้าข้อมูลสินค้าโมเดลของสะสมต่อไปนี้เพื่อกรอกฐานข้อมูล TOYSKUB: "${query}"\n\nกติกา:\n- เน้นข้อมูลทางการจาก Bandai Hobby Site / Bandai Spirits และใช้ Dalong.net เป็นแหล่งเสริมเมื่อเกี่ยวข้อง\n- ห้ามเดาข้อมูลเชิงข้อเท็จจริง ถ้ายืนยันไม่ได้ให้คืน null หรือ array ว่าง\n- ราคา launchPriceJPY ต้องเป็นราคาเปิดตัวญี่ปุ่นก่อนภาษี\n- releaseDate ใช้ YYYY-MM-DD เฉพาะเมื่อยืนยันวันได้\n- ถ้าเป็น Real Grade ให้ id เป็น rg-เลขสามหลัก เช่น rg-039 และ sku เป็น RG-039\n- seriesGroup เลือก Gundam, Evangelion, Gaogaigar, Patlabor หรือ Special Version ตามที่เหมาะสม\n- เขียนภาษาไทยอ่านง่าย ไม่โฆษณาเกินจริง\n- references ใส่เฉพาะ URL ที่ค้นพบจริง พร้อมชื่อเว็บไซต์\n- ไม่ต้องหา URL รูป คู่มือ YouTube Shopee Lazada TikTok หรือ Affiliate\n${includeEditorial ? '- สร้างจุดเด่น ข้อแตกต่าง ข้อดี ข้อควรพิจารณา และ FAQ จากข้อมูลที่รองรับ' : '- highlights, whatsDifferent, pros, considerations และ faq ให้เป็น array ว่าง'}\n${includeBox ? '- เติมอุปกรณ์ในกล่องเฉพาะที่มีหลักฐานรองรับ' : '- boxContents และ notIncluded ให้เป็น array ว่าง'}`;

  const requestBody = {
    model: String(context.env.OPENAI_MODEL || 'gpt-5-mini'),
    tools: [{ type: 'web_search', search_context_size: 'medium' }],
    input: [
      { role: 'system', content: 'คุณคือ JARVIS ผู้ช่วยจัดทำฐานข้อมูลของสะสมไทย ให้ความสำคัญกับความถูกต้อง แหล่งอ้างอิง และไม่เดาข้อมูล' },
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

  return json({ ok: true, item, responseId: data.id || null });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}
