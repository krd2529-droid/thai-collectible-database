import { withRollupSchema } from '../../lib/analytics-db.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"public, max-age=60, stale-while-revalidate=300"}});
export async function onRequestGet(context){
  const db=context.env.TOYSKUB_DB;
  if(!db)return json({ok:false,error:"ยังไม่ได้ผูก D1 binding ชื่อ TOYSKUB_DB"},503);
  const pageId=String(new URL(context.request.url).searchParams.get("pageId")||"").trim().slice(0,120);
  try{
    const [recent,total,page]=await withRollupSchema(db,()=>Promise.all([
      db.prepare(`SELECT COALESCE(SUM(CASE WHEN day=date('now') THEN view_count ELSE 0 END),0) AS today,COALESCE(SUM(CASE WHEN day>=date('now','-6 days') THEN view_count ELSE 0 END),0) AS sevenDays,COALESCE(SUM(view_count),0) AS thirtyDays FROM analytics_daily WHERE day>=date('now','-29 days')`).first(),
      db.prepare("SELECT COALESCE(SUM(view_count),0) AS total FROM analytics_totals").first(),
      pageId?db.prepare("SELECT view_count AS count FROM analytics_totals WHERE page_id=?").bind(pageId).first():Promise.resolve(null)
    ]));
    return json({ok:true,today:Number(recent?.today||0),sevenDays:Number(recent?.sevenDays||0),thirtyDays:Number(recent?.thirtyDays||0),total:Number(total?.total||0),pageViews:Number(page?.count||0)});
  }catch{return json({ok:false,error:"โหลดสรุป Traffic ไม่สำเร็จ"},503);}
}
export function onRequest(){return json({ok:false,error:"Method not allowed"},405);}
