# Active patch

- Event: `TOY-EC-029`
- Outcome: บังคับเบราว์เซอร์โหลด MG validator รุ่นใหม่ เพื่อให้รหัส Dalong `m###` ที่ AI กรอกเผยแพร่ได้
- Acceptance: หน้า MG อ้าง asset version ใหม่; `m225` ผ่าน validation; ข้อความ `ต้องใช้รหัสรูปแบบ mg-001` จากแคชเก่าไม่เกิดหลัง reload; RG/MGSD ไม่เปลี่ยน
- Phase: PATCH_DELIVERED
- Scope: MG template cache busting and regression coverage
- Baseline: `bc4b021`
- Evidence: screenshot shows AI correctly filled `m225`, but browser validator still displays the old `mg-001` requirement; HTML still references the previous template.js version key
- Verification: regression failed on the stale asset key before the fix; new asset key passes with syntax checks, full tests and catalog validation
- Delivery: commit `d79c535` deployed to Cloudflare Pages production `eba84c36-210c-47c4-a3ed-e1f40878f7ad` for `toyskub.com`
- Production verification: HTTP 200; custom-domain HTML references `template.js?v=mg-dalong-id-20261116-1`; loaded validator accepts `m225` and contains no `mg-001` example
- Next: reload the already-filled MG form once, then publish without rerunning AI
