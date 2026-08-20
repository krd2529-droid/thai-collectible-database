const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});
export async function onRequestPost(context){
  const db=context.env.TOYSKUB_DB;
  if(!db)return json({ok:false,error:"ยังไม่ได้ผูก D1 binding ชื่อ TOYSKUB_DB"},503);
  const body=await context.request.json().catch(()=>({}));
  const pageId=String(body.pageId||"home").trim().slice(0,120);
  const visitorId=String(body.visitorId||"").trim().slice(0,120);
  if(!visitorId)return json({ok:false,error:"ไม่พบรหัสผู้เข้าชม"},400);
  try{
    await db.batch([
      db.prepare(`INSERT INTO analytics_daily(day,page_id,view_count) VALUES(date('now'),?,1) ON CONFLICT(day,page_id) DO UPDATE SET view_count=view_count+1`).bind(pageId),
      db.prepare(`INSERT INTO analytics_totals(page_id,view_count) VALUES(?,1) ON CONFLICT(page_id) DO UPDATE SET view_count=view_count+1`).bind(pageId)
    ]);
    return json({ok:true});
  }catch{return json({ok:false,error:"ตารางสรุป Traffic ยังไม่พร้อม กรุณารัน Migration 0008"},503);}
}
export function onRequest(){return json({ok:false,error:"Method not allowed"},405);}
