TOYSKUB RG Template V5

เพิ่ม:
- อัปโหลดรูปจริงเข้า Cloudflare R2
- Preview หลังอัปโหลด
- Save Draft แบบ Partial Update
- ย้ายไปถังขยะ / ลบถาวรด้วย tombstone เพื่อซ่อนหน้า JSON เก่า

ต้องตั้งค่า Cloudflare Pages > Settings > Bindings > R2 bucket binding:
Variable name: TOYSKUB_MEDIA
เลือก R2 bucket ที่สร้างไว้ เช่น toyskub-media
จากนั้น Redeploy
