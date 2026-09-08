# Active patch

- Event: `TOY-EC-018` / `TOY-PATCH-007`
- Outcome: ลด D1 reads ของหน้าบ้านและหลังบ้านโดยไม่ลดหรือซ่อนข้อมูล
- Acceptance: admin GET และ session lookup ไม่รัน schema DDL/probe, catalog list ไม่ส่ง payload JSON เต็ม, behavior เดิมผ่าน regression
- Phase: PATCH_DELIVERED
- Scope: member session read, admin catalog/store/orders/categories/members GET, tests and protocol docs
- Baseline: `b3690d3`
- Verification: 16/16 automated tests, catalog validation 0 errors, diff check passed
- Delivery: commit `3718c95` pushed to `origin/main`; not deployed
