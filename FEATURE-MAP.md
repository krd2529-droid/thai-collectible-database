# TOYSKUB Feature Map

สถานะนี้มาจาก static audit วันที่ 2026-08-19 ยังไม่ยืนยันกับ production services

| ID | Feature | UI / entry | Functions / API | Data / binding | Input → Output | Boundary / risk |
|---|---|---|---|---|---|---|
| TOY-F001 | Public catalog navigation | `index.html`, `app.js:loadData/renderHome` | `GET /api/catalog` | static category/index JSON + D1 `catalog_items` | category/line selection → catalog cards | ห้ามเปลี่ยน precedence static/D1 โดยไม่มี contract test |
| TOY-F002 | Product detail | `/product/:id`, `app.js:route/renderDetail` | `GET /api/catalog/:id` สำหรับ D1 | detail JSON หรือ D1 payload | product ID → full product page | `_redirects`, SEO URL, missing/hidden status |
| TOY-F003 | Catalog analytics | `app.js:trackView/loadStats` | `POST /api/analytics/view`, `GET /api/analytics/stats` | D1 `analytics_views`, localStorage visitor ID | page/visitor → aggregate counts | privacy, abuse, retention; public stats intent ไม่ชัด |
| TOY-F004 | Admin shared-password session | `/admin/`, `admin/admin.js` | login/logout/session | `ADMIN_PASSWORD`, `ADMIN_EMAIL`, signed cookie, D1 users | password → admin cookie/session state | high-risk auth; bootstrap ยกระดับ super_admin |
| TOY-F005 | Member registration/login | `/member/`, `member/member.js` | register/login/logout/session | D1 users/sessions/audit, PBKDF2 | profile/password → member session | PII, rate limit, verification/reset ยังไม่มี |
| TOY-F006 | Category management | admin dashboard | CRUD/import/reorder APIs | D1 `categories`, static `categories.json` | category tree mutations → stored hierarchy | reorder atomicity, parent validation, migration drift |
| TOY-F007 | Catalog manager | `/admin/catalog/` | admin catalog list/get/delete/bulk gallery APIs | D1 `catalog_items` | filters/actions → catalog state | status semantics และ static tombstone behavior |
| TOY-F008 | Full RG editor | `/admin/rg-template/` | admin catalog create/update/delete | D1 payload + static fallback | form → normalized catalog payload | merge ไม่ยอมล้าง field ว่างบางชนิด; mapping ใหญ่ |
| TOY-F009 | Inline product editor | product page admin mode in `app.js` | admin catalog update/delete | D1 catalog | inline form → updated payload | logic ซ้ำกับ full editor; XSS/field drift |
| TOY-F010 | Media upload/delivery | editors + `/media/:path` | upload API, media function | R2 `TOYSKUB_MEDIA` | image/form-data → immutable media URL | MIME อาศัย client metadata; ไม่มี delete/GC |
| TOY-F011 | Dalong manual import | RG editor | `POST /api/admin/media/import-dalong-manual` | external dalong.net + R2 | approved page URL → up to 80 images | external fetch/cost/time; allowlist มีแล้วแต่ต้อง test redirect |
| TOY-F012 | AI catalog fill | RG editor | `POST /api/admin/ai/catalog-fill` | OpenAI Responses API | query/options → schema-constrained draft | cost, upstream error, source verification, secret |
| TOY-F013 | Static catalog validation | CLI tool | none | grade indexes/detail/image filesystem | repository data → errors/warnings/exit code | ตรวจทุกเกรดที่ประกาศใน categories และ catalogImage แล้ว; ยังไม่ครอบคลุม sitemap/full schema/orphan files |
| TOY-F014 | Search/SEO/public metadata | public HTML, `sitemap.xml`, `robots.txt`, `llms.txt` | none | static files | crawler request → metadata/routes | sitemap เป็น static 48 product URLs; D1 published itemsไม่ถูกเพิ่มอัตโนมัติ |
| TOY-F015 | One Piece Card storefront | การ์ดสินค้า/จำนวน/ปุ่มซื้อและ checkout บน `/`, `app.js`, `index.html` | `GET /api/store/products`, `POST /api/store/orders` | D1 `store_products`, `store_orders` (ไม่ใช้ catalog JSON/`catalog_items`) | product, quantity, shipping input → pending order reference | ซื้อและกรอกข้อมูลบนหน้าแรกโดยตรง; ราคา/ชื่อถูก snapshot; stock 0 = Sold out |
| TOY-F016 | Store administration | `/admin/store/` | admin store product/order APIs + media upload | D1 + R2 `TOYSKUB_MEDIA` | product CRUD-like update (รวมระดับและราคาต้นทุน), optimized image, order transition → inventory state | ราคาต้นทุนส่งเฉพาะ admin API ห้ามออก public/store cart; paid เท่านั้นที่หัก stock |

## API inventory

### Public

| Method | Route | Auth | Main output |
|---|---|---|---|
| GET | `/api/catalog` | none | D1 published summaries + excluded IDs |
| GET | `/api/catalog/:id` | none | published D1 payload |
| POST | `/api/analytics/view` | none | recorded flag |
| GET | `/api/analytics/stats` | none | aggregate visitors/page views |
| GET | `/media/:path` | none | R2 object with long immutable cache |

### Member

| Method | Route | Auth | Main output |
|---|---|---|---|
| POST | `/api/member/register` | none | member + session cookie |
| POST | `/api/member/login` | none | member + session cookie |
| POST | `/api/member/logout` | member cookie optional | cleared cookie |
| GET | `/api/member/session` | member cookie | current user |

### Admin

| Method | Route | Role/state | Main effect |
|---|---|---|---|
| POST | `/api/admin/login` | shared secret | signed cookie; optional owner bootstrap |
| POST | `/api/admin/logout` | none | clear admin cookie |
| GET | `/api/admin/session` | admin/member role | auth/config/database state |
| GET/POST | `/api/admin/categories` | editor+ or admin cookie | list/create category |
| PUT/DELETE | `/api/admin/categories/:id` | editor+ or admin cookie | edit/delete category |
| POST | `/api/admin/categories/import` | editor+ or admin cookie | static JSON → D1 upsert |
| POST | `/api/admin/categories/reorder` | editor+ or admin cookie | update sort orders |
| GET/POST/PUT | `/api/admin/catalog` | editor+ or admin cookie | list/create/bulk gallery flag |
| GET/PUT/DELETE | `/api/admin/catalog/:id` | editor+ or admin cookie | read/upsert/trash/tombstone |
| GET | `/api/admin/members` | editor+ or admin cookie | up to 500 member profiles |
| POST | `/api/admin/media/upload` | editor+ or admin cookie | write display/thumbnail to R2 |
| POST | `/api/admin/media/import-dalong-manual` | editor+ or admin cookie | external images → R2 |
| POST | `/api/admin/ai/catalog-fill` | editor+ or admin cookie | OpenAI-generated draft |
| GET/POST | `/api/admin/store/products` | editor+ or admin cookie | list/create store products |
| PUT | `/api/admin/store/products/:id` | editor+ or admin cookie | edit/hide/publish product and stock |
| GET | `/api/admin/store/orders` | editor+ or admin cookie | list orders including shipping data |
| PUT | `/api/admin/store/orders/:id` | editor+ or admin cookie | transition order; paid deducts stock |

หมายเหตุ: `isAuthorized` ยอมรับ `editor`, `admin`, `super_admin` เหมือนกันสำหรับ admin endpoints ที่ตรวจพบ ดังนั้นคำว่า “editor+” ในตารางไม่ได้หมายถึง permission matrix ที่ละเอียดกว่า

## Database map

| Table | Owner/features | Sensitive fields | Lifecycle issue |
|---|---|---|---|
| `catalog_items` | F001, F002, F007-F009 | payload อาจมี affiliate/source URLs | dual-source overlay, soft-delete/tombstone |
| `categories` | F001, F006 | none expected | runtime schema mutation, reorder atomicity |
| `users` | F004, F005 | email, phone, password hash/salt, role | verification/reset/role audit |
| `member_sessions` | F005 | token hash, activity time | expiry cleanup/revoke-all |
| `audit_logs` | F004-F006 intended | user/action/details | coverage และ retention ไม่กำหนด |
| `analytics_views` | F003 | persistent visitor ID, page/time | abuse, dedupe, retention/privacy |
| `store_products` | F015, F016 | ราคาขาย, ราคาต้นทุน (admin-only), stock, media URL | Store API provision schema ที่ขาดและอัปเกรด `level`/`cost_price_satang`; public mapper ต้องไม่คืนราคาต้นทุน |
| `store_orders` | F015, F016 | recipient name, phone, address, note | pending → payment_review → paid/cancelled; retention policy required |

## Known inactive or ambiguous surfaces

- Admin cards “จัดการสินค้า/รูปภาพ/เผยแพร่และลบ” แสดง disabled แต่มี feature ผ่าน catalog manager/editor แล้ว ต้องตัดสินว่าจะอัปเดต navigation หรือคง roadmap เดิม
- `/member/` มี entry page แต่ไม่พบ navigation จากหน้า public
- HG/MG index มีอยู่ แต่ validator และ README หลักเน้น RG; readiness ยังไม่ยืนยัน
- `functions/admin/_middleware.js` ปล่อยผ่านหน้า admin โดยตั้งใจ และพึ่ง API authorization; ต้องคง behavior นี้หากยังใช้ login page เดิม
