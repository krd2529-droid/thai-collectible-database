# Active patch

- Event: `TOY-EC-028`
- Outcome: MG ใช้รหัสอ้างอิงจาก Dalong เท่านั้น เช่น Eclipse Gundam ใช้ `m217`; ห้ามสร้างรหัส `mg-001` เอง
- Acceptance: AI แปลง `/reviews/mg/m217/m217_i_e.htm` เป็น id `m217`, `mgNumber` 217 และ SKU ว่าง; ถ้าไม่มี Dalong URL ที่ยืนยันได้ต้องไม่สร้าง ID; ฟอร์มรับรหัส `m###`; RG/MGSD ไม่เปลี่ยน
- Phase: PATCH_VERIFIED
- Scope: MG Dalong identity derivation, form validation, database normalization and regression tests
- Baseline: `e2b4cde`
- Evidence: Dalong Eclipse page is `m217/m217_i_e.htm`, while production generated the fabricated internal id format `mg-001`
- Verification: red regression reproduced `mg-004 !== m217` before the correction; corrected regression returns `m217`, missing Dalong reference returns no ID, syntax checks, 24/24 tests and catalog validation with 0 errors pass
- Delivery: pending
- Next: implement, run full regression, commit, push and deploy
