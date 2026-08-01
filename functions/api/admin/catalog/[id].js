import { isAuthorized, json } from '../../../lib/admin-auth.js';
import { ensureCatalogTables, normalizeCatalogInput, mergeCatalogPayload, loadStaticCatalogItem } from '../../../lib/catalog-db.js';
async function guard(c){if(!(await isAuthorized(c.request,c.env)))return json({ok:false,error:'กรุณาเข้าสู่ระบบใหม่'},401);if(!c.env.TOYSKUB_DB)return json({ok:false,error:'ไม่พบ D1 binding ชื่อ TOYSKUB_DB'},503);return null}
export async function onRequestGet(c){
  const d=await guard(c);if(d)return d;
  await ensureCatalogTables(c.env.TOYSKUB_DB);
  const r=await c.env.TOYSKUB_DB.prepare('SELECT payload_json FROM catalog_items WHERE id=?').bind(c.params.id).first();
  if(r?.payload_json)return json({ok:true,item:JSON.parse(r.payload_json),source:'d1'});
  const staticItem=await loadStaticCatalogItem(c.request,c.params.id);
  if(!staticItem)return json({ok:false,error:'ไม่พบรายการ'},404);
  const item=normalizeCatalogInput({...staticItem,id:c.params.id,status:staticItem.status||'published',catalogStatus:staticItem.catalogStatus||'published'});
  return json({ok:true,item,source:'static'});
}
export async function onRequestPut(c){
  const d=await guard(c);if(d)return d;
  await ensureCatalogTables(c.env.TOYSKUB_DB);
  const raw=await c.request.json().catch(()=>({}));
  const current=await c.env.TOYSKUB_DB.prepare('SELECT payload_json FROM catalog_items WHERE id=?').bind(c.params.id).first();
  const staticBase=await loadStaticCatalogItem(c.request,c.params.id)||{};
  const existing=current?.payload_json?JSON.parse(current.payload_json):staticBase;
  const p=normalizeCatalogInput(mergeCatalogPayload(existing,{...raw,id:c.params.id}));
  const dbName=p.name||'ยังไม่ระบุชื่อ';
  await c.env.TOYSKUB_DB.prepare(`INSERT INTO catalog_items(id,name,sku,category,category_label,category_code,product_type,product_type_code,grade,line,line_code,scale,series,manufacturer,catalog_image,status,sort_order,payload_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,sku=excluded.sku,category=excluded.category,category_label=excluded.category_label,category_code=excluded.category_code,product_type=excluded.product_type,product_type_code=excluded.product_type_code,grade=excluded.grade,line=excluded.line,line_code=excluded.line_code,scale=excluded.scale,series=excluded.series,manufacturer=excluded.manufacturer,catalog_image=excluded.catalog_image,status=excluded.status,sort_order=excluded.sort_order,payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP`)
    .bind(p.id,dbName,p.sku,p.category,p.categoryLabel,p.categoryCode,p.productType,p.productTypeCode,p.grade,p.line,p.lineCode,p.scale,p.series,p.manufacturer,p.catalogImage,p.status,p.sortOrder,JSON.stringify(p)).run();
  return json({ok:true,item:p});
}
export async function onRequestDelete(c){const d=await guard(c);if(d)return d;await ensureCatalogTables(c.env.TOYSKUB_DB);const permanent=new URL(c.request.url).searchParams.get('permanent')==='1';const current=await c.env.TOYSKUB_DB.prepare('SELECT payload_json FROM catalog_items WHERE id=?').bind(c.params.id).first();const staticBase=await loadStaticCatalogItem(c.request,c.params.id)||{};const existing=current?.payload_json?JSON.parse(current.payload_json):staticBase;if(permanent){const tombstone={id:c.params.id,name:existing.name||'',status:'deleted',catalogStatus:'deleted',deletedAt:new Date().toISOString()};await c.env.TOYSKUB_DB.prepare(`INSERT INTO catalog_items(id,name,sku,category,category_label,category_code,product_type,product_type_code,grade,line,line_code,scale,series,manufacturer,catalog_image,status,sort_order,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,status='deleted',catalog_image='',payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP`).bind(c.params.id,tombstone.name||'ลบแล้ว',existing.sku||c.params.id.toUpperCase(),existing.category||'model',existing.categoryLabel||'Gundam',existing.categoryCode||'gd',existing.productType||'Gunpla',existing.productTypeCode||'gp',existing.grade||'RG',existing.line||'RG',existing.lineCode||'rg',existing.scale||'',existing.series||'',existing.manufacturer||'', '', 'deleted', Number(existing.sortOrder)||Number(existing.rgNumber)||0, JSON.stringify(tombstone)).run();return json({ok:true,status:'deleted'})}const p=normalizeCatalogInput(mergeCatalogPayload(existing,{id:c.params.id,status:'trash',catalogStatus:'trash'}));await c.env.TOYSKUB_DB.prepare(`INSERT INTO catalog_items(id,name,sku,category,category_label,category_code,product_type,product_type_code,grade,line,line_code,scale,series,manufacturer,catalog_image,status,sort_order,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status='trash',payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP`).bind(p.id,p.name||'ยังไม่ระบุชื่อ',p.sku,p.category,p.categoryLabel,p.categoryCode,p.productType,p.productTypeCode,p.grade,p.line,p.lineCode,p.scale,p.series,p.manufacturer,p.catalogImage,'trash',p.sortOrder,JSON.stringify(p)).run();return json({ok:true,status:'trash'})}
