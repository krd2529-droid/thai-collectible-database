# Active patch

- Event: `TOY-EC-030`
- Outcome: แคตตาล็อก MG เรียงสินค้าภายในแต่ละหมวดตามเลขอ้างอิง Dalong จากน้อยไปมาก
- Acceptance: `m192` แสดงก่อน Eclipse `m217`; Eclipse legacy `mg-001` ถูกย้ายเป็น `m217`/เลข 217 โดยไม่ทำ URL รูปเดิมหาย; ใช้ `mgNumber` หรือเลขจาก id `m###` เป็นหลัก; ลำดับหมวดซีรีส์เดิมคงอยู่; RG/MGSD ไม่เปลี่ยน; หน้าเว็บโหลด asset version ใหม่
- Phase: PATCH_DELIVERED
- Scope: public catalog MG comparator, Eclipse legacy D1 migration, asset cache key, regression tests and production verification
- Baseline: `c2d0cd7`
- Evidence: screenshot shows MG products in GUNDAM SEED / ASTRAY are not ordered by their Dalong reference numbers
- Verification: regression reproduced stale sortOrder placing `m225` before `m217`; corrected MG comparator returns `m217,m225`; production inspection found Eclipse still stored as `mg-001` while `m217` is free; guarded migration preserves the existing media URL; 25/25 tests and catalog validation with 0 errors pass
- Delivery: comparator commit `2dd1a67` deployed to Cloudflare Pages production `11b352b3-4882-4a29-a3ca-7f59080b24b1`; guarded migration commit `d6e306f` applied to production `toyskub-db` after owner approval
- Production verification: D1 and public API both return `m192` Freedom before `m217` Eclipse; Barbatos is `m225` with sortOrder/mgNumber 225; legacy `mg-001` count is 0; Eclipse image returns HTTP 200
- Next: none
