# Active patch

- Event: `TOY-EC-021`
- Outcome: ชื่อสินค้า RG ทุกชิ้นใช้คำนำหน้า `RG 1/144`
- Acceptance: แก้ข้อมูล RG เดิมทั้ง list/payload; บันทึกใหม่ normalize อัตโนมัติ; MGSD ไม่เปลี่ยน
- Phase: PATCH_DELIVERED
- Scope: catalog name normalization, D1 migration, regression test and roadmap
- Baseline: `fd6a30c`
- Verification: 18/18 automated tests; migration regression covers RG, RG1/144, wrong MG prefix and MGSD preservation; catalog validation 0 errors
- Delivery: commit `69e97f5` merged and pushed to `origin/main`; migration `0010` applied to production `toyskub-db`; production API verified 31 RG items and 0 non-canonical names
- Rollback: D1 Time Travel bookmark `0000036c-00000000-0000511c-3a31d94985ead2891c8dfc1aaf984278`
