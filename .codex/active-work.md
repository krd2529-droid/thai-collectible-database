# Active patch

- Event: `TOY-EC-030`
- Outcome: แคตตาล็อก MG เรียงสินค้าภายในแต่ละหมวดตามเลขอ้างอิง Dalong จากน้อยไปมาก
- Acceptance: `m217` แสดงก่อน `m225` แม้ sortOrder เดิมขัดกัน; ใช้ `mgNumber` หรือเลขจาก id `m###` เป็นหลัก; ลำดับหมวดซีรีส์เดิมคงอยู่; RG/MGSD ไม่เปลี่ยน; หน้าเว็บโหลด asset version ใหม่
- Phase: PATCH_READY
- Scope: public catalog MG comparator, asset cache key, regression tests and production verification
- Baseline: `c2d0cd7`
- Evidence: screenshot shows MG products in GUNDAM SEED / ASTRAY are not ordered by their Dalong reference numbers
- Verification: regression reproduced stale sortOrder placing `m225` before `m217`; corrected MG comparator returns `m217,m225`; syntax checks, 24/24 tests and catalog validation with 0 errors pass
- Delivery: pending
- Next: reproduce, implement, test, commit, push and verify production
