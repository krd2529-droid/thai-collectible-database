# TOYSKUB System Audit

วันที่ตรวจ: 2026-08-19 (Asia/Bangkok)  
ขอบเขต: ตรวจแบบ read-only จาก working tree, Git history และไฟล์ที่ track อยู่ใน repository  
ข้อจำกัด: ไม่ได้เชื่อมต่อ Cloudflare production, D1, R2, DNS หรือค่าตัวแปรจริง จึงยังยืนยันสถานะระบบภายนอกไม่ได้

## 1. Baseline และจุดย้อนกลับ

- Repository: `thai-collectible-database`
- Branch: `main`
- HEAD: `31327a7ee0a911d51485beb5282d026c505e6e86` (`แก้บั๊ค`)
- Commit ก่อนหน้า: `9c8569333ad975f0152f2abff3e558e65e2b694a` (`เปิดปิด`)
- ขณะเริ่ม Audit: working tree สะอาด
- `origin/main` ชี้ที่ HEAD เดียวกัน แปลว่าแพตช์ `tools/validate-catalog.mjs` ถูก Push แล้วก่อนเริ่ม Audit รอบนี้
- ไม่มี Git tag จึงยังไม่มี release marker ที่อ่านง่าย

วิธีย้อนดูโดยไม่แก้ working tree:

```text
git show 31327a7ee0a911d51485beb5282d026c505e6e86
git diff 9c8569333ad975f0152f2abff3e558e65e2b694a..31327a7ee0a911d51485beb5282d026c505e6e86
```

การย้อนกลับจริงต้องทำผ่าน revert commit และต้องได้รับอนุมัติก่อน ห้ามใช้ `reset --hard` กับงานร่วมกัน

## 2. Production tree ที่อนุมานได้จากหลักฐาน

```text
index.html                 public entry point
app.js / style.css         visitor SPA และ UI หลัก
data/                      static catalog/category source
images/                    static media (มีจริงเด่นชัดเฉพาะ RG 040-043)
admin/                     admin UI, catalog manager, RG editor
member/                    member login/register UI
functions/api/             Cloudflare Pages Functions API
functions/lib/             auth, password, schema และ catalog helpers
functions/media/           public R2 media delivery
migrations/                D1 SQL migrations
tools/validate-catalog.mjs static RG catalog validator
_redirects                 SPA fallback: /* -> /index.html 200
```

หลักฐานชี้ว่า hosting คือ Cloudflare Pages/Pages Functions: รูปแบบโฟลเดอร์ `functions/`, D1 binding `TOYSKUB_DB`, R2 binding `TOYSKUB_MEDIA` และคำอธิบายในหน้า admin อย่างไรก็ตามไม่มี `wrangler.toml`, `package.json`, lockfile, CI config หรือ deploy script ใน repository จึงทำซ้ำ environment production จาก repo เพียงอย่างเดียวไม่ได้

Entry points ที่ยืนยันจากไฟล์:

- `/` และ `/product/:id` ใช้ `index.html` + `app.js`
- `/admin/` ใช้ `admin/index.html` + `admin/admin.js`
- `/admin/catalog/` ใช้ catalog manager
- `/admin/rg-template/` ใช้ editor แบบเต็ม
- `/member/` ใช้ member UI แต่ไม่พบลิงก์จากหน้า public หลัก
- `/api/**` และ `/media/**` มาจาก file-based Pages Functions

ข้อควรพิสูจน์บน staging: `_redirects` อาจ rewrite `/api/*` หรือ `/media/*` เป็น `index.html` หากลำดับ routing ของ platform/config จริงไม่ยก Functions ขึ้นก่อน ยังสรุปไม่ได้จาก repository อย่างเดียว

## 3. Data และ environment

แหล่งข้อมูลมีสองชุด:

1. Static: `data/categories.json`, RG index และ JSON รายสินค้า 43 ไฟล์
2. Dynamic: D1 ตาราง `catalog_items`, `categories`, `users`, `member_sessions`, `audit_logs`, `analytics_views`

หน้า public โหลด static ก่อน แล้ว merge รายการ published จาก D1 พร้อมใช้ D1 status เพื่อซ่อน static item บางรายการ จึงต้องมี contract ชัดเจนว่า field ใดชนะเมื่อข้อมูลชนกัน

Environment ที่อ้างถึงในโค้ด:

- Secret: `ADMIN_PASSWORD`, `OPENAI_API_KEY`
- Config: `ADMIN_EMAIL`, `OPENAI_MODEL`
- Binding: `TOYSKUB_DB` (D1), `TOYSKUB_MEDIA` (R2)

ไม่พบค่าจริงของ secret/token ในไฟล์ที่ track จากการค้นหาชื่อและรูปแบบที่เกี่ยวข้อง แต่ยังต้องใช้ secret scanner ใน CI และตรวจ Cloudflare dashboard ก่อน release

## 4. ผลการตรวจที่ทำได้

- `node --check tools/validate-catalog.mjs`: ผ่าน
- `node tools/validate-catalog.mjs`: PASS, index 43, detail JSON 43, error 0
- คำเตือนรูปหาย: 70 path โดยส่วนใหญ่เป็น RG 001-039
- `git diff --check`: ผ่าน ณ ก่อนเริ่มสร้างเอกสาร
- ไม่พบ test runner, unit test, integration test, browser test หรือ CI workflow
- ไม่ได้ทดสอบ D1/R2/API จริง เพราะไม่มี local binding/config และไม่ได้รับอนุญาตให้แตะ production

คำว่า PASS ของ validator หมายถึงโครงสร้าง JSON หลักผ่าน ไม่ได้หมายความว่าเว็บ/API/auth ทั้งระบบผ่าน

## 5. Risk register

### R-001 — Critical: ไม่มี regression test สำหรับ auth และ API

Admin, member, catalog mutation, media upload, AI fill และ analytics ไม่มี automated test ครอบคลุม การแก้เล็กน้อยจึงอาจกระทบ production โดยไม่รู้ตัว ต้องสร้าง local harness/mock D1 ก่อนพัฒนาฟีเจอร์ใหม่

### R-002 — High: database schema เปลี่ยนระหว่าง request

helpers หลายตัวเรียก `CREATE TABLE`, `ALTER TABLE` และ `CREATE INDEX` เมื่อมี request จริง ทำให้ latency, concurrency และสิทธิ์ production คาดการณ์ยาก อีกทั้ง `catalog-db.js` กลืน error ของ `ALTER TABLE` ทั้งหมด จึงแยก “column มีแล้ว” ออกจาก migration ล้มเหลวไม่ได้

### R-003 — High: migration history ไม่เป็นลำดับเดียว

มี `migrations/0003_analytics_views.sql` และ `migrations/0003_catalog_items.sql` ใช้หมายเลขเดียวกัน รวมถึง `0002_members_roles.sql` ซ้ำทั้ง root และ `migrations/` ขณะที่ schema ใน runtime helper มีรายละเอียดต่างจาก SQL บางส่วน ไม่มีไฟล์บอกว่า production ใช้ migration ใดแล้ว

### R-004 — High: deployment ทำซ้ำจาก repo ไม่ได้

ไม่มี Cloudflare project config, binding declaration, compatibility date, runtime version, install/test/deploy scripts หรือ CI checks การตั้งค่าจริงอาจอยู่เฉพาะ dashboard

### R-005 — High: admin login ไม่มี rate limit ที่เห็นใน repo

`POST /api/admin/login` เปรียบเทียบ shared password และไม่พบ rate limiting/lockout ในโค้ด นอกจากนี้การ login ด้วย shared password สามารถสร้างหรือยกระดับ user ที่ตรง `ADMIN_EMAIL` เป็น `super_admin` อัตโนมัติ พฤติกรรมนี้ควรแยกเป็น explicit bootstrap event และมี audit log

### R-006 — High: public analytics write ไม่มี abuse control

`POST /api/analytics/view` รับ `visitorId` จาก client และ insert ทุก request โดยไม่พบ rate limit, deduplication หรือ retention policy ผู้ใช้ภายนอกสามารถเพิ่มข้อมูลจำนวนมากและทำให้สถิติคลาดเคลื่อน/เพิ่มค่าใช้จ่าย D1 ได้ ส่วน `GET /api/analytics/stats` เปิด aggregate stats สู่ public โดยตั้งใจหรือไม่ยังไม่ระบุ

### R-007 — Medium: static/D1 merge contract ไม่ได้ทดสอบ

Public catalog ใช้ static เป็นฐานและ D1 เป็น overlay; `trash`, `deleted`, `hidden` ใน D1 ใช้ตัด static item ออก ถ้า payload JSON เสีย การ `JSON.parse` ใน public endpoints สามารถทำให้ endpoint ล้มทั้งชุดได้

### R-008 — Medium: category reorder ไม่ validate ชุดข้อมูล

Endpoint รับ integer IDs หลัง filter แล้ว update ทีละแถว ไม่มี transaction, duplicate check, existence check หรือ parent-scope check จึงเกิดลำดับซ้ำ/บางส่วนสำเร็จได้

### R-009 — Medium: catalog create คืน HTTP 409 สำหรับ database error ทุกชนิด

`POST /api/admin/catalog` คืน 409 ทั้ง unique conflict และ internal DB error ทำให้ client/monitor แยก input conflict จาก server failureไม่ได้

### R-010 — Medium: member/session lifecycle ยังไม่ครบ

มี session อายุ 30 วันและ update `last_seen_at` ทุก request แต่ไม่พบ cleanup job, revoke-all, password reset, email/phone verification flow, CSRF token หรือ policy การเปลี่ยน role ส่วน `audit_logs` ถูกเขียนเฉพาะ registration ที่ตรวจพบ

### R-011 — Medium: media lifecycle ไม่มี delete/garbage collection

R2 object ใช้ immutable URL และ timestamp key แต่ไม่พบ endpoint ลบรูปหรือเก็บกวาด orphan หลังแก้/ลบสินค้า อาจทำให้ storage โตต่อเนื่อง

### R-012 — Medium: UI หลักรวมศูนย์และมีสอง editor

`app.js` ประมาณ 1,318 บรรทัดและมี inline frontend editor ขณะที่ `admin/rg-template/` มี editor อีกชุดหนึ่ง ทำให้ field mapping และ validation มีโอกาส drift รวมถึงมี HTML string rendering หลายจุด แม้พบ helper escape แต่ต้องทดสอบ XSS ทุก field/URL sink

### R-013 — Medium: catalog validator ครอบคลุมไม่ครบ

เดิมตรวจเฉพาะ RG; ใน TOY-PATCH-002 ขยายให้ตรวจทุกเกรดที่ประกาศใน categories รวม `catalogImage` แล้ว แต่ยังไม่ตรวจ schema ทุก field, URL/path traversal, orphan JSON, sitemap consistency และ duplicate path คำเตือนรูปเดิม 70 รายการยังค้าง

### R-014 — Low/Medium: เอกสารและข้อความ UI ล้าสมัย

มี README แยกตาม Part/Version หลายไฟล์, admin cards บางใบยังบอก “พาร์ท 3-5” ทั้งที่ฟังก์ชันบางส่วนมีแล้ว และ placeholder ใน `app.js` ยังกล่าวถึง `data/products.json` ซึ่ง README ระบุว่าไม่มีไฟล์ก้อนรวมแล้ว

## 6. ข้อมูลจริง ข้อมูลทดสอบ และ privacy

- Static catalog และรูปใน repo ดูเป็นข้อมูลใช้งานจริง ไม่มี namespace สำหรับ fixture/test
- D1 มี email, phone, password hash/salt, role, status, session token hash และข้อมูลจัดส่งของคำสั่งซื้อ (ชื่อ เบอร์โทร ที่อยู่ หมายเหตุ) ซึ่งเป็นข้อมูลส่วนบุคคล/ข้อมูลรับรอง
- Analytics เก็บ persistent visitor ID จาก localStorage
- หน้าร้านแสดงบัญชีรับชำระที่เจ้าของกำหนดแบบ static; ไม่มีการเก็บเลขบัญชีลูกค้าหรือเชื่อม payment API
- ห้าม copy D1 production มาใช้ทดสอบโดยตรง ต้องสร้าง sanitized fixture และบัญชีทดสอบแยก
- ต้องกำหนด retention สำหรับ session, analytics และ audit logs พร้อม privacy notice/consent ตามบริบทจริงก่อนขยาย tracking

## 7. เกณฑ์ VisionD ที่นำมาใช้

ใช้ได้ทันที:

- evidence-first, ระบุ baseline/rollback, feature ID, impact boundary
- inspect → patch → test → diagnose → retest
- แยก test/production, ตรวจ secret/PII, ห้าม Push/Deploy โดยไม่มีคำสั่ง
- ห้ามลบ legacy code โดยไม่มี reference + route + history evidence

ต้องปรับให้เข้ากับ Toy:

- ใช้ Cloudflare Pages Functions, D1 และ R2 เป็นแกน ไม่สมมติ stack ของ VisionD
- รองรับ dual-source catalog ชั่วคราวจนกว่าจะตัดสิน source of truth
- catalog/media validation ต้องรวมไฟล์ภาพ, sitemap และ external references

ยังใช้ตรง ๆ ไม่ได้:

- naming/version/deployment rules เฉพาะ VisionD ที่ไม่มีหลักฐานใน repo นี้
- database หรือ customer/finance workflow ที่ Toy ยังไม่มี

## 8. คำตัดสินรอบ Audit

ระบบยังไม่ควรเริ่ม feature ใหญ่หรือ schema change จนทำ EC-001 ถึง EC-003 ใน `TOY-ROADMAP.md` เสร็จ อย่างไรก็ตาม public static catalog ตรวจโครงสร้างผ่านและสามารถใช้เป็น baseline สำหรับสร้าง characterization tests ได้ ห้ามตีความเอกสารนี้ว่า production health check เพราะยังไม่ได้เชื่อมต่อบริการจริง
