import { isAuthorized, json } from "../../../../lib/admin-auth.js";
import { ensureCategoriesTable } from "../../../../lib/categories-db.js";

function slugify(v){return String(v||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
async function upsert(db,{name,slug,parentId,nodeType,sortOrder,sourcePath=""}){
  const existing=await db.prepare("SELECT id FROM categories WHERE slug=?").bind(slug).first();
  if(existing?.id){await db.prepare("UPDATE categories SET name=?,parent_id=?,node_type=?,sort_order=?,source_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name,parentId,nodeType,sortOrder,sourcePath,existing.id).run();return Number(existing.id)}
  const result=await db.prepare("INSERT INTO categories(name,slug,parent_id,node_type,sort_order,source_path,is_active) VALUES(?,?,?,?,?,?,1)").bind(name,slug,parentId,nodeType,sortOrder,sourcePath).run();return Number(result.meta?.last_row_id)
}
export async function onRequestPost(context){
  if(!(await isAuthorized(context.request,context.env)))return json({ok:false,error:"กรุณาเข้าสู่ระบบใหม่"},401);
  const db=context.env.TOYSKUB_DB;if(!db)return json({ok:false,error:"ไม่พบ TOYSKUB_DB"},503);await ensureCategoriesTable(db);
  const url=new URL("/data/categories.json",context.request.url);const response=await fetch(url.toString(),{headers:{"cache-control":"no-cache"}});if(!response.ok)return json({ok:false,error:"อ่าน data/categories.json ไม่สำเร็จ"},502);
  const data=await response.json();let count=0;let catOrder=1;
  for(const [catKey,cat] of Object.entries(data||{})){
    const catId=await upsert(db,{name:cat.label||catKey,slug:slugify(catKey),parentId:null,nodeType:"category",sortOrder:catOrder++});count++;
    let typeOrder=1;
    for(const [typeKey,type] of Object.entries(cat.productTypes||{})){
      const typeId=await upsert(db,{name:type.label||typeKey,slug:`${slugify(catKey)}-${slugify(typeKey)}`,parentId:catId,nodeType:"product_type",sortOrder:typeOrder++});count++;
      let gradeOrder=1;
      for(const [grade,path] of Object.entries(type.grades||{})){
        await upsert(db,{name:grade,slug:`${slugify(catKey)}-${slugify(typeKey)}-${slugify(grade)}`,parentId:typeId,nodeType:"grade",sortOrder:gradeOrder++,sourcePath:path});count++;
      }
    }
  }
  return json({ok:true,count,message:`นำเข้า/อัปเดต ${count} รายการเรียบร้อย`});
}
