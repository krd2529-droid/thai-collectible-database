# Active patch

- Event: `TOY-EC-023`
- Outcome: SHOP 01 แสดงร้าน VCA พร้อมโลโก้และลิงก์ Shopee ที่เจ้าของเว็บระบุ
- Acceptance: โลโก้ VCA แสดงเต็มกรอบ; การ์ดเปิดลิงก์ `https://s.shopee.co.th/1Bltd2F90`; SHOP 02–06 คงเดิม
- Phase: PATCH_READY
- Scope: sponsor configuration, supplied logo asset, sponsor-card image layout, regression test and roadmap
- Baseline: `0353c3f`
- Verification: supplied logo visually verified; JavaScript syntax passes; 20/20 automated tests; catalog validation 0 errors
- Next action: commit, push, merge to main and verify production sponsor card
