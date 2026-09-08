# Active patch

- Event: `TOY-EC-017` / `TOY-PATCH-006`
- Outcome: ลด D1 reads บนเส้นทางหน้าบ้านโดยไม่เปลี่ยนข้อมูลที่ผู้ใช้เห็น
- Acceptance: public catalog/store read ไม่มี schema DDL/probe, SQL กรองเฉพาะสถานะที่ต้องใช้, response cache ได้ช่วงสั้น, ราคาทุนยังไม่ออก public API
- Phase: verification and delivery
- Scope: public catalog/store APIs, frontend fetch policy, API regression tests, protocol/feature docs
- Baseline: `7afdeee`
- Delivery: test, review, commit และ push; ไม่ deploy
