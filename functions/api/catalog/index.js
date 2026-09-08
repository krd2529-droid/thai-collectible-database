import { summaryFromPayload } from '../../lib/catalog-db.js';

const HEADERS={
  'content-type':'application/json; charset=UTF-8',
  'cache-control':'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:status===200?HEADERS:{...HEADERS,'cache-control':'no-store'}
});

export async function onRequestGet(c){
  if(!c.env.TOYSKUB_DB)return json({ok:true,items:[],excludedIds:[]});
  try{
    const [published,excluded]=await Promise.all([
      c.env.TOYSKUB_DB.prepare(`SELECT payload_json FROM catalog_items WHERE status='published' ORDER BY sort_order,id`).all(),
      c.env.TOYSKUB_DB.prepare(`SELECT id FROM catalog_items WHERE status IN ('trash','deleted','hidden') ORDER BY id`).all()
    ]);
    const items=[];
    for(const row of published.results||[]){
      try{items.push(summaryFromPayload(JSON.parse(row.payload_json)))}catch{}
    }
    return json({ok:true,items,excludedIds:(excluded.results||[]).map(row=>row.id).filter(Boolean)});
  }catch{return json({ok:false,error:'Catalog unavailable'},503)}
}
