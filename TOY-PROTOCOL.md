# TOYSKUB Development Protocol

Protocol version: `TOY-PROTOCOL/1.0-draft`  
สถานะ: ใช้ควบคุมงานใหม่ได้ทันที แต่ deployment gate ต้องยืนยันกับเจ้าของระบบ

## 1. หลักบังคับ

1. ใช้หลักฐานจาก code, route, Git, test และ environment ที่ตรวจได้ ห้ามเดา production state
2. หนึ่ง Event Case มีหนึ่งเป้าหมายและ impact boundary ชัดเจน
3. ห้ามแก้ไฟล์นอก boundary โดยไม่หยุดและขยายขอบเขตอย่างเปิดเผย
4. ห้ามลบ/แทน legacy code เพราะค้นชื่อไม่พบเพียงอย่างเดียว ต้องตรวจ import, HTML, route, dynamic reference, data และ Git history
5. ห้าม Commit จน test gate ผ่านและผู้ใช้อนุญาต; ห้าม Push/Deploy จนได้รับคำสั่งเฉพาะ
6. ห้ามใส่ secret, token, production cookie, PII หรือ production database dump ลง Git/log/test fixture

## 2. Event Case record

ทุกงานต้องมี:

```text
ID: TOY-EC-NNN
ชื่อ:
เหตุผล/หลักฐาน:
Baseline commit:
ไฟล์และฟังก์ชันในขอบเขต:
API/DB ที่เกี่ยวข้อง:
Input / Output:
Acceptance criteria:
ห้ามกระทบ:
Test plan:
Rollback:
Patch version ที่เสนอ:
สถานะ Commit / Push / Deploy:
```

## 3. Standard loop

1. Inspect — บันทึก branch, HEAD, status และอ่านเส้นทางเรียกใช้งานจริง
2. Bound — ระบุไฟล์, function, API, table และสิ่งห้ามกระทบ
3. Reproduce — สร้าง test ที่ล้ม หรือบันทึกขั้นตอน/response ที่ทำให้ปัญหาเกิด
4. Patch — แก้ส่วนเล็กที่สุดที่ตอบ acceptance criteria
5. Test — รัน targeted test, regression test และ static validation
6. Diagnose — หากล้ม ให้เก็บ error และหาสาเหตุ ห้ามปิด/skip test เพื่อให้เขียว
7. Retest — รัน targeted test ซ้ำ แล้วรัน suite ที่เกี่ยวข้อง
8. Review — ตรวจ diff, secret, PII, migration, destructive behavior และ rollback
9. Handoff — สรุปผลและเสนอ patch number; รออนุญาต Commit
10. Release — Push/Deploy เฉพาะเมื่อมีคำสั่ง และทำ post-deploy smoke test

## 4. Git และ version

- branch งานใหม่: `codex/toy-ec-NNN-short-name` เว้นแต่เจ้าของกำหนดอย่างอื่น
- ห้ามทำงาน feature โดยตรงบน `main` เมื่อเริ่มใช้ protocol เต็มรูปแบบ
- Commit message: `TOY-EC-NNN: <ผลลัพธ์สั้น>`
- Patch number เริ่มจาก Git tag/release ปัจจุบันเมื่อเจ้าของกำหนด baseline version; ระหว่างยังไม่มี tag ให้ใช้ `TOY-PATCH-NNN` ห้ามเดา SemVer ของ production
- ทุก handoff ต้องระบุ HEAD ก่อนแก้, commit หลังแก้ (ถ้ามี), diff summary และ rollback command ที่ปลอดภัย
- ใช้ `git revert <commit>` สำหรับ rollback ที่แชร์แล้ว; ห้าม rewrite shared history

## 5. Test gates

ขั้นต่ำทุก Event Case:

- syntax/static check ของไฟล์ที่เปลี่ยน
- targeted automated test หรือ reproducible manual test หากยังไม่มี harness
- `node tools/validate-catalog.mjs` เมื่อแตะ catalog/data/image path
- API contract test เมื่อแตะ endpoint
- migration test บน D1 local/staging ใหม่และฐานที่ upgrade เมื่อแตะ schema
- mobile viewport และ keyboard check เมื่อแตะ UI
- `git diff --check`, review diff และ secret/PII scan ก่อน Commit

ก่อน Deploy:

- staging smoke: `/`, product detail, `/admin/`, `/member/`, API health, D1 read/write และ R2 read/write ตาม scope
- backup/restore point สำหรับ D1/R2 เมื่อมี data mutation
- ยืนยัน environment bindings โดยไม่แสดงค่าของ secret
- ยืนยันว่า migration เป็น forward-only และมี recovery procedure

## 6. API standard

- JSON response มี `ok` เสมอสำหรับ API ที่เป็น JSON
- ใช้ status ให้ตรงความหมาย: 400 validation, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict, 429 rate limit, 500 internal, 502 upstream, 503 unavailable
- validate type, length, enum และ identifier ที่ server; client validation เป็นเพียง UX
- mutation ต้องตรวจ auth/role และพิจารณา CSRF; bulk mutation ต้อง atomic หรือรายงาน partial result
- ห้ามคืน upstream error ที่มี secret/request detail สู่ client
- response ที่มีข้อมูลส่วนบุคคลใช้ `cache-control: no-store`

## 7. Database protocol

- migration file ต้องมีเลขไม่ซ้ำและเรียงลำดับเดียว
- ห้ามเพิ่ม schema mutation ใหม่ใน request path
- migration ต้องทดสอบทั้ง fresh database และ upgrade จาก production-compatible snapshot ที่ sanitize แล้ว
- bulk reorder/import ใช้ transaction/batch ที่ atomic เมื่อ platform รองรับ
- ระบุ owner และ retention ของทุก table โดยเฉพาะ sessions, analytics, audit logs
- production data ห้ามใช้เป็น fixture; ใช้ synthetic IDs/email/phone เท่านั้น

## 8. Frontend standard

- naming: JS `camelCase`, constants `UPPER_SNAKE_CASE`, CSS class `kebab-case`, API JSON ใช้ `camelCase`, DB ใช้ `snake_case`
- ปุ่ม mutation ต้องมี loading/disabled/error/success state และป้องกัน double submit
- mobile baseline: 320, 375, 768 และ desktop 1280 CSS px
- keyboard focus, label, dialog close, alt text และ contrast ต้องตรวจใน Event Case ที่แตะ UI
- dynamic HTML ต้อง escape text และ validate URL scheme; หลีกเลี่ยง `innerHTML` เมื่อใช้ DOM APIs ได้
- field mapping ของ inline editor และ full editor ต้องมี contract/test ร่วมกัน

## 9. Security and privacy gate

ก่อน Commit ให้ค้นหาอย่างน้อย: private key headers, bearer token, API key, password assignment, cookie dump, email/phone จริง และ database export

ค่าที่อนุญาตใน repo มีเพียงชื่อ environment เช่น `OPENAI_API_KEY`; ค่าจริงต้องอยู่ใน Cloudflare secrets ห้ามบันทึกลง Markdown, screenshot หรือ test output

งาน auth, role, upload, external fetch, analytics หรือ PII ถือเป็น high-risk ต้องมี negative tests และ review แยก

## 10. Release authority

- Audit/document: ทำได้ตามขอบเขตที่อนุมัติ
- Patch: ต้องมี Event Case และ test evidence
- Commit: ต้องได้รับคำสั่งหรืออนุมัติจากเจ้าของ
- Push: ต้องได้รับคำสั่งเฉพาะ ห้ามอนุมานจากการอนุญาต Commit
- Deploy/migration production: ต้องได้รับคำสั่งเฉพาะ พร้อม target environment และ rollback readiness

หากสถานะ Git, production หรือ requirement เปลี่ยนระหว่างงาน ให้หยุดก่อน mutation ถัดไปและรายงาน baseline ใหม่
