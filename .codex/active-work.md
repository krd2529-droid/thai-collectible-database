# Active patch

- Event: `TOY-EC-029`
- Outcome: บังคับเบราว์เซอร์โหลด MG validator รุ่นใหม่ เพื่อให้รหัส Dalong `m###` ที่ AI กรอกเผยแพร่ได้
- Acceptance: หน้า MG อ้าง asset version ใหม่; `m225` ผ่าน validation; ข้อความ `ต้องใช้รหัสรูปแบบ mg-001` จากแคชเก่าไม่เกิดหลัง reload; RG/MGSD ไม่เปลี่ยน
- Phase: PATCH_VERIFIED
- Scope: MG template cache busting and regression coverage
- Baseline: `bc4b021`
- Evidence: screenshot shows AI correctly filled `m225`, but browser validator still displays the old `mg-001` requirement; HTML still references the previous template.js version key
- Verification: regression failed on the stale asset key before the fix; new asset key passes with syntax checks, full tests and catalog validation
- Delivery: pending
- Next: bump asset version, run regressions, commit, push and verify production HTML
