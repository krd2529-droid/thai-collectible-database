# Active patch

- Event: `TOY-EC-019` / `TOY-PATCH-008`
- Outcome: MGSD Gundam Aerial อยู่ในแถบ MGSD เดียวกับรุ่นอื่น
- Acceptance: MGSD ที่มี legacy seriesGroup=Gundam ต้อง canonicalize เป็น MGSD; Special Version ยังแยกได้; template/AI ไม่สร้างค่า legacy เพิ่ม
- Phase: verification and delivery
- Scope: catalog grouping, MGSD template defaults, catalog normalization, regression tests and docs
- Baseline: `d0bfa0e`
- Delivery: test, review, commit and push; not deployed
