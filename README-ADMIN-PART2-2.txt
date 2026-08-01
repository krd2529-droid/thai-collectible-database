TOYSKUB ADMIN V2 — PART 2.2 MEMBER & ROLE FOUNDATION

เพิ่มแล้ว:
- หน้าสมัคร/ล็อกอินสมาชิกที่ /member/
- สมัครด้วยชื่อ อีเมล เบอร์มือถือ และรหัสผ่าน
- เบอร์มือถือบังคับสำหรับผู้สมัครใหม่
- รหัสผ่านเข้ารหัส PBKDF2-SHA256 ไม่เก็บรหัสจริง
- Session cookie อายุ 30 วัน และเก็บ token แบบ hash ใน D1
- บทบาท: super_admin, admin, editor, member
- บัญชี ADMIN_EMAIL ถูกสร้าง/ยกระดับเป็น super_admin อัตโนมัติเมื่อเข้า Admin ครั้งแรก
- หน้า Admin มีรายชื่อสมาชิกและเบอร์โทร
- ตาราง users, member_sessions, audit_logs สร้างอัตโนมัติ
- Category API รองรับ session สมาชิกที่มีสิทธิ์ พร้อมคง ADMIN_PASSWORD เป็นทางสำรอง

ติดตั้ง:
1. แตก ZIP แล้ววางทุกไฟล์ทับโฟลเดอร์โปรเจกต์เดิม
2. Commit: Admin Part 2.2 members roles
3. Push origin และรอ Cloudflare Deploy Success
4. เข้า /admin/ และล็อกอินหนึ่งครั้ง เพื่อสร้างบัญชี super_admin
5. ทดสอบสมัครสมาชิกที่ /member/
6. กลับ /admin/ แล้วกด "เปิดรายชื่อสมาชิก"

ไม่ต้องเพิ่ม Environment Variable ใหม่
ใช้ TOYSKUB_DB, ADMIN_EMAIL และ ADMIN_PASSWORD เดิม
