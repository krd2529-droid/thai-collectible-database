# Active patch

- Event: `TOY-EC-023`
- Outcome: SHOP 01 แสดงร้าน VCA พร้อมโลโก้และลิงก์ Shopee ที่เจ้าของเว็บระบุ
- Acceptance: โลโก้ VCA แสดงเต็มกรอบ; การ์ดเปิดลิงก์ `https://s.shopee.co.th/1Bltd2F90`; SHOP 02–06 คงเดิม
- Phase: PATCH_DELIVERED
- Scope: sponsor configuration, supplied logo asset, sponsor-card image layout, regression test and roadmap
- Baseline: `0353c3f`
- Verification: supplied logo visually verified; JavaScript syntax passes; 20/20 automated tests; catalog validation 0 errors
- Delivery: commit `e59cb00` merged and pushed to `origin/main`; Cloudflare Pages production deployment `a620eb5e-e8bd-43f4-a681-4aeac7fa5407` active; production app and VCA image returned HTTP 200 with the supplied Shopee URL
