# Active patch

- Event: `TOY-EC-022`
- Outcome: หลังบ้านมี MG Template คล้าย RG และหน้าแรกเลือก MG ได้
- Acceptance: MG ใช้ id/number/scale/folder แยก; Auto Catalog รองรับ MG; Catalog Manager เปิดโหมด MG; หน้าแรกมีปุ่ม MG; RG/MGSD เดิมไม่เปลี่ยน
- Phase: PATCH_READY
- Scope: shared catalog template, admin dashboard/manager, AI catalog contract, catalog normalization, home grade selector, tests and docs
- Baseline: `b49b992`
- Verification: JavaScript syntax checks pass; 19/19 automated tests; catalog validation 0 errors; shared template remains compatible with RG and MGSD
- Next action: final diff/security review, commit, push and deploy verification
