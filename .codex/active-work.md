# Active patch

- Event: `TOY-EC-027`
- Outcome: Auto Catalog ต้องจัดสรรรหัสรายการใหม่ก่อนนำเข้ารูป เพื่อให้รายการ MG ใหม่ที่ AI กรอกแล้วอัปโหลดปก/คู่มือและบันทึก Draft ต่อได้
- Acceptance: MG ใหม่เมื่อไม่มี static/D1 match ได้รหัสภายใน `mg-NNN` และ `mgNumber` แต่ไม่มี SKU; ฟอร์ม MG ไม่แสดงช่อง SKU; เลขถัดไปไม่ชน static หรือ D1; RG/MGSD ยังมี SKU ตามเดิม; upload ไม่เริ่มด้วย id ว่าง
- Phase: PATCH_IN_PROGRESS
- Scope: AI catalog identity allocation, Auto Catalog upload precondition, regression tests and roadmap
- Baseline: `360eafb`
- Evidence: production screenshot shows AI-filled Eclipse Gundam fields while item id/SKU remain blank; client uploadMediaFile rejects empty id before calling media API
- Verification: pending regression for MG internal ID without SKU across AI, form and database normalization
- Delivery: pending amended follow-up commit on `origin/codex/toy-ec-027-auto-catalog-id`
- Next: merge and deploy only after a separate owner instruction, then repeat the MG Auto Catalog/upload flow on production
