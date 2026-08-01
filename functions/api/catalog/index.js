import { json } from '../../lib/admin-auth.js';
import { ensureCatalogTables, summaryFromPayload } from '../../lib/catalog-db.js';
export async function onRequestGet(c){if(!c.env.TOYSKUB_DB)return json({ok:true,items:[]});await ensureCatalogTables(c.env.TOYSKUB_DB);const r=await c.env.TOYSKUB_DB.prepare(`SELECT payload_json FROM catalog_items WHERE status='published' ORDER BY sort_order,id`).all();return json({ok:true,items:(r.results||[]).map(x=>summaryFromPayload(JSON.parse(x.payload_json)))})}
