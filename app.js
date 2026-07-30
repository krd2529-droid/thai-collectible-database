const APP = document.getElementById("app");
const PRODUCT_COUNT_EL = document.getElementById("productCount");

let PRODUCTS = [];
let activeFilter = "ALL";
let activeCategory = "ALL";
let searchTerm = "";

const CATEGORIES = [
  { key: "ALL", label: "ทั้งหมด" },
  { key: "model", label: "โมเดลและกันพลา" },
  { key: "one-piece-card", label: "การ์ด One Piece" },
  { key: "zippo", label: "Zippo" },
];

async function loadProducts() {
  const res = await fetch("products.json");
  PRODUCTS = await res.json();
  PRODUCT_COUNT_EL.textContent = String(PRODUCTS.length).padStart(2, "0");
  router();
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------------- Router ----------------
function router() {
  const hash = window.location.hash || "#/";
  const match = hash.match(/^#\/product\/(.+)$/);
  if (match) {
    const product = PRODUCTS.find((p) => p.id === match[1]);
    if (product) return renderDetail(product);
  }
  renderHome();
}
window.addEventListener("hashchange", router);

// ---------------- Home / Grid ----------------
function renderHome() {
  removeSchema();
  const categoryProducts =
    activeCategory === "ALL" ? PRODUCTS : PRODUCTS.filter((p) => p.category === activeCategory);
  const grades = ["ALL", ...new Set(categoryProducts.map((p) => p.grade).filter(Boolean))];

  const filtered = categoryProducts.filter((p) => {
    const gradeMatches = activeFilter === "ALL" || p.grade === activeFilter;
    const haystack = `${p.name || ""} ${p.sku || ""} ${p.series || ""} ${p.manufacturer || ""}`.toLowerCase();
    return gradeMatches && haystack.includes(searchTerm.toLowerCase());
  });

  APP.innerHTML = `
    <section class="hero">
      <div class="hero-eyebrow">// COLLECTOR'S DATABASE</div>
      <h1 class="hero-title">THAI COLLECTIBLE DATABASE</h1>
      <p class="hero-sub">ฐานข้อมูลของสะสมภาษาไทย · แคตตาล็อกกันพลา Real Grade (RG) ครบ 43 รายการ พร้อมลำดับรุ่นและแหล่งอ้างอิง</p>
      <label class="search-box">
        <span>SEARCH</span>
        <input id="productSearch" type="search" value="${esc(searchTerm)}" placeholder="ค้นหาชื่อสินค้า รุ่น รหัส หรือผู้ผลิต" />
      </label>
    </section>

    <div class="category-bar">
      ${CATEGORIES.map(
        (category) =>
          `<button class="category-chip ${category.key === activeCategory ? "active" : ""}" data-category="${category.key}">
            ${esc(category.label)}
          </button>`
      ).join("")}
    </div>

    <div class="filter-bar">
      ${grades
        .map(
          (g) =>
            `<button class="filter-chip ${g === activeFilter ? "active" : ""}" data-grade="${esc(g)}">${esc(
              g === "ALL" ? "ทั้งหมด" : g
            )}</button>`
        )
        .join("")}
    </div>

    <div class="product-grid">
      ${
        filtered.length
          ? filtered.map(cardHTML).join("")
          : `<div class="empty-state">ยังไม่มีสินค้าในหมวดนี้ — กำลังเตรียมข้อมูล</div>`
      }
    </div>
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
      activeFilter = "ALL";
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

function cardHTML(p) {
  const img = p.images && p.images[0];
  return `
    <a class="product-card" href="#/product/${esc(p.id)}">
      <span class="card-tag">${esc(p.grade)} · ${esc(p.scale)}</span>
      <span class="card-stock ${p.inStock === true ? "in" : "out"}">${p.inStock === true ? "มีสินค้า" : "ข้อมูลแคตตาล็อก"}</span>
      <div class="card-image">
        ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" />` : `<span class="placeholder">ยังไม่มีรูปภาพ</span>`}
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

  injectSchema(p);
  window.scrollTo(0, 0);
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
            ? `<a class="buy-link ${it.cls}" href="${esc(url)}" target="_blank" rel="noopener sponsored nofollow">
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
