import { json } from '../../../lib/admin-auth.js';
import { ensureMemberTables, normalizeEmail, normalizePhone, isValidThaiPhone } from '../../../lib/members-db.js';
import { hashPassword } from '../../../lib/passwords.js';
import { createMemberSession } from '../../../lib/member-auth.js';
export async function onRequestPost(context) {
  const db=context.env.TOYSKUB_DB;if(!db)return json({ok:false,error:'ไม่พบฐานข้อมูล TOYSKUB_DB'},503);
  await ensureMemberTables(db);
  const body=await context.request.json().catch(()=>({}));
  const email=normalizeEmail(body.email),phone=normalizePhone(body.phone),firstName=String(body.firstName||'').trim(),lastName=String(body.lastName||'').trim(),password=String(body.password||'');
  if(!firstName)return json({ok:false,error:'กรุณากรอกชื่อ'},400);
  if(!/^\S+@\S+\.\S+$/.test(email))return json({ok:false,error:'อีเมลไม่ถูกต้อง'},400);
  if(!isValidThaiPhone(phone))return json({ok:false,error:'กรุณากรอกเบอร์มือถือไทย 10 หลัก'},400);
  if(password.length<8)return json({ok:false,error:'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'},400);
  const passwordData=await hashPassword(password);
  try{
    const result=await db.prepare(`INSERT INTO users(email,phone,first_name,last_name,display_name,password_hash,password_salt,password_iterations,role,status)
      VALUES(?,?,?,?,?,?,?,?, 'member','active')`).bind(email,phone,firstName,lastName,`${firstName} ${lastName}`.trim(),passwordData.hash,passwordData.salt,passwordData.iterations).run();
    const userId=Number(result.meta?.last_row_id);await db.prepare("INSERT INTO audit_logs(user_id,action,entity_type,entity_id) VALUES(?,'register','user',?)").bind(userId,String(userId)).run();
    return json({ok:true,user:{id:userId,email,phone,firstName,lastName,role:'member'}},201,{'set-cookie':await createMemberSession(db,userId)});
  }catch(error){const text=String(error).toLowerCase();if(text.includes('unique'))return json({ok:false,error:'อีเมลหรือเบอร์โทรนี้ถูกใช้งานแล้ว'},409);return json({ok:false,error:'สมัครสมาชิกไม่สำเร็จ'},500)}
}
export function onRequest(){return json({ok:false,error:'Method not allowed'},405)}
