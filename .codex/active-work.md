# Active patch

- Event: `TOY-EC-027`
- Outcome: Auto Catalog ต้องจัดสรรรหัสรายการใหม่ก่อนนำเข้ารูป เพื่อให้รายการ MG ใหม่ที่ AI กรอกแล้วอัปโหลดปก/คู่มือและบันทึก Draft ต่อได้
- Acceptance: MG ใหม่เมื่อไม่มี static/D1 match ได้ `mg-NNN`, `MG-NNN`, `mgNumber`; เลขถัดไปไม่ชน static หรือ D1; RG/MGSD ใช้กติกาเดียวกัน; รายการเดิมยังใช้ identity เดิม; upload ไม่เริ่มด้วย id ว่าง
- Phase: PATCH_READY
- Scope: AI catalog identity allocation, Auto Catalog upload precondition, regression tests and roadmap
- Baseline: `360eafb`
- Evidence: production screenshot shows AI-filled Eclipse Gundam fields while item id/SKU remain blank; client uploadMediaFile rejects empty id before calling media API
- Verification: endpoint regression reproduced `id: null` before the fix; new MG now allocates the next number across static and D1; syntax checks, 24/24 tests and catalog validation with 0 errors pass
- Next: run full tests/catalog validation, review diff, commit and push; deploy requires a separate owner instruction
