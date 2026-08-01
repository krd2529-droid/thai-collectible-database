TOYSKUB ADMIN PANEL v2

ไฟล์นี้ใช้แทน Admin Part 1 เดิม และไม่ต้องตั้ง Cloudflare Access

หลังวางไฟล์ทับและ Commit/Push:
1) Cloudflare > Settings > Variables and secrets
2) เพิ่มตัวแปร Type: Text
3) Variable name: ADMIN_PASSWORD
4) Value: ตั้งรหัสผ่านของตัวเอง (ใส่เฉพาะรหัสผ่าน ไม่ต้องใส่คำว่า Value:)
5) Save
6) Redeploy ล่าสุดหนึ่งครั้ง
7) เปิด https://toyskub.com/admin/

ADMIN_EMAIL เก็บไว้ได้ ระบบใช้แสดงชื่อแอดมิน แต่การล็อกอินใช้ ADMIN_PASSWORD
