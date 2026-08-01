TOYSKUB Admin v2 Part 3 — Catalog Manager

เพิ่ม:
- /admin/catalog/ สำหรับเพิ่ม แก้ไข คัดลอก ลบ และเผยแพร่แคตตาล็อก
- เก็บรายการใหม่ใน D1 ตาราง catalog_items
- รายการสถานะ published แสดงรวมกับ RG เดิมบนหน้าเว็บทันที
- URL หน้าแคตตาล็อกยังเป็น /#/product/<id>
- รองรับ Shopee/Lazada Affiliate, YouTube, รูป, สรุป, จุดเด่น และข้อมูลหน้ารุ่น

วิธีติดตั้ง: วางทับโฟลเดอร์เดิม → Commit → Push → รอ Cloudflare Deploy
ไม่ต้องเพิ่ม Environment Variable ใหม่
