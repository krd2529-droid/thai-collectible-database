THAI COLLECTIBLE DATABASE — ระบบแยก JSON รายสินค้า

FULL PACKAGE v10

ไฟล์ชุดนี้ใช้แทนเว็บไซต์เดิมได้ทั้งชุด มีหน้าหลัก ระบบหมวดหมู่
JSON รายสินค้าแยก rg-001.json ถึง rg-043.json และไฟล์รูป/คู่มือ
ของ RG40, RG41, RG42 และ RG43 แยกไว้ในโฟลเดอร์ของแต่ละสินค้าแล้ว
พร้อมหมวด MGSD และเลขแคตตาล็อกภายใน mgsd-001 ถึง mgsd-005

โครงสร้างข้อมูล

data/categories.json
  บอกเส้นทางของแต่ละหมวดและเกรด

data/catalog/gundam/gunpla/rg/index.json
  สารบัญย่อของสินค้า RG สำหรับสร้างการ์ดหน้าแคตตาล็อก

data/catalog/gundam/gunpla/rg/rg-001.json ถึง rg-043.json
  รายละเอียดเต็มของสินค้าแต่ละรายการ แยกหนึ่งสินค้าต่อหนึ่งไฟล์

images/gundam/gunpla/rg/rg-XXX/
  รูปแคตตาล็อก รูปสินค้า และรูปคู่มือของสินค้ารหัสนั้น

data/catalog/gundam/gunpla/mgsd/index.json
  สารบัญย่อของสินค้า MGSD รุ่นปกติ เรียงเลขภายในตามวันวางจำหน่าย

data/catalog/gundam/gunpla/mgsd/mgsd-001.json ถึง mgsd-005.json
  รายละเอียดตั้งต้นของ MGSD แต่ละรายการ รูปภาพจะเพิ่มภายหลัง

วิธีเพิ่มสินค้าใหม่ เช่น RG44

1. สร้าง data/catalog/gundam/gunpla/rg/rg-044.json
2. สร้างโฟลเดอร์ images/gundam/gunpla/rg/rg-044/
3. ใส่รูปจริงในโฟลเดอร์ดังกล่าว
4. เพิ่มข้อมูลย่อหนึ่งรายการใน data/catalog/gundam/gunpla/rg/index.json
5. ตรวจว่าชื่อรูปใน rg-044.json ตรงกับชื่อไฟล์จริงทุกตัว

ข้อห้าม

- ไม่มี products.json ก้อนรวมแล้ว
- ห้ามนำ JSON ของสินค้าเพียงตัวเดียวไปเปลี่ยนชื่อเป็น index.json
- ห้ามลบรายการเดิมออกจาก index.json ขณะเพิ่มสินค้าใหม่
- ชื่อไฟล์และตัวพิมพ์เล็ก-ใหญ่ต้องตรงกัน

ตรวจระบบอัตโนมัติ

ถ้ามี Node.js ให้เปิด Terminal ในโฟลเดอร์เว็บไซต์แล้วรัน:

node tools/validate-catalog.mjs

หากขึ้น PASS แปลว่าโครงสร้าง JSON ใช้งานได้
WARNING หมายถึง JSON ทำงานได้ แต่มีชื่อรูปที่ยังไม่พบไฟล์จริง
ERROR หมายถึงต้องแก้ก่อนอัปโหลด

ร้านค้า One Piece Card

- หน้าร้าน: /shop/
- หลังบ้าน: /admin/store/
- Migrations: migrations/0005_store_products_orders.sql, 0006_store_product_level.sql และ 0007_store_product_cost.sql
- Store API ตรวจและสร้างตาราง/ดัชนีที่ขาด รวมถึงเพิ่มคอลัมน์ level ให้ schema รุ่นเก่าอัตโนมัติก่อนใช้งาน
- รัน test: node --test tests/store.test.js
- ต้องรัน migration บน environment เป้าหมายก่อนเปิดใช้โค้ดร้านค้า
- คำสั่งซื้อเก็บข้อมูลจัดส่งใน D1 และแสดงเฉพาะ API หลังบ้านที่ตรวจสิทธิ์
