const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

async function ensureTables(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS analytics_views(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_views_date ON analytics_views(viewed_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_views_page ON analytics_views(page_id)`).run();
}

export async function onRequestPost(context){
  if(!context.env.TOYSKUB_DB) return json({ok:false,error:"ยังไม่ได้ผูก D1 binding ชื่อ TOYSKUB_DB"},503);
  const body=await context.request.json().catch(()=>({}));
  const pageId=String(body.pageId||"home").trim().slice(0,120);
  const visitorId=String(body.visitorId||"").trim().slice(0,120);
  if(!visitorId) return json({ok:false,error:"ไม่พบรหัสผู้เข้าชม"},400);
  await ensureTables(context.env.TOYSKUB_DB);
  await context.env.TOYSKUB_DB.prepare(
    "INSERT INTO analytics_views(page_id,visitor_id,viewed_at) VALUES(?,?,CURRENT_TIMESTAMP)"
  ).bind(pageId,visitorId).run();
  return json({ok:true});
}

export function onRequest(){return json({ok:false,error:"Method not allowed"},405);}
