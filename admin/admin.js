const loginPanel = document.getElementById("loginPanel");
const setupPanel = document.getElementById("setupPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const adminEmail = document.getElementById("adminEmail");
const databaseStatus = document.getElementById("databaseStatus");
const logoutButton = document.getElementById("logoutButton");
const openCategoriesButton = document.getElementById("openCategoriesButton");
const categoriesPanel = document.getElementById("categoriesPanel");
const categoryRows = document.getElementById("categoryRows");
const categoryCount = document.getElementById("categoryCount");
const categoryMessage = document.getElementById("categoryMessage");
const newCategoryButton = document.getElementById("newCategoryButton");
const categoryDialog = document.getElementById("categoryDialog");
const categoryForm = document.getElementById("categoryForm");
const closeDialogButton = document.getElementById("closeDialogButton");
const cancelDialogButton = document.getElementById("cancelDialogButton");
const formMessage = document.getElementById("formMessage");
const dialogTitle = document.getElementById("dialogTitle");
let categories = [];

function show(panel) {
  [loginPanel, setupPanel, dashboardPanel].forEach((item) => item.classList.add("hidden"));
  panel.classList.remove("hidden");
}

function setMessage(element, message = "", type = "success") {
  element.textContent = message;
  element.className = message ? `status ${type}` : "status hidden";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

function slugify(value) {
  return String(value || "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    show(loginPanel);
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }
  if (!response.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

async function getSession() {
  const response = await fetch("/api/admin/session", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (response.status === 503 && data.configured === false) return show(setupPanel);
  if (!response.ok || !data.authenticated) return show(loginPanel);
  adminEmail.textContent = data.admin?.email || "เจ้าของเว็บไซต์";
  databaseStatus.textContent = data.database?.connected ? "TOYSKUB_DB เชื่อมต่อแล้ว" : "TOYSKUB_DB ยังไม่เชื่อมต่อ";
  show(dashboardPanel);
  await loadCategories(false);
}

async function loadCategories(showPanel = true) {
  if (showPanel) {
    categoriesPanel.classList.remove("hidden");
    categoriesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  categoryRows.innerHTML = '<tr><td colspan="5">กำลังโหลดข้อมูล…</td></tr>';
  try {
    const data = await api("/api/admin/categories");
    categories = data.categories || [];
    categoryCount.textContent = `${categories.length} หมวด`;
    renderCategories();
  } catch (error) {
    categoryRows.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
    setMessage(categoryMessage, error.message, "error");
  }
}

function renderCategories() {
  if (!categories.length) {
    categoryRows.innerHTML = '<tr><td colspan="5">ยังไม่มีหมวดใน D1 กด “+ เพิ่มหมวด” เพื่อเริ่มต้น</td></tr>';
    return;
  }
  categoryRows.innerHTML = categories.map((category) => `
    <tr>
      <td>${Number(category.sortOrder) || 0}</td>
      <td><b>${escapeHtml(category.name)}</b><small>${escapeHtml(category.description || "")}</small></td>
      <td><code>${escapeHtml(category.slug)}</code></td>
      <td><span class="badge ${category.isActive ? "active" : "inactive"}">${category.isActive ? "ใช้งาน" : "ซ่อน"}</span></td>
      <td><div class="row-actions"><button type="button" data-edit="${category.id}">แก้ไข</button><button type="button" class="danger" data-delete="${category.id}">ลบ</button></div></td>
    </tr>`).join("");
}

function openCategoryDialog(category = null) {
  categoryForm.reset();
  setMessage(formMessage);
  document.getElementById("categoryId").value = category?.id || "";
  document.getElementById("categoryName").value = category?.name || "";
  document.getElementById("categorySlug").value = category?.slug || "";
  document.getElementById("categoryDescription").value = category?.description || "";
  document.getElementById("categorySortOrder").value = category?.sortOrder ?? 0;
  document.getElementById("categoryActive").checked = category ? Boolean(category.isActive) : true;
  dialogTitle.textContent = category ? "แก้ไขหมวด" : "เพิ่มหมวด";
  categoryDialog.showModal();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage, "กำลังเข้าสู่ระบบ…", "loading");
  const password = document.getElementById("password").value;
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
    setMessage(loginMessage, "เข้าสู่ระบบสำเร็จ", "success");
    await getSession();
  } catch (error) {
    setMessage(loginMessage, error.message, "error");
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  document.getElementById("password").value = "";
  show(loginPanel);
});

openCategoriesButton.addEventListener("click", () => loadCategories(true));
newCategoryButton.addEventListener("click", () => openCategoryDialog());
closeDialogButton.addEventListener("click", () => categoryDialog.close());
cancelDialogButton.addEventListener("click", () => categoryDialog.close());

document.getElementById("categoryName").addEventListener("input", (event) => {
  const slugInput = document.getElementById("categorySlug");
  if (!slugInput.dataset.edited) slugInput.value = slugify(event.target.value);
});
document.getElementById("categorySlug").addEventListener("input", (event) => {
  event.target.dataset.edited = event.target.value ? "1" : "";
  event.target.value = slugify(event.target.value);
});

categoryRows.addEventListener("click", async (event) => {
  const editId = Number(event.target.dataset.edit);
  const deleteId = Number(event.target.dataset.delete);
  if (editId) return openCategoryDialog(categories.find((item) => Number(item.id) === editId));
  if (!deleteId) return;
  const category = categories.find((item) => Number(item.id) === deleteId);
  if (!confirm(`ลบหมวด “${category?.name || "นี้"}” หรือไม่?`)) return;
  try {
    await api(`/api/admin/categories/${deleteId}`, { method: "DELETE" });
    setMessage(categoryMessage, "ลบหมวดเรียบร้อย", "success");
    await loadCategories(false);
  } catch (error) {
    setMessage(categoryMessage, error.message, "error");
  }
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("categoryId").value;
  const payload = {
    name: document.getElementById("categoryName").value,
    slug: document.getElementById("categorySlug").value,
    description: document.getElementById("categoryDescription").value,
    sortOrder: Number(document.getElementById("categorySortOrder").value) || 0,
    isActive: document.getElementById("categoryActive").checked,
  };
  setMessage(formMessage, "กำลังบันทึก…", "loading");
  try {
    await api(id ? `/api/admin/categories/${id}` : "/api/admin/categories", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    categoryDialog.close();
    setMessage(categoryMessage, id ? "แก้ไขหมวดเรียบร้อย" : "เพิ่มหมวดเรียบร้อย", "success");
    await loadCategories(true);
  } catch (error) {
    setMessage(formMessage, error.message, "error");
  }
});

void getSession();
