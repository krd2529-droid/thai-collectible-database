# Active patch

- Event: `TOY-EC-024`
- Outcome: Auto Catalog ของ MGSD ใช้รหัสรายการจากแคตตาล็อก TOYSKUB เมื่อ AI คืนข้อมูลแต่ไม่คืนรหัส ทำให้ MGSD Gundam Barbatos สร้าง Draft ต่อได้
- Acceptance: คำค้น MGSD Gundam Barbatos จับคู่ `mgsd-002`; ไม่ให้ AI เดารหัสภายใน; RG/MG/MGSD อื่นไม่ถูกจับคู่ข้ามไลน์; มี regression test ของอาการจริง
- Phase: PATCH_DELIVERED
- Scope: AI catalog-fill identity resolution from static catalog and D1, Auto Catalog validation/error state, regression tests and roadmap
- Baseline: `6ac4de1`
- Verification: production smoke found no D1 row for `mgsd-002`; static fallback added; D1 and static endpoint regressions pass; 22/22 tests pass; catalog validation 0 errors (70 pre-existing missing-image warnings); production static catalog returns `mgsd-002`, `MGSD-002`, number 2; admin MGSD page returns 200; API route method guard returns 405
- Delivery: implementation commit `d86c952` merged/pushed to `origin/main`; Cloudflare Pages production deployment `46bce36b-ff78-423d-94ec-26c9c53fdd20` active for `toyskub.com`
- Next: none
