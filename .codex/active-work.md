# Active patch

- Event: `TOY-EC-030`
- Outcome: แคตตาล็อก MG เรียงสินค้าภายในแต่ละหมวดตามเลขอ้างอิง Dalong จากน้อยไปมาก
- Acceptance: `m192` แสดงก่อน Eclipse `m217`; Eclipse legacy `mg-001` ถูกย้ายเป็น `m217`/เลข 217 โดยไม่ทำ URL รูปเดิมหาย; ใช้ `mgNumber` หรือเลขจาก id `m###` เป็นหลัก; ลำดับหมวดซีรีส์เดิมคงอยู่; RG/MGSD ไม่เปลี่ยน; หน้าเว็บโหลด asset version ใหม่
- Phase: PATCH_BLOCKED
- Scope: public catalog MG comparator, Eclipse legacy D1 migration, asset cache key, regression tests and production verification
- Baseline: `c2d0cd7`
- Evidence: screenshot shows MG products in GUNDAM SEED / ASTRAY are not ordered by their Dalong reference numbers
- Verification: regression reproduced stale sortOrder placing `m225` before `m217`; corrected MG comparator returns `m217,m225`; production inspection found Eclipse still stored as `mg-001` while `m217` is free; guarded migration preserves the existing media URL; 25/25 tests and catalog validation with 0 errors pass
- Delivery: comparator commit `2dd1a67` and guarded migration commit `d6e306f` pushed to `main`; production D1 migration not applied
- Blocker: production primary-key change `mg-001` to `m217` requires explicit owner approval after acknowledging that the old `/product/mg-001` URL will stop resolving
- Next: after explicit approval, apply `migrations/0011_catalog_mg_dalong_identity.sql`, verify `m192 → m217` in GUNDAM SEED / ASTRAY, and record production delivery
