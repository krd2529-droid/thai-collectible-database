# Active patch

- Event: `TOY-EC-021`
- Outcome: ชื่อสินค้า RG ทุกชิ้นใช้คำนำหน้า `RG 1/144`
- Acceptance: แก้ข้อมูล RG เดิมทั้ง list/payload; บันทึกใหม่ normalize อัตโนมัติ; MGSD ไม่เปลี่ยน
- Phase: PATCH_READY
- Scope: catalog name normalization, D1 migration, regression test and roadmap
- Baseline: `fd6a30c`
- Verification: 18/18 automated tests; migration regression covers RG, RG1/144, wrong MG prefix and MGSD preservation; catalog validation 0 errors
- Next action: final review, commit and push; production migration remains deployment-gated
