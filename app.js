const APP = document.getElementById("app");
const PRODUCT_COUNT_EL = document.getElementById("productCount");

let PRODUCTS = [];
let CATEGORY_MAP = {};
const PRODUCT_CACHE = new Map();
let activeFilter = "";
let activeCategory = "";
let activeProductType = "";
let searchTerm = "";
let INLINE_EDIT_MODE = false;
let ADMIN_SESSION = { checked: false, authenticated: false, source: "none" };

const CATEGORIES = [
  { key: "model", label: "Gundam", description: "รวมสินค้าของสะสม Gundam" },
  { key: "zippo", label: "Zippo", description: "กำลังเพิ่มข้อมูล" },
];

const PRODUCT_TYPES = {
  model: [{ key: "gunpla", label: "Gunpla", description: "โมเดลพลาสติกประกอบ แยกตามเกรด" }],
  zippo: [{ key: "zippo", label: "Zippo", description: "ไฟแช็กและของสะสม Zippo" }],
};

// ใส่ข้อมูลร้านสปอนเซอร์ได้สูงสุด 6 ร้าน
// ตัวอย่าง: { name: "ชื่อร้าน", description: "รายละเอียดสั้น ๆ", logo: "shop-01.jpg", url: "https://..." }
const SPONSORS = [
  null,
  null,
  null,
  null,
  null,
  null,
];


async function detectAdminSession() {
  const localFlag = localStorage.getItem("toyskub_admin_ui") === "1";
  let serverAuthenticated = false;

  try {
    const response = await fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "accept": "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    serverAuthenticated = Boolean(
      response.ok && (
        data.authenticated === true ||
        data.loggedIn === true ||
        data.isAdmin === true ||
        data.role === "admin" ||
        data.role === "super_admin" ||
        data.user?.role === "admin" ||
        data.user?.role === "super_admin"
      )
    );
  } catch (error) {
    console.warn("ตรวจสอบสถานะแอดมินไม่สำเร็จ", error);
  }

  // localStorage ใช้เพื่อให้หน้าบ้านจำว่าเคยล็อกอินแล้ว ส่วน API ยังตรวจสิทธิ์ซ้ำทุกครั้งที่ Save/Move/Delete
  ADMIN_SESSION = {
    checked: true,
    authenticated: serverAuthenticated || localFlag,
    source: serverAuthenticated ? "server" : (localFlag ? "local" : "none"),
  };

  if (serverAuthenticated) localStorage.setItem("toyskub_admin_ui", "1");
  document.documentElement.classList.toggle("admin-frontend-mode", ADMIN_SESSION.authenticated);
  return ADMIN_SESSION.authenticated;
}

function catalogOrderValue(item) {
  const explicit = Number(item?.sortOrder);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const rg = Number(item?.rgNumber);
  if (Number.isFinite(rg) && rg > 0) return rg;
  const match = String(item?.id || '').match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : 999999;
}

function sortCatalogItems(a, b) {
  return catalogOrderValue(a) - catalogOrderValue(b) || String(a?.id || '').localeCompare(String(b?.id || ''));
}

function catalogSequence(item) {
  const gradeKey = `${String(item?.grade || '').toLowerCase()}Number`;
  const value = Number(item?.[gradeKey] ?? item?.rgNumber ?? item?.sortOrder);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function loadProducts() {
  await detectAdminSession();
  setupHeaderContact();
  try {
    const categoriesRes = await fetch(
      "./data/categories.json?v=split-json-20260731-1",
      { cache: "no-store" },
    );
    if (!categoriesRes.ok) {
      throw new Error(`categories.json HTTP ${categoriesRes.status}`);
    }
    CATEGORY_MAP = await categoriesRes.json();

    const indexEntries = Object.values(CATEGORY_MAP || {}).flatMap((category) =>
      Object.values(category?.productTypes || {}).flatMap((productType) =>
        Object.entries(productType?.grades || {}),
      ),
    );
    if (!indexEntries.length) throw new Error("ไม่พบเส้นทางแคตตาล็อกสินค้า");

    const indexes = await Promise.all(indexEntries.map(async ([grade, indexPath]) => {
      const indexRes = await fetch(`./${indexPath}?v=multi-grade-20260819-1`, {
        cache: "no-store",
      });
      if (!indexRes.ok) throw new Error(`${grade} index HTTP ${indexRes.status}`);
      const data = await indexRes.json();
      if (!Array.isArray(data)) throw new Error(`${grade} index ต้องเป็นรายการสินค้า`);
      return data;
    }));
    PRODUCTS = indexes.flat().sort(sortCatalogItems);
    try {
      const dynamicRes = await fetch("/api/catalog", { cache: "no-store" });
      if (dynamicRes.ok) {
        const dynamicData = await dynamicRes.json();
        const dynamicItems = Array.isArray(dynamicData.items) ? dynamicData.items : [];
        const excludedIds = new Set(Array.isArray(dynamicData.excludedIds) ? dynamicData.excludedIds : []);
        const byId = new Map(PRODUCTS.filter(item => !excludedIds.has(item.id)).map(item => [item.id, item]));
        dynamicItems.forEach(item => byId.set(item.id, item));
        PRODUCTS = [...byId.values()].sort(sortCatalogItems);
      }
    } catch (dynamicError) { console.warn("โหลดแคตตาล็อกจาก D1 ไม่สำเร็จ", dynamicError); }
    if (PRODUCT_COUNT_EL) PRODUCT_COUNT_EL.textContent = String(PRODUCTS.length).padStart(2, "0");
    await router();
  } catch (error) {
    console.error("โหลดข้อมูลสินค้าไม่สำเร็จ", error);
    APP.innerHTML = `
      <section class="empty-state">
        โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาตรวจสอบไฟล์ data/categories.json และไฟล์ index.json ของหมวดสินค้า
      </section>
    `;
  }
}

function setupHeaderContact() {
  const headerNav = document.querySelector(".header-nav");
  if (!headerNav) return;

  headerNav.classList.add("contact-ready");
  headerNav.innerHTML = `
    <a class="header-admin-link" href="/admin/" rel="nofollow">${ADMIN_SESSION.authenticated ? "ADMIN ✓" : "ADMIN"}</a>
    <a
      class="header-line-contact"
      href="https://lin.ee/rU7lTLb6"
      target="_blank"
      rel="noopener nofollow"
      aria-label="ติดต่อเราทาง LINE"
      title="ติดต่อเราทาง LINE"
    >
      <svg class="header-line-logo" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path fill="currentColor" d="M32 7C17.1 7 5 16.8 5 28.9c0 10.8 9.6 19.8 22.6 21.5 3.2.7 2.8 1.9 2.1 6.3-.1.7-.6 2.8 2.4 1.5 3-1.6 16.4-9.7 22.4-16.6 4.1-4.5 4.5-9.1 4.5-12.7C59 16.8 46.9 7 32 7Z"/>
        <path fill="#fff" d="M15.4 35.9h7.8v-3.2h-4.3V22.4h-3.5v13.5Zm10.1 0H29V22.4h-3.5v13.5Zm6.6 0h3.4v-7.6l5.6 7.6h3V22.4h-3.4V30l-5.6-7.6h-3v13.5Zm14.8 0h8.4v-3.2h-4.9v-2.1h4.6v-3.1h-4.6v-2h4.9v-3.1h-8.4v13.5Z"/>
      </svg>
      <span>ติดต่อเรา</span>
    </a>
  `;
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function imageSizeAttrs(dimensions) {
  const width = Number(dimensions?.width);
  const height = Number(dimensions?.height);
  return width > 0 && height > 0 ? ` width="${width}" height="${height}"` : "";
}

function trackMetaEvent(method, eventName, parameters = {}) {
  if (typeof window.fbq !== "function") return;
  window.fbq(method, eventName, parameters);
}

function getVisitorId() {
  let id = localStorage.getItem("toyskub_visitor_id");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem("toyskub_visitor_id", id);
  }
  return id;
}

async function recordPageView(pageId = "home") {
  const key = `toyskub_viewed_${pageId}`;
  if (sessionStorage.getItem(key) === "1") return;
  sessionStorage.setItem(key, "1");
  try {
    await fetch("/api/analytics/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageId, visitorId: getVisitorId() }),
      keepalive: true,
    });
  } catch (error) {
    console.warn("บันทึกยอดเข้าชมไม่สำเร็จ", error);
  }
}

async function loadVisitorStats(pageId = "") {
  try {
    const query = pageId ? `?pageId=${encodeURIComponent(pageId)}` : "";
    const response = await fetch(`/api/analytics/stats${query}`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function visitorStatsHTML(id, compact = false) {
  return `<div class="visitor-stats-block ${compact ? "compact" : ""}">
    <h2 class="visitor-stats-title">จำนวนผู้เข้าชม</h2>
    <section class="visitor-stats ${compact ? "compact" : ""}" id="${id}" aria-label="สถิติผู้เข้าชม">
    <div><span>วันนี้</span><strong data-stat="today">—</strong></div>
    <div><span>7 วัน</span><strong data-stat="sevenDays">—</strong></div>
    <div><span>30 วัน</span><strong data-stat="thirtyDays">—</strong></div>
    <div><span>${compact ? "หน้าสินค้านี้" : "ทั้งหมด"}</span><strong data-stat="${compact ? "pageViews" : "total"}">—</strong></div>
    </section>
  </div>`;
}

async function hydrateVisitorStats(containerId, pageId = "") {
  const container = document.getElementById(containerId);
  if (!container) return;
  const data = await loadVisitorStats(pageId);
  if (!data) {
    container.querySelectorAll("strong").forEach(node => node.textContent = "0");
    return;
  }
  container.querySelectorAll("[data-stat]").forEach(node => {
    const value = Number(data[node.dataset.stat] || 0);
    node.textContent = value.toLocaleString("th-TH");
  });
}

// ---------------- Router ----------------
async function router() {
  const legacyMatch = window.location.hash.match(/^#\/product\/(.+)$/);
  if (legacyMatch) {
    history.replaceState(null, "", `/product/${encodeURIComponent(decodeURIComponent(legacyMatch[1]))}`);
  }
  if (window.location.hash === "#/product-preview") {
    try { const preview = JSON.parse(localStorage.getItem("toyskub_catalog_preview") || "null"); if (preview) return renderDetail(preview); } catch {}
  }
  const match = window.location.pathname.match(/^\/product\/([^/]+)\/?$/);
  if (match) {
    const summary = PRODUCTS.find((product) => product.id === match[1]);
    if (summary) {
      try {
        let product = PRODUCT_CACHE.get(summary.id);
        if (!product) {
          const detailUrl = summary.source === "d1" ? `/api/catalog/${encodeURIComponent(summary.id)}` : `./${summary.dataFile}?v=split-json-20260731-1`;
          const detailRes = await fetch(detailUrl, { cache: "no-store" });
          if (!detailRes.ok) {
            throw new Error(`${summary.dataFile} HTTP ${detailRes.status}`);
          }
          product = await detailRes.json();
          PRODUCT_CACHE.set(summary.id, product);
        }
        return renderDetail(product);
      } catch (error) {
        console.error("โหลดหน้าสินค้าไม่สำเร็จ", error);
        APP.innerHTML = `
          <section class="empty-state">
            โหลดข้อมูล ${esc(summary.name)} ไม่สำเร็จ กรุณาตรวจสอบไฟล์ ${esc(summary.dataFile)}
          </section>
        `;
        return;
      }
    }
  }
  renderHome();
}
window.addEventListener("popstate", () => {
  void router();
});

// ---------------- Home / Grid ----------------
function renderHome() {
  removeSchema();
  updatePageMetadata();
  document.querySelector('.frontend-admin-toolbar')?.remove();
  document.querySelector('.frontend-admin-modal')?.remove();

  const selectedCategory = CATEGORIES.find((category) => category.key === activeCategory);
  const typeOptions = activeCategory ? (PRODUCT_TYPES[activeCategory] || []) : [];
  const selectedType = typeOptions.find((type) => type.key === activeProductType);
  const categoryProducts = activeCategory ? PRODUCTS.filter((p) => p.category === activeCategory) : [];
  const typeProducts = activeProductType
    ? categoryProducts.filter((p) => productTypeKey(p) === activeProductType)
    : [];
  const grades = activeProductType
    ? [...new Set(typeProducts.map((p) => p.grade).filter(Boolean))]
    : [];

  const filtered = activeFilter
    ? typeProducts.filter((p) => {
        const haystack = `${p.name || ""} ${p.sku || ""} ${p.series || ""} ${p.manufacturer || ""}`.toLowerCase();
        return p.grade === activeFilter && haystack.includes(searchTerm.toLowerCase());
      })
    : [];

  const breadcrumbParts = [
    '<span>หน้าหลัก</span>',
    selectedCategory ? `<b>›</b><span>${esc(selectedCategory.label)}</span>` : '',
    selectedType ? `<b>›</b><span>${esc(selectedType.label)}</span>` : '',
    activeFilter ? `<b>›</b><strong>${esc(activeFilter)}</strong>` : '',
  ].join('');

  const typeStepContent = activeCategory
    ? typeOptions.map((type) =>
        `<button class="catalog-choice type-chip ${type.key === activeProductType ? "active" : ""}" data-type="${type.key}">
          <strong>${esc(type.label)}</strong><small>${esc(type.description)}</small>
        </button>`).join('')
    : '<p class="catalog-waiting">กรุณาเลือกหมวดหลักก่อน</p>';

  const gradeStepContent = activeProductType
    ? grades.map((grade) =>
        `<button class="grade-choice filter-chip ${grade === activeFilter ? "active" : ""}" data-grade="${esc(grade)}">
          <strong>${esc(grade)}</strong><small>${typeProducts.filter((p) => p.grade === grade).length} รายการ</small>
        </button>`).join('')
    : '<p class="catalog-waiting">กรุณาเลือกประเภทสินค้าก่อน</p>';

  const catalogContent = activeFilter
    ? catalogGroupedGridHTML(filtered, activeFilter)
    : '<section class="catalog-selection-empty"><strong>ยังไม่ได้เลือกเกรด</strong><span>เลือกหมวดหลัก → ประเภทสินค้า → เกรด เพื่อแสดงแคตตาล็อก</span></section>';

  APP.innerHTML = `
    ${visitorStatsHTML("homeVisitorStats")}

    ${sponsorSectionHTML()}

    <section class="hero">
      <div class="hero-eyebrow">// TOYS DATA BASE</div>
      <h1 class="hero-title">TOYSKUB</h1>
      <p class="hero-sub">ฐานข้อมูลและแคตตาล็อกของสะสม สำหรับนักสะสมชาวไทย · เลือกหมวด Gundam → Gunpla → เกรด เพื่อเปิดดูแคตตาล็อกสินค้า</p>
      <label class="search-box ${activeFilter ? '' : 'disabled'}">
        <span>SEARCH</span>
        <input id="productSearch" type="search" value="${esc(searchTerm)}" placeholder="${activeFilter ? 'ค้นหาชื่อสินค้า รุ่น รหัส หรือผู้ผลิต' : 'เลือกเกรดก่อนค้นหาสินค้า'}" ${activeFilter ? '' : 'disabled'} />
      </label>
    </section>

    <section class="store-gateway" aria-labelledby="storeGatewayTitle">
      <div>
        <span class="store-gateway__eyebrow">// TOYSKUB STORE · STOCK พร้อมขาย</span>
        <h2 id="storeGatewayTitle">ร้านค้าแยกจากแคตตาล็อก</h2>
        <p>One Piece Card ที่มีสต็อกจริง ราคา และปุ่มสั่งซื้อ ดูได้ในหน้าร้านโดยตรง</p>
      </div>
      <a href="/shop/?category=one-piece-card">เลือกซื้อสินค้าที่มีจำหน่าย <span aria-hidden="true">→</span></a>
    </section>

    <nav class="catalog-breadcrumb" aria-label="หมวดสินค้า">${breadcrumbParts}</nav>

    ${catalogStepHTML(
      "01",
      "เลือกหมวดหลัก",
      CATEGORIES.map((category) =>
        `<button class="catalog-choice category-chip ${category.key === activeCategory ? "active" : ""}" data-category="${category.key}">
          <strong>${esc(category.label)}</strong><small>${esc(category.description)}</small>
        </button>`).join("")
    )}

    ${catalogStepHTML("02", "เลือกประเภทสินค้า", typeStepContent)}
    ${catalogStepHTML("03", "เลือกเกรด", gradeStepContent)}
    ${catalogContent}
  `;

  const searchInput = APP.querySelector("#productSearch");
  searchInput?.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    renderHome();
    const input = APP.querySelector("#productSearch");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  });

  APP.querySelectorAll(".category-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      activeProductType = "";
      activeFilter = "";
      searchTerm = "";
      renderHome();
    });
  });

  APP.querySelectorAll(".type-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeProductType = btn.dataset.type;
      activeFilter = "";
      searchTerm = "";
      renderHome();
    });
  });

  APP.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.grade;
      searchTerm = "";
      renderHome();
    });
  });

  void recordPageView("home");
  void hydrateVisitorStats("homeVisitorStats");
}

function catalogGroupName(product, activeLine) {
  const explicit = String(product.seriesGroup || "").trim();
  if (explicit) return explicit;
  if (activeLine === "RG") return "Gundam";
  if (activeLine === "MGSD") return "MGSD";
  return String(product.series || "").trim() || "รายการอื่น ๆ";
}

function catalogGroupedGridHTML(products, activeLine) {
  if (!products.length) return `<div class="product-grid"><div class="empty-state">ยังไม่มีสินค้าในหมวดนี้ — กำลังเตรียมข้อมูล</div></div>`;
  const groups = new Map();
  for (const product of products) {
    const name = catalogGroupName(product, activeLine);
    if (!groups.has(name)) groups.set(name, { name, order: Number(product.seriesGroupOrder) || 9999, items: [] });
    const group = groups.get(name);
    group.order = Math.min(group.order, Number(product.seriesGroupOrder) || 9999);
    group.items.push(product);
  }
  const preferred = ["Gundam", "Evangelion", "Gaogaigar", "Patlabor", "Special Version"];
  const rank = name => { const i = preferred.indexOf(name); return i < 0 ? 999 : i; };
  const sorted = [...groups.values()].sort((a,b)=>(a.order-b.order)||(rank(a.name)-rank(b.name))||a.name.localeCompare(b.name));
  sorted.forEach(group=>group.items.sort(sortCatalogItems));
  return sorted.map(group => `
    <section class="catalog-series-section">
      <div class="catalog-series-heading"><h2>${esc(group.name)}</h2><span>${group.items.length} รายการ</span></div>
      <div class="product-grid">${group.items.map(cardHTML).join("")}</div>
    </section>`).join("");
}

function productTypeKey(product) {
  if (product.category === "model") return "gunpla";
  return product.category || "";
}

function catalogStepHTML(number, title, content) {
  return `
    <section class="catalog-step">
      <div class="catalog-step-title"><span>${number}</span><strong>${esc(title)}</strong></div>
      <div class="catalog-choice-row">${content || `<p class="empty-state">กำลังเพิ่มข้อมูล</p>`}</div>
    </section>
  `;
}

function sponsorSectionHTML() {
  return `
    <section class="sponsor-section" aria-labelledby="sponsorTitle">
      <div class="sponsor-heading">
        <span class="sponsor-eyebrow">// SHOP & SPONSOR</span>
        <h2 id="sponsorTitle">ร้านค้าและผู้สนับสนุน</h2>
        <p>ร้านค้าที่สนับสนุน TOYSKUB</p>
      </div>
      <div class="sponsor-grid">
        ${SPONSORS.map((shop, index) => sponsorCardHTML(shop, index)).join("")}
      </div>
    </section>
  `;
}

function sponsorCardHTML(shop, index) {
  if (!shop) {
    return `
      <a
        class="sponsor-card sponsor-empty"
        href="https://lin.ee/rU7lTLb6"
        target="_blank"
        rel="noopener nofollow"
        aria-label="ติดต่อเพื่อจองพื้นที่ร้านค้า ${index + 1}"
      >
        <span class="sponsor-slot">SHOP ${String(index + 1).padStart(2, "0")}</span>
        <img
          class="sponsor-ad-gif"
          src="sponsor-open.gif"
          alt="พื้นที่โฆษณาร้านค้า 2,000 บาทต่อเดือน ติดต่อผ่าน LINE"
          loading="lazy"
        />
      </a>
    `;
  }

  return `
    <a
      class="sponsor-card"
      href="${esc(shop.url || "#")}"
      target="_blank"
      rel="noopener sponsored nofollow"
      aria-label="เข้าชมร้าน ${esc(shop.name)}"
    >
      <span class="sponsor-slot">SHOP ${String(index + 1).padStart(2, "0")}</span>
      <span class="sponsor-logo">
        ${
          shop.logo
            ? `<img src="${esc(shop.logo)}" alt="โลโก้ ${esc(shop.name)}" loading="lazy" />`
            : `<span>${esc((shop.name || "SHOP").slice(0, 2).toUpperCase())}</span>`
        }
      </span>
      <strong>${esc(shop.name)}</strong>
      <span>${esc(shop.description || "ร้านค้าผู้สนับสนุน")}</span>
    </a>
  `;
}

function cardHTML(p) {
  const img = (p.images && p.images[0]) || (p.imageThumbnails && p.imageThumbnails[0]) || p.catalogImage;
  return `
    <a class="product-card" href="/product/${encodeURIComponent(p.id)}">
      <span class="card-tag">${esc(p.grade)} · ${esc(p.scale)}</span>
      <span class="card-stock ${p.inStock === true ? "in" : "out"}">${p.inStock === true ? "มีสินค้า" : "ข้อมูลแคตตาล็อก"}</span>
      <div class="card-image">
        ${
          img
            ? `<img src="${esc(img)}" alt="${esc(
                p.name
              )}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span class="placeholder" hidden>ยังไม่มีรูปภาพ</span>`
            : `<span class="placeholder">ยังไม่มีรูปภาพ</span>`
        }
      </div>
      <div class="card-body">
        <div class="card-sku">${esc(p.sku)}</div>
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-meta">${esc(p.manufacturer)}${p.series ? ` · ${esc(p.series)}` : ""}</div>
      </div>
    </a>
  `;
}

// ---------------- Detail Page ----------------
function renderDetail(p) {
  if (INLINE_EDIT_MODE) return renderInlineEditor(p);
  updatePageMetadata(p);
  const img0 = (p.images && p.images[0]) || p.catalogImage || "";
  const visibleProductImages = p.showGalleryImages === false ? (img0 ? [img0] : []) : (p.images || (img0 ? [img0] : []));

  APP.innerHTML = `
    <a href="/" class="back-link">← กลับหน้ารวมสินค้า</a>

    ${ADMIN_SESSION.authenticated ? `
    <div class="catalog-admin-actions admin-session-confirmed" aria-label="เครื่องมือจัดการหน้าแคตตาล็อก">
      <span class="catalog-admin-status">ADMIN MODE · ${esc(p.id)}</span>
      <a class="catalog-admin-action" href="/admin/rg-template/">+ เพิ่มหน้าใหม่</a>
      <button class="catalog-admin-action primary" id="catalogInlineEditButton" type="button">แก้ไขหน้านี้</button>
      <button class="catalog-admin-action" id="catalogMoveButton" type="button">ย้าย / จัดลำดับ</button>
      <button class="catalog-admin-action danger" id="catalogTrashButton" type="button">ลบ / ถังขยะ</button>
    </div>` : `
    <div class="catalog-admin-login-note">
      <span>หน้าบ้านยังไม่พบสถานะแอดมิน</span>
      <a href="/admin/">เข้าสู่ระบบแอดมิน</a>
    </div>`}

    <div class="product-visitor-strip">
      ${visitorStatsHTML("productVisitorStats", true)}
    </div>

    <div class="spec-plate" data-sku="${esc(p.sku)}">
      <div class="detail-grid">
        <div class="gallery">
          <div class="gallery-main">
            ${img0 ? `<img id="mainProductImg" src="${esc(img0)}" alt="${esc(p.name)}"${imageSizeAttrs(p.imageDimensions?.[0])} />` : `<span class="placeholder" style="font-family:var(--font-mono);color:var(--ink-soft)">ยังไม่มีรูปภาพ</span>`}
          </div>
          ${visibleProductImages.length > 1 ? `<div class="gallery-thumbs">
            ${visibleProductImages
              .map(
                (src, i) =>
                  `<img src="${esc(p.imageThumbnails?.[i] || src)}" data-src="${esc(src)}" data-target="mainProductImg" class="${i === 0 ? "active" : ""}" alt="รูปสินค้า ${i + 1}" loading="lazy"${imageSizeAttrs(p.imageDimensions?.[i])} />`
              )
              .join("")}
          </div>` : ""}
          ${
            p.videoEmbedUrl
              ? `<div class="video-embed"><iframe src="${esc(p.videoEmbedUrl)}" title="วิดีโอรีวิว ${esc(
                  p.name
                )}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`
              : ""
          }
        </div>

        <div class="info">
          <span class="product-grade-badge">${esc(p.grade)} GRADE</span>
          <h1 class="product-title">${esc(p.name)}</h1>
          <button class="share-button" id="shareProductButton" type="button" aria-label="แชร์หน้าสินค้า ${esc(p.name)}">
            <span class="share-icon" aria-hidden="true">↗</span>
            <span class="share-label">แชร์หน้านี้</span>
          </button>
          <p class="product-summary">${esc(p.summary)}</p>

          <table class="spec-table">
            <tr><td>ลำดับ ${esc(p.grade || "แคตตาล็อก")}</td><td>${catalogSequence(p) ? String(catalogSequence(p)).padStart(2, "0") : "-"}</td></tr>
            <tr><td>รหัสโมบิลสูท</td><td>${esc(p.modelCode || "-")}</td></tr>
            <tr><td>ผู้ผลิต</td><td>${esc(p.manufacturer)}</td></tr>
            <tr><td>ซีรีส์</td><td>${esc(p.series)}</td></tr>
            <tr><td>เกรด / สเกล</td><td>${esc(p.grade)} · ${esc(p.scale)}</td></tr>
            <tr><td>วันวางจำหน่าย</td><td>${esc(p.releaseDate || "-")}</td></tr>
            <tr><td>ราคาเปิดตัวญี่ปุ่น (ไม่รวมภาษี)</td><td>${p.launchPriceJPY ? Number(p.launchPriceJPY).toLocaleString("th-TH") + " เยน" : "-"}</td></tr>
            <tr><td>ความสูงเมื่อประกอบ</td><td>${p.heightCm ? p.heightCm + " ซม." : "-"}</td></tr>
            <tr><td>อายุที่แนะนำ</td><td>${esc(p.recommendedAge || "-")}</td></tr>
            <tr><td>ประเภทสินค้า</td><td>${esc(p.productType || "-")}</td></tr>
            <tr><td>วัสดุ</td><td>${esc(p.material || "-")}</td></tr>
          </table>

          ${
            p.sourceUrl
              ? `<p><a class="back-link" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener nofollow">เปิดแหล่งอ้างอิง ↗</a></p>`
              : ""
          }
          ${
            p.references && p.references.length
              ? `<div class="reference-list">${p.references
                  .map(
                    (ref) =>
                      `<p><a class="back-link" href="${esc(ref.url)}" target="_blank" rel="noopener nofollow">${esc(ref.label)} ↗</a></p>`
                  )
                  .join("")}</div>`
              : ""
          }

          ${buyLinksHTML(p.affiliateLinks)}
        </div>
      </div>
    </div>

    ${
      p.highlights && p.highlights.length
        ? section("01", "จุดเด่น", `<ul class="highlight-list">${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`)
        : ""
    }

    ${
      p.whatsDifferent && p.whatsDifferent.length
        ? section(
            "02",
            "รุ่นใหม่ต่างจากเดิมอย่างไร",
            p.whatsDifferent.map((d) => `<div class="diff-item"><h4>${esc(d.title)}</h4><p>${esc(d.detail)}</p></div>`).join("")
          )
        : ""
    }

    ${
      p.boxContents && p.boxContents.length
        ? section(
            "03",
            "อุปกรณ์ในกล่อง",
            `<div class="box-tag-list">
              ${p.boxContents.map((b) => `<span class="box-tag">${esc(b)}</span>`).join("")}
              ${(p.notIncluded || []).map((b) => `<span class="box-tag not-included">${esc(b)}</span>`).join("")}
            </div>`
          )
        : ""
    }

    ${
      (p.pros && p.pros.length) || (p.considerations && p.considerations.length)
        ? section(
            "04",
            "ข้อดี / ข้อควรพิจารณา",
            `<div class="two-col">
              <div><strong style="font-family:var(--font-mono);font-size:12px;color:var(--blue)">ข้อดี</strong>
                <ul class="pro-con-list pros-col">${(p.pros || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
              </div>
              <div><strong style="font-family:var(--font-mono);font-size:12px;color:var(--red)">ข้อควรพิจารณา</strong>
                <ul class="pro-con-list cons-col">${(p.considerations || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
              </div>
            </div>`
          )
        : ""
    }

    ${
      p.faq && p.faq.length
        ? section(
            "05",
            "คำถามที่พบบ่อย",
            p.faq
              .map(
                (f, i) => `
              <div class="faq-item" data-faq="${i}">
                <div class="faq-q">${esc(f.q)}</div>
                <div class="faq-a">${esc(f.a)}</div>
              </div>`
              )
              .join("")
          )
        : ""
    }

    ${
      p.manualImages && p.manualImages.length
        ? section(
            "06",
            "คู่มือประกอบ",
            `<div class="manual-album">
              <p class="manual-note">คู่มือประกอบ ${p.manualImages.length} หน้า — เลือกรูปย่อเพื่อเปิดอ่านทีละหน้า</p>
              <div class="manual-gallery-main">
                <img id="mainManualImg" src="${esc(p.manualImages[0])}" alt="คู่มือประกอบ ${esc(p.name)} หน้า 1"${imageSizeAttrs(p.manualImageDimensions?.[0])} />
              </div>
              <div class="gallery-thumbs manual-thumbs">
                ${p.manualImages
                  .map(
                    (src, i) =>
                      `<img src="${esc(p.manualThumbnails?.[i] || src)}" data-src="${esc(src)}" data-target="mainManualImg" class="${i === 0 ? "active" : ""}" alt="คู่มือประกอบ หน้า ${i + 1}" loading="lazy"${imageSizeAttrs(p.manualImageDimensions?.[i])} />`
                  )
                  .join("")}
              </div>
            </div>`
          )
        : ""
    }

  `;

  // gallery thumb switching
  APP.querySelectorAll(".gallery-thumbs").forEach((thumbGroup) => {
    thumbGroup.querySelectorAll("img[data-src][data-target]").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const mainImage = document.getElementById(thumb.dataset.target);
        if (mainImage) mainImage.src = thumb.dataset.src;
        thumbGroup.querySelectorAll("img").forEach((t) => t.classList.remove("active"));
        thumb.classList.add("active");
      });
    });
  });

  // FAQ accordion
  APP.querySelectorAll(".faq-item").forEach((item) => {
    item.querySelector(".faq-q").addEventListener("click", () => item.classList.toggle("open"));
  });

  // Native share on supported devices, with clipboard fallback for desktop.
  const shareButton = APP.querySelector("#shareProductButton");
  shareButton?.addEventListener("click", async () => {
    const shareData = {
      title: `${p.name} | TOYSKUB`,
      text: `ดูข้อมูล ${p.name} บน TOYSKUB`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await copyText(shareData.url);
      showShareStatus(shareButton, "คัดลอกลิงก์แล้ว");
    } catch (error) {
      // Closing the native share sheet is not an error the visitor needs to see.
      if (error?.name === "AbortError") return;

      try {
        await copyText(shareData.url);
        showShareStatus(shareButton, "คัดลอกลิงก์แล้ว");
      } catch {
        showShareStatus(shareButton, "คัดลอกไม่สำเร็จ");
      }
    }
  });

  trackMetaEvent("track", "ViewContent", {
    content_ids: [p.sku || p.id],
    content_name: p.name,
    content_category: `${p.categoryLabel || "Gundam"} > ${p.productType || "Gunpla"} > ${p.grade || ""}`,
    content_type: "product",
  });

  APP.querySelectorAll("a.buy-link[data-affiliate-platform]").forEach((link) => {
    link.addEventListener("click", () => {
      trackMetaEvent("trackCustom", "AffiliateClick", {
        content_ids: [p.sku || p.id],
        content_name: p.name,
        content_category: `${p.categoryLabel || "Gundam"} > ${p.productType || "Gunpla"} > ${p.grade || ""}`,
        content_type: "product",
        platform: link.dataset.affiliatePlatform,
      });
    });
  });

  document.getElementById("catalogInlineEditButton")?.addEventListener("click", () => {
    INLINE_EDIT_MODE = true;
    renderDetail(p);
  });

  document.getElementById("catalogMoveButton")?.addEventListener("click", () => openFrontendMoveDialog(p));
  document.getElementById("catalogTrashButton")?.addEventListener("click", async (event) => {
    if (!confirm(`ย้าย ${p.id} ไปถังขยะหรือไม่? หน้าเว็บจะถูกซ่อน แต่ยังกู้คืนได้`)) return;
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "กำลังย้าย…";
    try {
      const result = await fetch(`/api/admin/catalog/${encodeURIComponent(p.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await result.json().catch(() => ({}));
      if (result.status === 401) {
        location.href = "/admin/";
        return;
      }
      if (!result.ok) throw new Error(data.error || "ย้ายไปถังขยะไม่สำเร็จ");
      PRODUCT_CACHE.delete(p.id);
      PRODUCTS = PRODUCTS.filter((item) => item.id !== p.id);
      location.href = "/";
    } catch (error) {
      alert(error.message || "ย้ายไปถังขยะไม่สำเร็จ");
      button.disabled = false;
      button.textContent = "ลบ / ถังขยะ";
    }
  });

  void recordPageView(p.id || "product");
  void hydrateVisitorStats("productVisitorStats", p.id || "");
  injectSchema(p);
  window.scrollTo(0, 0);
}


function renderInlineEditor(product) {
  const lineText = (items, mapper = value => value) => (items || []).map(mapper).join("\n");
  const refByLabel = label => (product.references || []).find(ref => String(ref.label || "").toLowerCase().includes(label))?.url || "";

  APP.innerHTML = `
    <a href="/product/${encodeURIComponent(product.id)}" class="back-link" id="cancelInlineEditTop">← ยกเลิกการแก้ไข</a>

    <section class="inline-editor-shell">
      <div class="inline-editor-head">
        <div>
          <span class="hero-eyebrow">// FRONTEND INLINE EDITOR</span>
          <h1>แก้ไขหน้า ${esc(product.id)}</h1>
          <p>หน้าตาและลำดับหัวข้อตรงกับหน้า Frontend บันทึกทั้งชุดโดยใช้ข้อมูลเดิมที่โหลดมา จึงไม่ตัดหัวข้อที่ไม่ได้แก้</p>
        </div>
        <div class="inline-editor-actions">
          <button type="button" class="catalog-admin-action" id="cancelInlineEdit">ยกเลิก</button>
          <button type="button" class="catalog-admin-action primary" id="saveInlineEdit">บันทึกการแก้ไข</button>
        </div>
      </div>

      <div class="spec-plate inline-editor-main">
        <div class="detail-grid">
          <div class="gallery inline-editor-gallery">
            <label class="inline-field-label">รูปสินค้า / รูปปก</label>
            <label class="inline-gallery-visibility"><input id="editShowGalleryImages" type="checkbox" ${product.showGalleryImages !== false ? "checked" : ""} /> <strong>เปิดแสดงรูปสินค้าทั้งหมด</strong> <span>ปิดแล้วหน้าเว็บจะเหลือเฉพาะรูปปก — ไม่กระทบรูปคู่มือ</span></label>
            <textarea id="editImages" class="media-value-store" aria-hidden="true">${esc(lineText(product.images))}</textarea>
            <div class="media-upload-box">
              <input id="galleryUploadInput" class="media-upload-input" type="file" accept="image/*" multiple />
              <button id="galleryUploadButton" class="catalog-admin-action primary" type="button">+ อัปโหลดรูปสินค้า</button>
              <span id="galleryUploadStatus" class="media-upload-status"></span>
            </div>
            <p class="inline-editor-note">เลือกรูปได้หลายรูป รูปแรกจะเป็นรูปปก ใช้ปุ่มลูกศรเพื่อเรียง และลบรูปที่ไม่ต้องการได้</p>
            <div id="galleryPreview" class="media-preview-grid"></div>
          </div>
          <div class="info inline-editor-info">
            <label class="inline-field-label">ชื่อสินค้า</label>
            <input id="editName" class="inline-editor-input title-input" value="${esc(product.name || "")}" />

            <label class="inline-field-label">คำอธิบายสินค้า</label>
            <textarea id="editSummary" class="inline-editor-textarea">${esc(product.summary || "")}</textarea>

            <div class="inline-spec-grid">
              ${inlineInput("editRgNumber", "ลำดับ RG", product.rgNumber || "", "number")}
              ${inlineInput("editModelCode", "รหัสโมบิลสูท", product.modelCode || "")}
              ${inlineInput("editManufacturer", "ผู้ผลิต", product.manufacturer || "")}
              ${inlineInput("editSeries", "ซีรีส์", product.series || "")}
              ${inlineInput("editGrade", "เกรด", product.grade || "")}
              ${inlineInput("editScale", "สเกล", product.scale || "")}
              ${inlineInput("editReleaseDate", "วันวางจำหน่าย", product.releaseDate || "")}
              ${inlineInput("editLaunchPrice", "ราคาเปิดตัวญี่ปุ่น (ไม่รวมภาษี)", product.launchPriceJPY || "", "number")}
              ${inlineInput("editHeight", "ความสูงเมื่อประกอบ (ซม.)", product.heightCm || "", "number")}
              ${inlineInput("editAge", "อายุที่แนะนำ", product.recommendedAge || "")}
              ${inlineInput("editProductType", "ประเภทสินค้า", product.productType || "")}
              ${inlineInput("editMaterial", "วัสดุ", product.material || "")}
            </div>

            <div class="inline-editor-subsection">
              <h3>แหล่งอ้างอิง</h3>
              ${inlineInput("editSourceUrl", "เปิดแหล่งอ้างอิง ↗", product.sourceUrl || "", "url")}
              ${inlineInput("editBandai", "Bandai Hobby Site", refByLabel("bandai"), "url")}
              ${inlineInput("editDalong", "Dalong.net", refByLabel("dalong"), "url")}
            </div>

            <div class="inline-editor-subsection">
              <h3>Affiliate</h3>
              ${inlineInput("editShopee", "SHOPEE", product.affiliateLinks?.shopee || "", "url")}
              ${inlineInput("editLazada", "LAZADA", product.affiliateLinks?.lazada || "", "url")}
              ${inlineInput("editTiktok", "TIKTOK", product.affiliateLinks?.tiktok || "", "url")}
              ${inlineInput("editPage", "เว็บ", product.affiliateLinks?.page || "", "url")}
            </div>
          </div>
        </div>
      </div>

      ${inlineSectionEditor("01", "จุดเด่น", "editHighlights", lineText(product.highlights), "หนึ่งข้อ ต่อหนึ่งบรรทัด")}
      ${inlineSectionEditor("02", "รุ่นใหม่ต่างจากเดิมอย่างไร", "editDifferences", lineText(product.whatsDifferent, item => `${item.title || ""} | ${item.detail || ""}`), "หัวข้อ | รายละเอียด — หนึ่งรายการต่อหนึ่งบรรทัด")}
      ${inlineSectionEditor("03", "อุปกรณ์ในกล่อง", "editBoxContents", lineText(product.boxContents), "หนึ่งรายการต่อหนึ่งบรรทัด")}

      <section class="manual-section inline-edit-section">
        <div class="manual-heading"><span class="manual-number">04</span><span class="manual-title">ข้อดี / ข้อควรพิจารณา</span></div>
        <div class="two-col">
          <label><strong>ข้อดี</strong><textarea id="editPros" class="inline-editor-textarea tall">${esc(lineText(product.pros))}</textarea><small>หนึ่งข้อ ต่อหนึ่งบรรทัด</small></label>
          <label><strong>ข้อควรพิจารณา</strong><textarea id="editConsiderations" class="inline-editor-textarea tall">${esc(lineText(product.considerations))}</textarea><small>หนึ่งข้อ ต่อหนึ่งบรรทัด</small></label>
        </div>
      </section>

      ${inlineSectionEditor("05", "คำถามที่พบบ่อย", "editFaq", lineText(product.faq, item => `${item.q || ""} | ${item.a || ""}`), "คำถาม | คำตอบ — หนึ่งข้อต่อหนึ่งบรรทัด")}
      <section class="manual-section inline-edit-section">
        <div class="manual-heading"><span class="manual-number">06</span><span class="manual-title">คู่มือประกอบ</span></div>
        <textarea id="editManualImages" class="media-value-store" aria-hidden="true">${esc(lineText(product.manualImages))}</textarea>
        <div class="media-upload-box">
          <input id="manualUploadInput" class="media-upload-input" type="file" accept="image/*" multiple />
          <button id="manualUploadButton" class="catalog-admin-action primary" type="button">+ อัปโหลดรูปคู่มือ</button>
          <span id="manualUploadStatus" class="media-upload-status"></span>
        </div>
        <p class="inline-editor-note">เลือกหลายหน้าได้ ใช้ปุ่มลูกศรเพื่อเรียงลำดับหน้า และลบรูปที่ไม่ต้องการได้</p>
        <div id="manualPreview" class="media-preview-grid manual-media-preview"></div>
      </section>

      <section class="manual-section inline-edit-section">
        <div class="manual-heading"><span class="manual-number">VIDEO</span><span class="manual-title">YouTube Embed</span></div>
        <label class="inline-field-label">ใส่ YouTube URL หรือ Embed URL</label>
        <input id="editVideo" class="inline-editor-input" value="${esc(product.videoEmbedUrl || "")}" />
      </section>

      <div class="inline-editor-footer">
        <button type="button" class="catalog-admin-action" id="cancelInlineEditBottom">ยกเลิก</button>
        <button type="button" class="catalog-admin-action primary" id="saveInlineEditBottom">บันทึกการแก้ไข</button>
        <span id="inlineSaveStatus" class="inline-save-status"></span>
      </div>
    </section>`;

  const cancel = () => { INLINE_EDIT_MODE = false; renderDetail(product); };
  ["cancelInlineEditTop", "cancelInlineEdit", "cancelInlineEditBottom"].forEach(id => document.getElementById(id)?.addEventListener("click", event => { event.preventDefault(); cancel(); }));
  ["saveInlineEdit", "saveInlineEditBottom"].forEach(id => document.getElementById(id)?.addEventListener("click", () => saveInlineProduct(product)));
  bindMediaUploader(product, {
    kind: "gallery",
    inputId: "galleryUploadInput",
    buttonId: "galleryUploadButton",
    statusId: "galleryUploadStatus",
    valueId: "editImages",
    previewId: "galleryPreview",
  });
  bindMediaUploader(product, {
    kind: "manual",
    inputId: "manualUploadInput",
    buttonId: "manualUploadButton",
    statusId: "manualUploadStatus",
    valueId: "editManualImages",
    previewId: "manualPreview",
  });
  window.scrollTo(0, 0);
}


function mediaList(valueId) {
  const field = document.getElementById(valueId);
  return String(field?.value || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}

function setMediaList(valueId, items) {
  const field = document.getElementById(valueId);
  if (field) field.value = items.join("\n");
}

function renderMediaPreview(config) {
  const container = document.getElementById(config.previewId);
  if (!container) return;
  const items = mediaList(config.valueId);
  if (!items.length) {
    container.innerHTML = `<p class="media-preview-empty">ยังไม่มีรูป</p>`;
    return;
  }
  container.innerHTML = items.map((url, index) => `
    <figure class="media-preview-card">
      <img src="${esc(url)}" alt="${config.kind === "gallery" ? "รูปสินค้า" : "คู่มือ"} ${index + 1}" loading="lazy" />
      <figcaption>
        <strong>${config.kind === "gallery" && index === 0 ? "รูปปก" : `ลำดับ ${index + 1}`}</strong>
        <span class="media-preview-actions">
          <button type="button" data-media-up="${index}" title="เลื่อนขึ้น" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-media-down="${index}" title="เลื่อนลง" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="danger" data-media-remove="${index}" title="ลบรูป">ลบ</button>
        </span>
      </figcaption>
    </figure>`).join("");

  container.querySelectorAll("[data-media-up]").forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.mediaUp);
    const next = mediaList(config.valueId);
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setMediaList(config.valueId, next);
    renderMediaPreview(config);
  }));
  container.querySelectorAll("[data-media-down]").forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.mediaDown);
    const next = mediaList(config.valueId);
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setMediaList(config.valueId, next);
    renderMediaPreview(config);
  }));
  container.querySelectorAll("[data-media-remove]").forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.mediaRemove);
    const next = mediaList(config.valueId);
    next.splice(index, 1);
    setMediaList(config.valueId, next);
    renderMediaPreview(config);
  }));
}

function bindMediaUploader(product, config) {
  const input = document.getElementById(config.inputId);
  const button = document.getElementById(config.buttonId);
  const status = document.getElementById(config.statusId);
  if (!input || !button) return;

  renderMediaPreview(config);
  button.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const files = [...(input.files || [])];
    if (!files.length) return;
    button.disabled = true;
    const existing = mediaList(config.valueId);
    let completed = 0;
    try {
      for (const file of files) {
        if (status) status.textContent = `กำลังอัปโหลด ${completed + 1}/${files.length}…`;
        const form = new FormData();
        form.append("file", file);
        form.append("id", product.id);
        form.append("kind", config.kind);
        const response = await fetch("/api/admin/media/upload", {
          method: "POST",
          credentials: "same-origin",
          body: form,
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          location.href = "/admin/";
          return;
        }
        if (!response.ok || !data.url) throw new Error(data.error || `อัปโหลด ${file.name} ไม่สำเร็จ`);
        existing.push(data.url);
        completed += 1;
        setMediaList(config.valueId, existing);
        renderMediaPreview(config);
      }
      if (status) status.textContent = `อัปโหลดสำเร็จ ${completed} รูป`;
    } catch (error) {
      if (status) status.textContent = error.message || "อัปโหลดไม่สำเร็จ";
      alert(error.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      input.value = "";
      button.disabled = false;
    }
  });
}

function inlineInput(id, label, value, type = "text") {
  return `<label class="inline-input-group"><span>${esc(label)}</span><input id="${id}" class="inline-editor-input" type="${type}" value="${esc(value)}" /></label>`;
}

function inlineSectionEditor(number, title, id, value, hint) {
  return `<section class="manual-section inline-edit-section">
    <div class="manual-heading"><span class="manual-number">${number}</span><span class="manual-title">${esc(title)}</span></div>
    <textarea id="${id}" class="inline-editor-textarea tall">${esc(value)}</textarea>
    <p class="inline-editor-note">${esc(hint)}</p>
  </section>`;
}

function editorValue(id) { return document.getElementById(id)?.value.trim() || ""; }
function editorLines(id) { return editorValue(id).split(/\r?\n/).map(v => v.trim()).filter(Boolean); }
function editorPairs(id, leftKey, rightKey) {
  return editorLines(id).map(line => {
    const splitAt = line.indexOf("|");
    return splitAt < 0
      ? { [leftKey]: line.trim(), [rightKey]: "" }
      : { [leftKey]: line.slice(0, splitAt).trim(), [rightKey]: line.slice(splitAt + 1).trim() };
  }).filter(item => item[leftKey] || item[rightKey]);
}

function normalizeYoutubeEmbed(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const embed = raw.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i);
  const watch = raw.match(/[?&]v=([A-Za-z0-9_-]{6,})/i);
  const short = raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
  const shorts = raw.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i);
  const id = embed?.[1] || watch?.[1] || short?.[1] || shorts?.[1];
  return id ? `https://www.youtube.com/embed/${id}` : raw;
}

async function saveInlineProduct(product) {
  const status = document.getElementById("inlineSaveStatus");
  const buttons = [document.getElementById("saveInlineEdit"), document.getElementById("saveInlineEditBottom")].filter(Boolean);
  buttons.forEach(button => { button.disabled = true; button.textContent = "กำลังบันทึก…"; });
  if (status) status.textContent = "กำลังบันทึกข้อมูลครบทุกหัวข้อ…";

  const bandai = editorValue("editBandai");
  const dalong = editorValue("editDalong");
  const otherRefs = (product.references || []).filter(ref => {
    const label = String(ref.label || "").toLowerCase();
    return !label.includes("bandai") && !label.includes("dalong");
  });

  const patch = {
    name: editorValue("editName"),
    summary: editorValue("editSummary"),
    images: editorLines("editImages"),
    showGalleryImages: document.getElementById("editShowGalleryImages")?.checked !== false,
    rgNumber: Number(editorValue("editRgNumber")) || null,
    modelCode: editorValue("editModelCode"),
    manufacturer: editorValue("editManufacturer"),
    series: editorValue("editSeries"),
    grade: editorValue("editGrade"),
    line: editorValue("editGrade"),
    scale: editorValue("editScale"),
    releaseDate: editorValue("editReleaseDate"),
    launchPriceJPY: Number(editorValue("editLaunchPrice")) || null,
    heightCm: Number(editorValue("editHeight")) || null,
    recommendedAge: editorValue("editAge"),
    productType: editorValue("editProductType"),
    material: editorValue("editMaterial"),
    sourceUrl: editorValue("editSourceUrl"),
    references: [
      ...(bandai ? [{ label: "Bandai Hobby Site", url: bandai }] : []),
      ...(dalong ? [{ label: "Dalong.net", url: dalong }] : []),
      ...otherRefs,
    ],
    affiliateLinks: {
      shopee: editorValue("editShopee"),
      lazada: editorValue("editLazada"),
      tiktok: editorValue("editTiktok"),
      page: editorValue("editPage"),
    },
    highlights: editorLines("editHighlights"),
    whatsDifferent: editorPairs("editDifferences", "title", "detail"),
    boxContents: editorLines("editBoxContents"),
    pros: editorLines("editPros"),
    considerations: editorLines("editConsiderations"),
    faq: editorPairs("editFaq", "q", "a"),
    manualImages: editorLines("editManualImages"),
    videoEmbedUrl: normalizeYoutubeEmbed(editorValue("editVideo")),
  };

  try {
    const response = await fetch(`/api/admin/catalog/${encodeURIComponent(product.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patch),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { location.href = "/admin/"; return; }
    if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");

    Object.assign(product, patch, data.item || data.product || {});
    PRODUCT_CACHE.set(product.id, product);
    PRODUCTS = PRODUCTS.map(item => item.id === product.id ? { ...item, ...product } : item).sort(sortCatalogItems);
    INLINE_EDIT_MODE = false;
    renderDetail(product);
    alert("บันทึกข้อมูลครบทุกหัวข้อเรียบร้อย");
  } catch (error) {
    if (status) status.textContent = error.message || "บันทึกไม่สำเร็จ";
    alert(error.message || "บันทึกไม่สำเร็จ");
    buttons.forEach(button => { button.disabled = false; button.textContent = "บันทึกการแก้ไข"; });
  }
}

async function setupFrontendAdminToolbar(product) {
  const uiFlag = localStorage.getItem('toyskub_admin_ui') === '1';

  const renderToolbar = () => {
    document.querySelector('.frontend-admin-toolbar')?.remove();
    const toolbar = document.createElement('div');
    toolbar.className = 'frontend-admin-toolbar';
    toolbar.innerHTML = `
      <div class="frontend-admin-toolbar__title">ADMIN · ${esc(product.id || '')}</div>
      <div class="frontend-admin-toolbar__actions">
        <a class="frontend-admin-button" href="/admin/rg-template/">เพิ่มหน้าใหม่</a>
        <a class="frontend-admin-button primary" href="/admin/rg-template/?id=${encodeURIComponent(product.id)}">แก้ไข / เพิ่มข้อมูล</a>
        <button class="frontend-admin-button" type="button" data-admin-move>ย้าย / จัดลำดับ</button>
        <button class="frontend-admin-button danger" type="button" data-admin-trash>ลบ / ถังขยะ</button>
      </div>
    `;
    document.body.appendChild(toolbar);

    toolbar.querySelector('[data-admin-move]')?.addEventListener('click', () => openFrontendMoveDialog(product));
    toolbar.querySelector('[data-admin-trash]')?.addEventListener('click', async () => {
      if (!confirm(`ย้าย ${product.id} ไปถังขยะหรือไม่? หน้าเว็บจะถูกซ่อน แต่ยังกู้คืนได้`)) return;
      const button = toolbar.querySelector('[data-admin-trash]');
      button.disabled = true;
      button.textContent = 'กำลังย้าย…';
      try {
        const result = await fetch(`/api/admin/catalog/${encodeURIComponent(product.id)}`, { method: 'DELETE', credentials: 'same-origin' });
        const data = await result.json().catch(() => ({}));
        if (result.status === 401) {
          localStorage.removeItem('toyskub_admin_ui');
          location.href = '/admin/';
          return;
        }
        if (!result.ok) throw new Error(data.error || 'ย้ายไปถังขยะไม่สำเร็จ');
        PRODUCT_CACHE.delete(product.id);
        PRODUCTS = PRODUCTS.filter(item => item.id !== product.id);
        location.href = '/';
      } catch (error) {
        alert(error.message || 'ย้ายไปถังขยะไม่สำเร็จ');
        button.disabled = false;
        button.textContent = 'ลบ / ถังขยะ';
      }
    });
  };

  // แสดงทันทีเมื่อเคยล็อกอินจากหน้า /admin/ แล้ว ไม่ต้องรอ API
  if (uiFlag) renderToolbar();

  try {
    const response = await fetch('/api/admin/session', { cache: 'no-store', credentials: 'same-origin' });
    const session = await response.json().catch(() => ({}));
    if (response.ok && session.authenticated) {
      localStorage.setItem('toyskub_admin_ui', '1');
      if (!document.querySelector('.frontend-admin-toolbar')) renderToolbar();
      return;
    }
    if (!uiFlag) document.querySelector('.frontend-admin-toolbar')?.remove();
  } catch {
    // ถ้า network สะดุด แต่เคยล็อกอินแล้ว ให้ปุ่มยังอยู่
  }
}

function openFrontendMoveDialog(product) {
  document.querySelector('.frontend-admin-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'frontend-admin-modal';
  modal.innerHTML = `
    <div class="frontend-admin-modal__panel" role="dialog" aria-modal="true" aria-label="ย้ายหน้าแคตตาล็อก">
      <div class="frontend-admin-modal__header">
        <div><strong>ย้ายหน้าแคตตาล็อก</strong><small>${esc(product.id)}</small></div>
        <button type="button" class="frontend-admin-modal__close" aria-label="ปิด">×</button>
      </div>
      <div class="frontend-admin-modal__body">
        <label>หมวดหลัก<input name="categoryLabel" value="${esc(product.categoryLabel || 'Gundam')}" /></label>
        <label>รหัสหมวด<input name="categoryCode" value="${esc(product.categoryCode || 'gd')}" /></label>
        <label>ประเภท<input name="productType" value="${esc(product.productType || 'Gunpla')}" /></label>
        <label>รหัสประเภท<input name="productTypeCode" value="${esc(product.productTypeCode || 'gp')}" /></label>
        <label>ไลน์ / เกรด<input name="line" value="${esc(product.line || product.grade || 'RG')}" /></label>
        <label>รหัสไลน์<input name="lineCode" value="${esc(product.lineCode || String(product.grade || 'rg').toLowerCase())}" /></label>
        <label>กลุ่มในหน้า<input name="catalogGroup" value="${esc(product.catalogGroup || product.groupName || 'Gundam')}" /></label>
        <label>ลำดับ<input name="sortOrder" type="number" value="${Number(product.sortOrder || product.rgNumber || 0)}" /></label>
        <p class="frontend-admin-modal__note">การย้ายจะไม่เปลี่ยนรหัสรายการหรือ URL เดิม</p>
      </div>
      <div class="frontend-admin-modal__footer">
        <button type="button" class="frontend-admin-button" data-cancel>ยกเลิก</button>
        <button type="button" class="frontend-admin-button primary" data-save>บันทึกการย้าย</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.frontend-admin-modal__close').onclick = close;
  modal.querySelector('[data-cancel]').onclick = close;
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  modal.querySelector('[data-save]').onclick = async () => {
    const button = modal.querySelector('[data-save]');
    const value = name => modal.querySelector(`[name="${name}"]`).value.trim();
    const patch = {
      categoryLabel: value('categoryLabel'),
      categoryCode: value('categoryCode'),
      productType: value('productType'),
      productTypeCode: value('productTypeCode'),
      line: value('line'),
      grade: value('line'),
      lineCode: value('lineCode'),
      catalogGroup: value('catalogGroup'),
      sortOrder: Number(value('sortOrder')) || 0,
    };
    button.disabled = true;
    button.textContent = 'กำลังบันทึก…';
    try {
      const response = await fetch(`/api/admin/catalog/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'บันทึกการย้ายไม่สำเร็จ');
      Object.assign(product, patch);
      PRODUCT_CACHE.set(product.id, product);
      PRODUCTS = PRODUCTS.map(item => item.id === product.id ? {...item,...patch} : item).sort(sortCatalogItems);
      close();
      alert('ย้ายและบันทึกลำดับเรียบร้อย');
      if(window.location.pathname.startsWith('/product/')) renderDetail(product); else renderHome();
    } catch (error) {
      alert(error.message || 'บันทึกการย้ายไม่สำเร็จ');
      button.disabled = false;
      button.textContent = 'บันทึกการย้าย';
    }
  };
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy failed");
}

function showShareStatus(button, message) {
  const label = button.querySelector(".share-label");
  if (!label) return;
  const original = label.textContent;
  label.textContent = message;
  button.classList.add("share-success");
  window.setTimeout(() => {
    label.textContent = original;
    button.classList.remove("share-success");
  }, 1800);
}

function buyLinksHTML(links) {
  const l = links || {};
  const items = [
    { key: "shopee", label: "SHOPEE", cls: "shopee" },
    { key: "lazada", label: "LAZADA", cls: "lazada" },
    { key: "tiktok", label: "TIKTOK", cls: "tiktok" },
    { key: "page", label: "เว็บ", cls: "page" },
  ];
  return `
    <div class="buy-links">
      ${items
        .map((it) => {
          const url = l[it.key];
          const has = url && url.trim() !== "";
          return has
            ? `<a class="buy-link ${it.cls}" data-affiliate-platform="${it.key}" href="${esc(url)}" target="_blank" rel="noopener sponsored nofollow">
                 <span class="platform-name">${it.label}</span>
                 <span class="platform-hint">ดูสินค้า →</span>
               </a>`
            : `<span class="buy-link ${it.cls} disabled">
                 <span class="platform-name">${it.label}</span>
                 <span class="platform-hint">ยังไม่ผูกลิงก์</span>
               </span>`;
        })
        .join("")}
    </div>
  `;
}

function section(number, title, bodyHTML) {
  return `
    <section class="manual-section">
      <div class="manual-heading">
        <span class="manual-number">${number}</span>
        <span class="manual-title">${esc(title)}</span>
      </div>
      ${bodyHTML}
    </section>
  `;
}

// ---------------- Structured data (schema.org) for GEO/SEO ----------------
function injectSchema(p) {
  removeSchema();

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    brand: { "@type": "Brand", name: p.manufacturer },
    category: p.categoryLabel || p.productType || "ของสะสม",
    description: p.summary,
    ...(p.images && p.images.length ? { image: p.images } : {}),
    ...(p.releaseDate ? { releaseDate: p.releaseDate } : {}),
    ...(buildOffers(p).length ? { offers: buildOffers(p) } : {}),
  };

  const scriptProduct = document.createElement("script");
  scriptProduct.type = "application/ld+json";
  scriptProduct.id = "schema-product";
  scriptProduct.textContent = JSON.stringify(productSchema);
  document.head.appendChild(scriptProduct);

  if (p.faq && p.faq.length) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    const scriptFaq = document.createElement("script");
    scriptFaq.type = "application/ld+json";
    scriptFaq.id = "schema-faq";
    scriptFaq.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(scriptFaq);
  }
}

function updatePageMetadata(product = null) {
  const description = product?.summary || "TOYSKUB ฐานข้อมูลและแคตตาล็อกของสะสม สำหรับนักสะสมชาวไทย พร้อมข้อมูลรุ่นและแหล่งอ้างอิง";
  const url = product ? `https://toyskub.com/product/${encodeURIComponent(product.id)}` : "https://toyskub.com/";
  document.title = product ? `${product.name} | TOYSKUB` : "Toyskub — Toys Data Base";
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = description;
  let canonical = document.getElementById("canonicalUrl");
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.id = "canonicalUrl";
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

function buildOffers(p) {
  const links = p.affiliateLinks || {};
  const sellerNames = { shopee: "Shopee", lazada: "Lazada", tiktok: "TikTok Shop", page: "เว็บไซต์ร้านค้าโดยตรง" };
  const availability = p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  const offers = Object.entries(links)
    .filter(([, url]) => url && url.trim() !== "")
    .map(([key, url]) => ({
      "@type": "Offer",
      url,
      availability,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: sellerNames[key] || key },
    }));

  return offers;
}

function removeSchema() {
  document.getElementById("schema-product")?.remove();
  document.getElementById("schema-faq")?.remove();
}

loadProducts();
