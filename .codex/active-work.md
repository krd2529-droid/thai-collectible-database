# Active patch

- Event: `TOY-EC-024`
- Outcome: Auto Catalog ของ MGSD ใช้รหัสรายการจากแคตตาล็อก TOYSKUB เมื่อ AI คืนข้อมูลแต่ไม่คืนรหัส ทำให้ MGSD Gundam Barbatos สร้าง Draft ต่อได้
- Acceptance: คำค้น MGSD Gundam Barbatos จับคู่ `mgsd-002`; ไม่ให้ AI เดารหัสภายใน; RG/MG/MGSD อื่นไม่ถูกจับคู่ข้ามไลน์; มี regression test ของอาการจริง
- Phase: PATCH_READY
- Scope: AI catalog-fill identity resolution from static catalog and D1, Auto Catalog validation/error state, regression tests and roadmap
- Baseline: `6ac4de1`
- Verification: production smoke found no D1 row for `mgsd-002`; added static-catalog fallback; both D1 and static endpoint regressions pass; 22/22 tests pass; catalog validation 0 errors (70 pre-existing missing-image warnings); syntax and diff checks pass
- Delivery: first implementation `c337fe0` reached production deployment `7b793610-52a9-4eea-ac8a-ab7c6ffe17a1`; follow-up static fallback is ready on `codex/toy-ec-024-static-identity-fallback`
- Next: commit/push/merge/deploy static fallback and repeat production smoke
