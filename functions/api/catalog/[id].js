import { json } from '../../lib/admin-auth.js';
import { ensureCatalogTables } from '../../lib/catalog-db.js';
export async function onRequestGet(c){if(!c.env.TOYSKUB_DB)return json({ok:false,error:'ไม่พบฐานข้อมูล'},404);await ensureCatalogTables(c.env.TOYSKUB_DB);const r=await c.env.TOYSKUB_DB.prepare(`SELECT payload_json FROM catalog_items WHERE id=? AND status='published'`).bind(c.params.id).first();if(!r)return json({ok:false,error:'ไม่พบรายการ'},404);return json(JSON.parse(r.payload_json))}
