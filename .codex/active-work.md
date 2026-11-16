# Active patch

- Event: `TOY-EC-027`
- Outcome: Auto Catalog ต้องจัดสรรรหัสรายการใหม่ก่อนนำเข้ารูป เพื่อให้รายการ MG ใหม่ที่ AI กรอกแล้วอัปโหลดปก/คู่มือและบันทึก Draft ต่อได้
- Acceptance: MG ใหม่เมื่อไม่มี static/D1 match ได้รหัสภายใน `mg-NNN` และ `mgNumber` แต่ไม่มี SKU; ฟอร์ม MG ไม่แสดงช่อง SKU; เลขถัดไปไม่ชน static หรือ D1; RG/MGSD ยังมี SKU ตามเดิม; upload ไม่เริ่มด้วย id ว่าง
- Phase: PATCH_DELIVERED
- Scope: AI catalog identity allocation, Auto Catalog upload precondition, regression tests and roadmap
- Baseline: `360eafb`
- Evidence: production screenshot shows AI-filled Eclipse Gundam fields while item id/SKU remain blank; client uploadMediaFile rejects empty id before calling media API
- Verification: MG receives an internal `mg-NNN` but no SKU from AI allocation; MG form hides and omits SKU; database normalization preserves blank MG SKU; syntax checks, 24/24 tests and catalog validation with 0 errors pass
- Delivery: merged through `96e069a` to `main`; Cloudflare Pages production deployment `feca7460-c027-454f-b356-d6899501e874` for `toyskub.com`
- Production verification: MG template returns HTTP 200 and deployed assets contain the MG-only hidden SKU field, blank SKU payload and item-ID-based media upload path
- Next: refresh the existing MG form and rerun Auto Catalog once so the deployed allocator fills `mg-NNN` before uploading the image
