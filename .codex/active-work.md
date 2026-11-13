# Active patch

- Event: `TOY-EC-024`
- Outcome: Auto Catalog ของ MGSD ใช้รหัสรายการจากแคตตาล็อก TOYSKUB เมื่อ AI คืนข้อมูลแต่ไม่คืนรหัส ทำให้ MGSD Gundam Barbatos สร้าง Draft ต่อได้
- Acceptance: คำค้น MGSD Gundam Barbatos จับคู่ `mgsd-002`; ไม่ให้ AI เดารหัสภายใน; RG/MG/MGSD อื่นไม่ถูกจับคู่ข้ามไลน์; มี regression test ของอาการจริง
- Phase: PATCH_READY
- Scope: AI catalog-fill identity resolution, Auto Catalog validation/error state, regression tests and roadmap
- Baseline: `6ac4de1`
- Verification: deterministic endpoint regression changed from null id to `mgsd-002`; 21/21 tests pass; catalog validation 0 errors (70 pre-existing missing-image warnings); syntax and diff checks pass; no secret/private-key pattern found
- Delivery: implementation commit `ca55b7d` pushed to `origin/codex/toy-ec-024-mgsd-auto-catalog`
- Next: merge to `main`, deploy Cloudflare Pages production, then verify the real MGSD Auto Catalog workflow; deployment remains gated by an explicit owner instruction
