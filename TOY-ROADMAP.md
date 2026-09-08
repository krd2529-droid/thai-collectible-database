# TOYSKUB Recovery and Development Roadmap

Baseline: `31327a7ee0a911d51485beb5282d026c505e6e86`  
หลักเรียงงาน: ลดโอกาสข้อมูล/สิทธิ์เสียก่อน แล้วจึงลด drift และเริ่ม feature ใหม่

## Phase 0 — Freeze and reproduce

### TOY-EC-001: สร้าง local verification harness (Critical)

เป้าหมาย: ทำให้ API/auth/catalog behavior ปัจจุบันถูกทดสอบซ้ำได้โดยไม่แตะ production

- เพิ่ม project manifest + pinned runtime/test command
- mock D1/R2/environment และสร้าง synthetic fixtures
- characterization tests สำหรับ public catalog, admin guard, member auth และ status rules
- บันทึก Cloudflare runtime/binding contract โดยไม่เก็บ secret
- ห้ามเปลี่ยน business behavior ใน Event Case นี้

ผ่านเมื่อ: clone ใหม่สามารถติดตั้งและรัน test/validator ได้ด้วยคำสั่งที่บันทึกไว้ และไม่มี production data ใน fixture

### TOY-EC-002: ทำ migration baseline ให้เป็นหนึ่งเดียว (High)

เป้าหมาย: แยก schema deployment ออกจาก request path อย่างปลอดภัย

- inventory schema จริงบน staging/production แบบ read-only หลังได้รับอนุญาต
- แก้เลข migration ซ้ำและทำ migration ledger
- ทดสอบ fresh + upgrade path
- เปลี่ยน runtime ensure helpers ให้ตรวจ readiness โดยไม่กลืน migration error

ผ่านเมื่อ: schema ใหม่สร้าง/upgrade ซ้ำได้ และ request ปกติไม่ทำ `ALTER TABLE`

### TOY-EC-003: สร้าง release/config contract (High)

เป้าหมาย: ทำ staging/release ซ้ำได้จาก repository

- บันทึก Cloudflare Pages settings, compatibility date, D1/R2 bindings และ variables
- เพิ่ม CI gates: tests, catalog validation, secret scan, diff/static checks
- กำหนด tag/version และ rollback checklist
- ยังไม่ Deploy production จนได้รับคำสั่ง

ผ่านเมื่อ: staging deploy จาก documented config ได้และ smoke test ผ่าน

## Phase 1 — Secure data and access

### TOY-EC-004: Admin authentication hardening (High)

- rate limit/backoff login
- แยก owner bootstrap ออกจาก login ปกติ
- เพิ่ม audit events และ negative tests
- ตัดสิน CSRF policy สำหรับ cookie-authenticated mutations

### TOY-EC-005: Analytics abuse/privacy controls (High)

- ระบุว่า stats public หรือ admin-only
- เปลี่ยน Traffic analytics เป็น daily rollup เพื่อลด D1 rows read และหยุด schema DDL บน request path (เสร็จใน Migration 0008)
- เพิ่ม Auto Catalog Draft สำหรับ RG: AI เติมข้อมูลและ Dalong URL, backend ตรวจ host แล้วนำเข้ารูปปก/คู่มือเข้า R2 โดยไม่ Publish อัตโนมัติ
- เพิ่ม MGSD Template แยกที่ `/admin/mgsd-template/` โดยใช้ editor/Auto Catalog ชุดร่วม แต่บังคับรหัส `mgsd-*`, เกรด MGSD, Non-scale และ Dalong หมวด SD
- dedupe/rate limit ingestion, validation และ retention cleanup
- privacy notice/consent decision สำหรับ persistent visitor ID
- load/abuse tests บน staging

### TOY-EC-006: Member lifecycle baseline (High)

- login/register rate limit
- verification/reset/revoke session policy
- session cleanup และ role-change audit
- จำกัดผู้ดู member list ตาม permission matrix

## Phase 2 — Protect catalog operations

### TOY-EC-007: Static/D1 catalog contract (Medium/High)

- ระบุ source of truth และ field precedence
- test published/hidden/trash/deleted/static fallback/corrupt payload
- ทำ error handling ไม่ให้ JSON เสียหนึ่งรายการล้มทั้ง catalog
- กำหนด clear-field semantics ใน merge

### TOY-EC-008: Atomic category/catalog mutations (Medium)

- validate reorder IDs, duplicate, existence และ parent scope
- ใช้ batch/transaction หรือคืน partial failure ชัดเจน
- แก้ HTTP status catalog create ให้ตรงประเภท error

### TOY-EC-009: Media lifecycle (Medium)

- verify actual file signature/dimensions server-side ตามความสามารถ runtime
- quota/limit และ orphan report
- safe delete/retention policy โดยไม่ลบ object เดิมจนได้รับอนุมัติ
- test Dalong redirects, timeout และ partial import

## Phase 3 — Consolidate product experience

### TOY-EC-010: Editor contract consolidation (Medium)

- สร้าง shared payload schema/validation
- ทำ field parity tests ระหว่าง inline editor กับ full RG editor
- ตรวจ XSS/URL validation และ double-submit states
- ยังไม่ลบ editor ใดจนมี usage evidence และอนุมัติ

### TOY-EC-011: Responsive/accessibility design standard (Medium)

- audit หน้า public/admin/member ที่ 320/375/768/1280 px
- keyboard, focus, dialog, labels, alt text, contrast และ error states
- ทำ component naming/style direction โดยรักษาหน้าตาปัจจุบันเป็น baseline

### TOY-EC-012: Catalog completeness and SEO (Medium)

- ขยาย validator ไป MG/HG, full schema, catalogImage, orphan files และ sitemap
- ตัดสินการจัดการ warning รูปหาย 70 path โดยไม่สร้าง/ลบไฟล์จากการเดา
- ทำ sitemap generation รองรับ published D1 items

### TOY-EC-013: MGSD catalog foundation (Completed in TOY-PATCH-002)

- เพิ่ม MGSD เป็นเกรดภายใต้ Gundam → Gunpla
- กำหนดเลขภายใน MGSD-001 ถึง MGSD-005 ตามวันวางจำหน่ายรุ่นปกติ
- เพิ่ม index/detail JSON และ sitemap routes
- เปลี่ยน public loader และ validator จาก RG-only เป็น multi-grade

### TOY-EC-014: One Piece Card storefront and order flow (Completed in TOY-PATCH-003)

- เพิ่มหน้าร้าน One Piece Card แบบ responsive แยกจากหมวดและข้อมูลแคตตาล็อกโดยชัดเจน

### TOY-EC-016: Store category expansion (Completed)

- เพิ่มหมวด `ของเล่น` ในสินค้าในร้านที่ `/stock/toys/` โดยไม่ย้ายหรือปะปนสินค้าการ์ดวันพีชเดิม
- หลังบ้านเลือกหมวดสินค้าได้ และหน้ารวม/หน้ารายละเอียดสร้าง URL ตามหมวดที่เลือก
- API หน้าบ้านกรองสินค้าด้วย category เพื่อรองรับการเพิ่มหมวดร้านในอนาคต
- หมวดของเล่นรองรับรูป ชื่อ ยี่ห้อ จำนวน ราคาขาย และราคาทุน โดยไม่เปิดเผยราคาทุนใน public API/หน้าร้าน
- เพิ่มสินค้า ราคา stock รูป และสถานะในหลังบ้าน
- เพิ่ม checkout, ข้อมูลจัดส่ง, บัญชีธนาคาร และ handoff ไป Facebook
- ใช้ pending/payment_review เป็น reservation และหัก stock เฉพาะ paid
- stock พร้อมขาย 0 แสดง Sold out และป้องกัน oversell/idempotent duplicate request
- เพิ่ม migration 0005 และ integration tests ด้วยฐาน SQLite ชั่วคราว

## Phase 4 — Product growth (หลัง safety gates)

เริ่มได้เมื่อ Phase 0-2 ผ่าน:

- member profile/collection/wishlist ตาม requirement จริง
- search/filter ที่วัดผลได้
- editorial/affiliate workflow พร้อม disclosure
- AI-assisted catalog ที่มี human review และ source verification

ห้ามเริ่ม payment/customer financial workflow ก่อนมี threat model, data owner, compliance และ acceptance criteria แยก

## Suggested first implementation order

1. TOY-EC-001 — test harness
2. TOY-EC-002 — migration baseline
3. TOY-EC-003 — release/config contract
4. TOY-EC-004 — admin auth
5. TOY-EC-005 — analytics controls
6. TOY-EC-007 — catalog source contract
7. TOY-EC-008 — atomic mutations
8. TOY-EC-006 — member lifecycle
9. TOY-EC-009 ถึง 012

## Definition of Done ต่อ Event Case

- scope และ out-of-scope ระบุครบ
- baseline/rollback ระบุครบ
- test ล้มก่อนแก้เมื่อเป็น bug และผ่านหลังแก้
- targeted + regression gates ผ่าน
- diff ไม่มี secret/PII/fixture production
- เอกสาร feature/API/schema อัปเดตตามจริง
- สรุป patch version แล้ว Commit และ Push ทันทีเมื่อ test/review ผ่าน ตาม TOY-PROTOCOL/1.1
- Deploy เป็นสถานะแยกและต้องได้รับคำสั่งเฉพาะ

### TOY-EC-017: Database read slimming (Completed)

- เอา schema creation/probe ออกจาก public catalog และ store read path; schema ใช้ migrations/admin mutation path
- แยก query catalog เป็น published payload กับ compact excluded IDs เพื่อไม่อ่าน payload ของ draft/hidden/trash/deleted เกินจำเป็น
- เปิด short-lived HTTP cache สำหรับ public catalog, detail และ stock โดย order API ยังตรวจ stock จริงก่อนรับคำสั่งซื้อ

### TOY-EC-018: Admin read slimming (Completed)

- ตัด schema creation/probe ออกจาก admin GET ของ catalog, store products, orders, categories และ members
- session auth ตรวจว่ามี member cookie ก่อน query D1 และไม่สร้าง schema ใน read path
- catalog list คืนเฉพาะฟิลด์รายการและ gallery flag จาก SQL แทนการส่ง/parse payload JSON เต็ม
