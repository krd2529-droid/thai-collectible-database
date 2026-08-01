const APP = document.getElementById("app");
const PRODUCT_COUNT_EL = document.getElementById("productCount");

let PRODUCTS = [];
let CATEGORY_MAP = {};
const PRODUCT_CACHE = new Map();
let activeFilter = "RG";
let activeCategory = "model";
let activeProductType = "gunpla";
let searchTerm = "";

const CATEGORIES = [
  { key: "model", label: "Gundam", description: "รวมสินค้าของสะสม Gundam" },
  { key: "one-piece-card", label: "การ์ด One Piece", description: "กำลังเพิ่มข้อมูล" },
  { key: "zippo", label: "Zippo", description: "กำลังเพิ่มข้อมูล" },
];

const PRODUCT_TYPES = {
  model: [{ key: "gunpla", label: "Gunpla", description: "โมเดลพลาสติกประกอบ แยกตามเกรด" }],
  "one-piece-card": [{ key: "one-piece-card", label: "การ์ด One Piece", description: "การ์ดสะสม One Piece" }],
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

async function loadProducts() {
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

    const indexPath =
      CATEGORY_MAP?.gundam?.productTypes?.gunpla?.grades?.RG;
    if (!indexPath) throw new Error("ไม่พบเส้นทางแคตตาล็อก RG");

    const indexRes = await fetch(`./${indexPath}?v=split-json-20260731-1`, {
      cache: "no-store",
    });
    if (!indexRes.ok) throw new Error(`RG index HTTP ${indexRes.status}`);

    const data = await indexRes.json();
    if (!Array.isArray(data)) throw new Error("RG index ต้องเป็นรายการสินค้า");
    PRODUCTS = data;
    try {
      const dynamicRes = await fetch("/api/catalog", { cache: "no-store" });
      if (dynamicRes.ok) {
        const dynamicData = await dynamicRes.json();
        const dynamicItems = Array.isArray(dynamicData.items) ? dynamicData.items : [];
        const byId = new Map(PRODUCTS.map(item => [item.id, item]));
        dynamicItems.forEach(item => byId.set(item.id, item));
        PRODUCTS = [...byId.values()].sort((a,b)=>(Number(a.rgNumber)||9999)-(Number(b.rgNumber)||9999));
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
    <a class="header-admin-link" href="/admin/" rel="nofollow">ADMIN</a>
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

function trackMetaEvent(method, eventName, parameters = {}) {
  if (typeof window.fbq !== "function") return;
  window.fbq(method, eventName, parameters);
}

// ---------------- Router ----------------
async function router() {
  const hash = window.location.hash || "#/";
  if (hash === "#/product-preview") {
    try { const preview = JSON.parse(localStorage.getItem("toyskub_catalog_preview") || "null"); if (preview) return renderDetail(preview); } catch {}
  }
  const match = hash.match(/^#\/product\/(.+)$/);
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
window.addEventListener("hashchange", () => {
  void router();
});

// ---------------- Home / Grid ----------------
function renderHome() {
  removeSchema();
  const categoryProducts = PRODUCTS.filter((p) => p.category === activeCategory);
  const typeProducts = categoryProducts.filter((p) => productTypeKey(p) === activeProductType);
  const grades = [...new Set(typeProducts.map((p) => p.grade).filter(Boolean))];

  const filtered = typeProducts.filter((p) => {
    const gradeMatches = !activeFilter || p.grade === activeFilter;
    const haystack = `${p.name || ""} ${p.sku || ""} ${p.series || ""} ${p.manufacturer || ""}`.toLowerCase();
    return gradeMatches && haystack.includes(searchTerm.toLowerCase());
  });

  const selectedCategory = CATEGORIES.find((category) => category.key === activeCategory);
  const typeOptions = PRODUCT_TYPES[activeCategory] || [];
  const selectedType = typeOptions.find((type) => type.key === activeProductType);

  APP.innerHTML = `
    ${sponsorSectionHTML()}

    <section class="hero">
      <div class="hero-eyebrow">// TOYS DATA BASE</div>
      <h1 class="hero-title">TOYSKUB</h1>
      <p class="hero-sub">ฐานข้อมูลและแคตตาล็อกของสะสม สำหรับนักสะสมชาวไทย · เลือกหมวด Gundam → Gunpla → เกรด เพื่อเปิดดูแคตตาล็อกสินค้า</p>
      <label class="search-box">
        <span>SEARCH</span>
        <input id="productSearch" type="search" value="${esc(searchTerm)}" placeholder="ค้นหาชื่อสินค้า รุ่น รหัส หรือผู้ผลิต" />
      </label>
    </section>

    <nav class="catalog-breadcrumb" aria-label="หมวดสินค้า">
      <span>หน้าหลัก</span><b>›</b><span>${esc(selectedCategory?.label || "")}</span><b>›</b>
      <span>${esc(selectedType?.label || "")}</span><b>›</b><strong>${esc(activeFilter || "")}</strong>
    </nav>

    ${catalogStepHTML(
      "01",
      "เลือกหมวดหลัก",
      CATEGORIES.map(
        (category) =>
          `<button class="catalog-choice category-chip ${category.key === activeCategory ? "active" : ""}" data-category="${category.key}">
            <strong>${esc(category.label)}</strong><small>${esc(category.description)}</small>
          </button>`
      ).join("")
    )}

    ${catalogStepHTML(
      "02",
      "เลือกประเภทสินค้า",
      typeOptions
        .map(
          (type) =>
            `<button class="catalog-choice type-chip ${type.key === activeProductType ? "active" : ""}" data-type="${type.key}">
              <strong>${esc(type.label)}</strong><small>${esc(type.description)}</small>
            </button>`
        )
        .join("")
    )}

    ${catalogStepHTML(
      "03",
      "เลือกเกรด",
      grades
        .map(
          (grade) =>
            `<button class="grade-choice filter-chip ${grade === activeFilter ? "active" : ""}" data-grade="${esc(grade)}">
              <strong>${esc(grade)}</strong><small>${typeProducts.filter((p) => p.grade === grade).length} รายการ</small>
            </button>`
        )
        .join("")
    )}

    ${catalogGroupedGridHTML(filtered, activeFilter)}

  `;

  APP.querySelector("#productSearch").addEventListener("input", (event) => {
    searchTerm = event.target.value;
    renderHome();
    const input = APP.querySelector("#productSearch");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  APP.querySelectorAll(".category-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      activeProductType = (PRODUCT_TYPES[activeCategory] || [])[0]?.key || "";
      const availableProducts = PRODUCTS.filter(
        (p) => p.category === activeCategory && productTypeKey(p) === activeProductType
      );
      activeFilter = availableProducts[0]?.grade || "";
      renderHome();
    });
  });

  APP.querySelectorAll(".type-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeProductType = btn.dataset.type;
      const availableProducts = PRODUCTS.filter(
        (p) => p.category === activeCategory && productTypeKey(p) === activeProductType
      );
      activeFilter = availableProducts[0]?.grade || "";
      renderHome();
    });
  });

  APP.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.grade;
      renderHome();
    });
  });
}

function catalogGroupName(product, activeLine) {
  const explicit = String(product.seriesGroup || "").trim();
  if (explicit) return explicit;
  if (activeLine === "RG") return "Gundam";
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
  const img = p.images && p.images[0];
  return `
    <a class="product-card" href="#/product/${esc(p.id)}">
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
  const img0 = (p.images && p.images[0]) || "";

  APP.innerHTML = `
    <a href="#/" class="back-link">← กลับหน้ารวมสินค้า</a>

    <div class="spec-plate" data-sku="${esc(p.sku)}">
      <div class="detail-grid">
        <div class="gallery">
          <div class="gallery-main">
            ${img0 ? `<img id="mainProductImg" src="${esc(img0)}" alt="${esc(p.name)}" />` : `<span class="placeholder" style="font-family:var(--font-mono);color:var(--ink-soft)">ยังไม่มีรูปภาพ — เพิ่มได้ที่ data/products.json</span>`}
          </div>
          <div class="gallery-thumbs">
            ${(p.images || [])
              .map(
                (src, i) =>
                  `<img src="${esc(src)}" data-src="${esc(src)}" data-target="mainProductImg" class="${i === 0 ? "active" : ""}" alt="รูปสินค้า ${i + 1}" />`
              )
              .join("")}
          </div>
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
            <tr><td>ลำดับ RG</td><td>${p.rgNumber ? String(p.rgNumber).padStart(2, "0") : "-"}</td></tr>
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
                <img id="mainManualImg" src="${esc(p.manualImages[0])}" alt="คู่มือประกอบ ${esc(p.name)} หน้า 1" />
              </div>
              <div class="gallery-thumbs manual-thumbs">
                ${p.manualImages
                  .map(
                    (src, i) =>
                      `<img src="${esc(src)}" data-src="${esc(src)}" data-target="mainManualImg" class="${i === 0 ? "active" : ""}" alt="คู่มือประกอบ หน้า ${i + 1}" loading="lazy" />`
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

  injectSchema(p);
  window.scrollTo(0, 0);
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
