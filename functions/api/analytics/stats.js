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

export async function onRequestGet(context){
  if(!context.env.TOYSKUB_DB) return json({ok:false,error:"ยังไม่ได้ผูก D1 binding ชื่อ TOYSKUB_DB"},503);
  const db=context.env.TOYSKUB_DB;
  await ensureTables(db);
  const url=new URL(context.request.url);
  const pageId=String(url.searchParams.get("pageId")||"").trim().slice(0,120);
  const row=await db.prepare(`SELECT
    COUNT(DISTINCT CASE WHEN viewed_at >= datetime('now','start of day') THEN visitor_id END) AS today,
    COUNT(DISTINCT CASE WHEN viewed_at >= datetime('now','-6 days','start of day') THEN visitor_id END) AS sevenDays,
    COUNT(DISTINCT CASE WHEN viewed_at >= datetime('now','-29 days','start of day') THEN visitor_id END) AS thirtyDays,
    COUNT(DISTINCT visitor_id) AS total
    FROM analytics_views`).first();
  let pageViews=0;
  if(pageId){
    const page=await db.prepare("SELECT COUNT(*) AS count FROM analytics_views WHERE page_id=?").bind(pageId).first();
    pageViews=Number(page?.count||0);
  }
  return json({
    ok:true,
    today:Number(row?.today||0),
    sevenDays:Number(row?.sevenDays||0),
    thirtyDays:Number(row?.thirtyDays||0),
    total:Number(row?.total||0),
    pageViews
  });
}

export function onRequest(){return json({ok:false,error:"Method not allowed"},405);}
