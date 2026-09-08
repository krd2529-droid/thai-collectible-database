const HEADERS={
  'content-type':'application/json; charset=UTF-8',
  'cache-control':'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:status===200?HEADERS:{...HEADERS,'cache-control':'no-store'}
});
export async function onRequestGet(c){
  if(!c.env.TOYSKUB_DB)return json({ok:false,error:'ไม่พบฐานข้อมูล'},404);
  try{
    const r=await c.env.TOYSKUB_DB.prepare(`SELECT payload_json FROM catalog_items WHERE id=? AND status='published'`).bind(c.params.id).first();
    if(!r)return json({ok:false,error:'ไม่พบรายการ'},404);
    return json(JSON.parse(r.payload_json));
  }catch{return json({ok:false,error:'โหลดรายการไม่สำเร็จ'},503)}
}
