import { createSessionCookie, getAdminPassword, json } from "../../lib/admin-auth.js";
import { ensureMemberTables, normalizeEmail } from "../../lib/members-db.js";
import { hashPassword } from "../../lib/passwords.js";

export async function onRequestPost(context) {
  const configuredPassword = getAdminPassword(context.env);
  if (!configuredPassword) return json({ ok:false, error:"ยังไม่ได้ตั้งค่า ADMIN_PASSWORD ใน Cloudflare" },503);
  const body = await context.request.json().catch(()=>({}));
  const password = String(body.password || "");
  if (password !== configuredPassword) return json({ ok:false, error:"รหัสผ่านไม่ถูกต้อง" },401);

  // สร้างบัญชีเจ้าของเว็บเป็น super_admin อัตโนมัติครั้งแรก โดยไม่กระทบระบบล็อกอินเดิม
  if (context.env.TOYSKUB_DB) {
    const db=context.env.TOYSKUB_DB; await ensureMemberTables(db);
    const email=normalizeEmail(context.env.ADMIN_EMAIL);
    if(email){
      const existing=await db.prepare("SELECT id,role FROM users WHERE email=?").bind(email).first();
      if(!existing){
        const p=await hashPassword(configuredPassword);
        await db.prepare(`INSERT INTO users(email,phone,first_name,last_name,display_name,password_hash,password_salt,password_iterations,role,status,email_verified)
          VALUES(?,NULL,'เจ้าของ','TOYSKUB','เจ้าของ TOYSKUB',?,?,?,'super_admin','active',1)`).bind(email,p.hash,p.salt,p.iterations).run();
      }else if(existing.role!=="super_admin"){
        await db.prepare("UPDATE users SET role='super_admin',status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(existing.id).run();
      }
    }
  }
  const cookie = await createSessionCookie(configuredPassword);
  return json({ ok:true },200,{ "set-cookie":cookie });
}
export function onRequest(){return json({ok:false,error:"Method not allowed"},405)}
