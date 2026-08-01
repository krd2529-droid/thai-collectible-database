const statusEl = document.getElementById("sessionStatus");
const emailEl = document.getElementById("adminEmail");
const databaseEl = document.getElementById("databaseStatus");

async function checkSession() {
  try {
    const response = await fetch("/api/admin/session", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "SESSION_CHECK_FAILED");

    statusEl.className = "status success";
    statusEl.textContent = "เข้าสู่ระบบในฐานะแอดมินแล้ว";
    emailEl.textContent = data.admin.email;
    databaseEl.textContent = data.database.connected
      ? `${data.database.binding} เชื่อมต่อแล้ว`
      : `${data.database.binding} ยังไม่เชื่อมต่อ`;
  } catch (error) {
    statusEl.className = "status error";
    statusEl.textContent = `ตรวจสอบสิทธิ์ไม่สำเร็จ: ${error.message}`;
    databaseEl.textContent = "ตรวจสอบไม่ได้";
  }
}

void checkSession();
