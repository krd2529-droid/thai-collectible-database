# Active patch

- Event: `TOY-EC-025`
- Outcome: เพิ่ม MGSD Kshatriya จาก Dalong เป็นรายการล่าสุดใน static catalog เพื่อให้หน้าเว็บมีรายการแม้ฟอร์มเพิ่มสินค้าขัดข้อง
- Acceptance: ใช้รหัส `mgsd-006`/`MGSD-006`; ชื่อ MGSD Kshatriya; อยู่ MGSD กลุ่มเดิม; แสดงรูปปกจาก Dalong; มีหน้า product และแหล่งอ้างอิง; ไม่แก้รายการ 001–005
- Phase: PATCH_COMMITTED
- Scope: MGSD static index, detail JSON, catalog image/source metadata, regression test, sitemap and roadmap
- Baseline: `f92b21a`
- Verification: Dalong page HTTP 200; confirms MGSD Kshatriya, code NZ-666, release 2026.9, price ¥7,000, Bandai product page and cover URL; regression test failed before implementation then passed; 23/23 tests pass; catalog validation has 0 errors (70 pre-existing missing-image warnings); downloaded cover visually verified
- Delivery: commit `6a417ce` pushed to `origin/codex/toy-ec-025-mgsd-kshatriya`
- Next: merge and deploy only after a separate owner instruction
