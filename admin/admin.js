const loginPanel = document.getElementById("loginPanel");
const setupPanel = document.getElementById("setupPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const adminEmail = document.getElementById("adminEmail");
const databaseStatus = document.getElementById("databaseStatus");
const logoutButton = document.getElementById("logoutButton");

function show(panel) {
  [loginPanel, setupPanel, dashboardPanel].forEach((item) => item.classList.add("hidden"));
  panel.classList.remove("hidden");
}

async function getSession() {
  const response = await fetch("/api/admin/session", { cache: "no-store" });
  let data = {};
  try { data = await response.json(); } catch {}

  if (response.status === 503 && data.configured === false) {
    show(setupPanel);
    return;
  }
  if (!response.ok || !data.authenticated) {
    show(loginPanel);
    return;
  }

  adminEmail.textContent = data.admin?.email || "เจ้าของเว็บไซต์";
  databaseStatus.textContent = data.database?.connected
    ? "TOYSKUB_DB เชื่อมต่อแล้ว"
    : "TOYSKUB_DB ยังไม่เชื่อมต่อ";
  show(dashboardPanel);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.className = "status loading";
  loginMessage.textContent = "กำลังเข้าสู่ระบบ…";
  const password = document.getElementById("password").value;
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    loginMessage.className = "status error";
    loginMessage.textContent = data.error || "เข้าสู่ระบบไม่สำเร็จ";
    return;
  }
  loginMessage.textContent = "เข้าสู่ระบบสำเร็จ";
  await getSession();
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  document.getElementById("password").value = "";
  show(loginPanel);
});

void getSession();
