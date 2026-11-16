# Active patch

- Event: `TOY-EC-026`
- Outcome: ทำ MG Template สำหรับเพิ่ม Master Grade โดยแบ่งหน้ารวม MG ตามซีรีส์อ้างอิงโครงหมวด Dalong และเปิดเลือก MG จากหน้าแรก
- Acceptance: หลังบ้านมีปุ่ม MG Template; ฟอร์มบังคับ identity `MG`/`mg-*`/`mgNumber`/`1/100`; เลือกกลุ่มซีรีส์ MG ได้; หน้าแรกมี MG และจัดรายการตามกลุ่มซีรีส์; Auto Catalog ใช้เส้นทาง Dalong `/reviews/mg/`; RG/MGSD ไม่เปลี่ยน
- Phase: PATCH_UPDATED
- Scope: MG template identity and route/button, MG series groups/order, Auto Catalog MG rules/static lookup, homepage grouping, regression tests and roadmap
- Baseline: `f3b00a7` (includes committed TOY-EC-025, not yet merged/deployed)
- Evidence: Dalong Master Grade catalog groups Normal products by series including First Gundam, MSV, Z/ZZ, Sentinel, CCA, 0080, F91, 0083, Victory, G, Wing, 08th, X, Turn A, Seed, OO, UC, Age, Build and IBO
- Verification: production deployment `a582ccb9` served main `24dbde4`; HTTP and browser smoke confirmed MG option, MGSD-006 card/detail, MG Template fields and no console errors; visual check found the template frame still labeled `RG-TEMPLATE`
- Delivery: main deployment active; narrow label correction in progress
- Next: change frame label dynamically to `MG-TEMPLATE`, retest, push main and re-run production smoke
