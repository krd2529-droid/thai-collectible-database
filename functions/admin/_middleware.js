// Admin Panel v2: หน้า /admin เป็นไฟล์หน้าเว็บธรรมดา
// การตรวจสิทธิ์ทำที่ API ทุกจุด เพื่อไม่ให้หน้าเว็บถูกบล็อกก่อนแสดงหน้าล็อกอิน
export async function onRequest(context) {
  return context.next();
}
