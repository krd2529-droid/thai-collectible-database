const $ = (id) => document.getElementById(id);
let items = [];

function msg(text = "", type = "success") {
  const el = $("message");
  el.textContent = text;
  el.className = text ? `status ${type}` : "status hidden";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[char]);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    location.href = "/admin/";
    throw new Error("กรุณาเข้าสู่ระบบใหม่");
  }
  if (!response.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

async function load() {
  msg("กำลังโหลดรายการ…", "loading");
  const data = await api("/api/admin/catalog");
  items = Array.isArray(data.items) ? data.items : [];
  msg("");
  render();
}

function imageUrl(item) {
  const path = item.catalogImage || (Array.isArray(item.images) ? item.images[0] : "") || "";
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `/${String(path).replace(/^\/+/, "")}`;
}

function render() {
  const query = $("search").value.trim().toLowerCase();
  const list = items.filter((item) =>
    `${item.id || ""} ${item.name || ""} ${item.line || item.grade || ""} ${item.seriesGroup || ""} ${item.series || ""}`
      .toLowerCase()
      .includes(query)
  );

  $("rows").innerHTML = list.length
    ? list.map((item) => {
        const id = esc(item.id);
        const img = imageUrl(item);
        const status = item.status || item.catalogStatus || "draft";
        const statusLabel = status === "published" ? "เผยแพร่" : status === "hidden" ? "ซ่อน" : "ฉบับร่าง";
        return `<tr>
          <td>${img ? `<img class="thumb" src="${esc(img)}" alt="" onerror="this.style.visibility='hidden'">` : "—"}</td>
          <td><b>${id}</b><br>${esc(item.name || "ยังไม่มีชื่อรุ่น")}</td>
          <td><b>${esc(item.line || item.grade || "—")}</b>
            ${item.seriesGroup ? `<br><small>กลุ่ม: ${esc(item.seriesGroup)}</small>` : ""}
            ${item.series ? `<br><small>${esc(item.series)}</small>` : ""}
          </td>
          <td><span class="status-pill ${esc(status)}">${statusLabel}</span></td>
          <td><div class="row-actions">
            <a class="table-action primary" href="/admin/rg-template/?id=${encodeURIComponent(item.id)}">แก้ไขข้อมูลครบ</a>
            <a class="table-action" href="/#/product/${encodeURIComponent(item.id)}" target="_blank" rel="noopener">ดูหน้าเว็บ</a>
            <button class="danger" data-delete="${id}" type="button">ย้ายไปถังขยะ</button>
          </div></td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="5">ยังไม่มีรายการจาก D1 กด “เพิ่มรายการด้วยฟอร์มเต็ม” เพื่อสร้างรายการแรก</td></tr>';
}

$("search").addEventListener("input", render);

$("rows").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const id = button.dataset.delete;
  if (!confirm(`ย้าย ${id} ไปถังขยะหรือไม่?`)) return;

  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = "กำลังย้าย…";
  try {
    await api(`/api/admin/catalog/${encodeURIComponent(id)}`, { method: "DELETE" });
    items = items.filter((item) => item.id !== id);
    render();
    msg(`ย้าย ${id} ไปถังขยะแล้ว`);
  } catch (error) {
    msg(error.message, "error");
    button.disabled = false;
    button.textContent = oldText;
  }
});

load().catch((error) => msg(error.message, "error"));
