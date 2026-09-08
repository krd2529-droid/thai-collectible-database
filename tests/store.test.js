import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createSessionCookie } from '../functions/lib/admin-auth.js';
import { normalizeProduct, productFromRow, validateProduct } from '../functions/lib/store-db.js';
import { normalizeCatalogInput } from '../functions/lib/catalog-db.js';
import { onRequestGet as listProducts } from '../functions/api/store/products/index.js';
import { onRequestGet as listCatalog } from '../functions/api/catalog/index.js';
import { onRequestPost as createOrder } from '../functions/api/store/orders/index.js';
import { onRequestGet as listAdminProducts, onRequestPost as createProduct } from '../functions/api/admin/store/products/index.js';
import { onRequestPut as updateOrder } from '../functions/api/admin/store/orders/[id].js';
import { onRequestPost as uploadMedia } from '../functions/api/admin/media/upload.js';
import { onRequestPost as recordTraffic } from '../functions/api/analytics/view.js';
import { onRequestGet as getTrafficStats } from '../functions/api/analytics/stats.js';
import { extractCoverUrl, extractManualUrls } from '../functions/api/admin/media/import-dalong-manual.js';
import { buildDalongCoverUrl } from '../functions/api/admin/media/dalong-cover.js';
import { normalizeCatalogName, normalizeCatalogSeries, normalizeRecommendedAge } from '../functions/api/admin/ai/catalog-fill.js';

class BoundStatement {
  constructor(db, sql, args) { this.db=db; this.sql=sql; this.args=args; }
  async run() { const result=this.db.prepare(this.sql).run(...this.args); return { meta:{ changes:Number(result.changes), last_row_id:Number(result.lastInsertRowid||0) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results:this.db.prepare(this.sql).all(...this.args) }; }
}
class D1Mock {
  constructor(schema='full') { this.queries=[];this.sqlite=new DatabaseSync(':memory:');if(schema!=='empty')this.sqlite.exec(fs.readFileSync('migrations/0005_store_products_orders.sql','utf8'));if(schema==='full'){this.sqlite.exec(fs.readFileSync('migrations/0003_analytics_views.sql','utf8'));this.sqlite.exec(fs.readFileSync('migrations/0006_store_product_level.sql','utf8'));this.sqlite.exec(fs.readFileSync('migrations/0007_store_product_cost.sql','utf8'));this.sqlite.exec(fs.readFileSync('migrations/0008_analytics_daily_rollup.sql','utf8'));this.sqlite.exec(fs.readFileSync('migrations/0009_store_product_brand.sql','utf8'))} }
  prepare(sql) { this.queries.push(sql);return { bind:(...args)=>new BoundStatement(this.sqlite,sql,args), run:async()=>new BoundStatement(this.sqlite,sql,[]).run(), first:async()=>new BoundStatement(this.sqlite,sql,[]).first(), all:async()=>new BoundStatement(this.sqlite,sql,[]).all() }; }
  async batch(statements) { this.sqlite.exec('BEGIN'); try { const results=[]; for(const statement of statements)results.push(await statement.run()); this.sqlite.exec('COMMIT'); return results; } catch(error) { this.sqlite.exec('ROLLBACK'); throw error; } }
  close() { this.sqlite.close(); }
}
const request=(url,options={})=>new Request(`https://toyskub.test${url}`,options);
const read=response=>response.json();

test('store products have separate One Piece Card and toys category routes',()=>{
  const app=fs.readFileSync('app.js','utf8');
  assert.doesNotMatch(app,/key:\s*["']available-products["']/);
  assert.doesNotMatch(app,/key:\s*["']zippo["']/);
  assert.match(app,/>สินค้าในร้าน</);
  assert.doesNotMatch(app,/\/shop\//);
  assert.match(app,/id="storePreviewGrid"/);
  assert.match(app,/label: 'การ์ดวันพีช'/);
  assert.match(app,/label: 'ของเล่น'/);
  assert.match(app,/data-store-category="\$\{category\.apiKey\}"/);
  assert.match(app,/href="\/stock\/onepiececard\//);
  assert.match(app,/href="\/stock\/toys\//);
  assert.match(app,/renderStoreCategory/);
  assert.match(app,/renderStoreProduct/);
  assert.match(app,/beginStoreCheckout/);
  assert.match(app,/class="catalog-series-heading" aria-label="แคตตาล็อก"/);
  assert.match(app,/<h2>แคตตาล็อก<\/h2>/);
  const index=fs.readFileSync('index.html','utf8');
  assert.doesNotMatch(index,/href="\/shop\/"/);
  assert.match(index,/id="storeCheckoutDialog"/);
  assert.match(index,/444-118-1181/);
  const adminStore=fs.readFileSync('admin/store/store.js','utf8');
  assert.match(adminStore,/categorySlug/);
  assert.match(adminStore,/publicProductPath/);
  assert.match(adminStore,/ยังไม่เผยแพร่/);
  assert.match(adminStore,/order-product-link/);
  const adminStoreHtml=fs.readFileSync('admin/store/index.html','utf8');
  assert.match(adminStoreHtml,/id="productPublicUrl"/);
  assert.match(adminStoreHtml,/href="\/stock\/onepiececard\/"/);
  assert.match(adminStoreHtml,/href="\/stock\/toys\/"/);
  assert.match(adminStoreHtml,/id="productCategory"/);
  assert.match(adminStoreHtml,/id="productBrand"/);
  assert.match(adminStoreHtml,/แสดงเฉพาะหลังบ้าน ไม่ส่งออกหน้าร้าน/);
});

test('normalizes product money and rejects negative stock',()=>{
  const valid=normalizeProduct({id:' OP Card 001 ',name:'การ์ดทดสอบ',brand:' Bandai ',level:'  SR  ',price:19.99,costPrice:12.5,stockQuantity:2,status:'published'});
  assert.equal(valid.id,'op-card-001');assert.equal(valid.brand,'Bandai');assert.equal(valid.level,'SR');assert.equal(valid.priceSatang,1999);assert.equal(valid.costPriceSatang,1250);assert.equal(validateProduct(valid),'');
  assert.match(validateProduct(normalizeProduct({...valid,stockQuantity:-1})),/ไม่ติดลบ/);
  assert.match(validateProduct(normalizeProduct({...valid,price:19.99,costPrice:-1})),/ราคาต้นทุน/);
  assert.equal(normalizeProduct({...valid,category:'toys'}).category,'toys');
});

test('public store API filters products by requested shop category',async(t)=>{
  const db=new D1Mock();t.after(()=>db.close());
  db.sqlite.prepare("INSERT INTO store_products(id,name,category,price_satang,stock_quantity,status) VALUES(?,?,?,?,?,?)").run('op-card','Card','one-piece-card',10000,1,'published');
  db.sqlite.prepare("INSERT INTO store_products(id,name,brand,category,price_satang,cost_price_satang,stock_quantity,status) VALUES(?,?,?,?,?,?,?,?)").run('toy-001','Toy','Bandai','toys',20000,12500,2,'published');
  db.queries=[];
  const response=await listProducts({env:{TOYSKUB_DB:db},request:request('/api/store/products?category=toys')});
  assert.equal(response.status,200);
  const data=await read(response);
  assert.deepEqual(data.products.map(product=>product.id),['toy-001']);
  assert.equal(data.products[0].category,'toys');
  assert.equal(data.products[0].brand,'Bandai');
  assert.equal('costPrice' in data.products[0],false);
  assert.equal(db.queries.length,1);
  assert.doesNotMatch(db.queries.join(' '),/\b(?:CREATE|ALTER|PRAGMA)\b/i);
  assert.match(response.headers.get('cache-control'),/s-maxage=30/);
});

test('public catalog reads only visible overlays and compact exclusion ids',async(t)=>{
  const db=new D1Mock();t.after(()=>db.close());
  db.sqlite.exec(`CREATE TABLE catalog_items(id TEXT PRIMARY KEY,status TEXT NOT NULL,sort_order INTEGER NOT NULL,payload_json TEXT NOT NULL);
    CREATE INDEX idx_catalog_status_sort ON catalog_items(status,sort_order,id)`);
  const insert=db.sqlite.prepare('INSERT INTO catalog_items VALUES(?,?,?,?)');
  insert.run('rg-001','published',1,JSON.stringify({id:'rg-001',name:'RG One',status:'published'}));
  insert.run('rg-draft','draft',2,JSON.stringify({id:'rg-draft',name:'Draft'}));
  insert.run('rg-hidden','hidden',3,'not-json-and-must-not-be-parsed');
  db.queries=[];
  const response=await listCatalog({env:{TOYSKUB_DB:db}});
  assert.equal(response.status,200);
  const data=await read(response);
  assert.deepEqual(data.items.map(item=>item.id),['rg-001']);
  assert.deepEqual(data.excludedIds,['rg-hidden']);
  assert.equal(db.queries.length,2);
  assert.ok(db.queries.every(sql=>/WHERE status/.test(sql)));
  assert.doesNotMatch(db.queries.join(' '),/\b(?:CREATE|ALTER|PRAGMA)\b/i);
  assert.match(response.headers.get('cache-control'),/s-maxage=60/);
});

test('media upload reports missing storage and storage failures clearly',async()=>{
  const secret='upload-test-secret';
  const cookie=await createSessionCookie(secret);
  const makeUploadRequest=()=>{const form=new FormData();form.append('id','op11-080');form.append('kind','store');form.append('file',new File(['image'],'card.png',{type:'image/png'}));return request('/api/admin/media/upload',{method:'POST',headers:{cookie},body:form})};
  const missing=await uploadMedia({request:makeUploadRequest(),env:{ADMIN_PASSWORD:secret}});
  assert.equal(missing.status,503);assert.match((await read(missing)).error,/TOYSKUB_MEDIA/);
  const failed=await uploadMedia({request:makeUploadRequest(),env:{ADMIN_PASSWORD:secret,TOYSKUB_MEDIA:{put:async()=>{throw Error('storage unavailable')}}}});
  assert.equal(failed.status,503);assert.match((await read(failed)).error,/พื้นที่จัดเก็บ/);
});

test('admin product create provisions empty and upgrades legacy store schema',async(t)=>{
  const secret='schema-test-secret';const cookie=(await createSessionCookie(secret)).split(';')[0];
  for(const schema of ['empty','legacy']){
    const db=new D1Mock(schema);t.after(()=>db.close());
    const form=new FormData();form.append('id',`op-${schema}`);form.append('kind','store');form.append('file',new File(['image'],'card.webp',{type:'image/webp'}));
    const uploaded=await uploadMedia({request:request('/api/admin/media/upload',{method:'POST',headers:{cookie},body:form}),env:{ADMIN_PASSWORD:secret,TOYSKUB_MEDIA:{put:async()=>{}}}});
    assert.equal(uploaded.status,200);const imageUrl=(await read(uploaded)).url;
    const body={id:`op-${schema}`,name:'Gear 2',brand:'Bandai',description:'ใบ RAW ไม่มีตำหนิ',level:'PA',price:10000,costPrice:7500,stockQuantity:4,status:'draft',imageUrl};
    const response=await createProduct({env:{TOYSKUB_DB:db,ADMIN_PASSWORD:secret},request:request('/api/admin/store/products',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)})});
    assert.equal(response.status,201,`${schema}: ${JSON.stringify(await read(response.clone()))}`);
    const saved=db.sqlite.prepare('SELECT level,brand,cost_price_satang,stock_quantity FROM store_products WHERE id=?').get(`op-${schema}`);
    assert.equal(saved.level,'PA');assert.equal(saved.brand,'Bandai');assert.equal(saved.cost_price_satang,750000);assert.equal(saved.stock_quantity,4);
  }
});

test('zero available stock is always presented as sold_out',()=>{
  const product=productFromRow({id:'op-0',name:'หมด',priceSatang:10000,stockQuantity:0,reservedQuantity:0,status:'published'});
  assert.equal(product.availableStock,0);assert.equal(product.status,'sold_out');
});

test('traffic uses daily rollups without hot-path schema work or raw events',async(t)=>{
  const db=new D1Mock();t.after(()=>db.close());
  const viewSource=fs.readFileSync('functions/api/analytics/view.js','utf8');
  const statsSource=fs.readFileSync('functions/api/analytics/stats.js','utf8');
  assert.doesNotMatch(viewSource,/CREATE TABLE|CREATE INDEX|analytics_views/);
  assert.doesNotMatch(statsSource,/CREATE TABLE|CREATE INDEX|analytics_views|COUNT\(DISTINCT/);
  for(const pageId of ['home','home','rg-001']){
    const response=await recordTraffic({env:{TOYSKUB_DB:db},request:request('/api/analytics/view',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pageId,visitorId:crypto.randomUUID()})})});
    assert.equal(response.status,200);
  }
  const site=await read(await getTrafficStats({env:{TOYSKUB_DB:db},request:request('/api/analytics/stats')}));
  assert.equal(site.today,3);assert.equal(site.sevenDays,3);assert.equal(site.thirtyDays,3);assert.equal(site.total,3);
  const page=await read(await getTrafficStats({env:{TOYSKUB_DB:db},request:request('/api/analytics/stats?pageId=home')}));
  assert.equal(page.pageViews,2);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS total FROM analytics_views').get().total,0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS total FROM analytics_daily').get().total,2);
});

test('traffic migration rolls up old events and preserves the raw table',()=>{
  const sqlite=new DatabaseSync(':memory:');
  try{
    sqlite.exec(fs.readFileSync('migrations/0003_analytics_views.sql','utf8'));
    const insert=sqlite.prepare('INSERT INTO analytics_views(page_id,visitor_id,viewed_at) VALUES(?,?,?)');
    insert.run('home','visitor-a','2026-08-20 01:00:00');
    insert.run('home','visitor-a','2026-08-20 02:00:00');
    insert.run('home','visitor-b','2026-08-20 03:00:00');
    insert.run('rg-001','visitor-a','2026-08-20 04:00:00');
    sqlite.exec(fs.readFileSync('migrations/0008_analytics_daily_rollup.sql','utf8'));
    assert.equal(sqlite.prepare("SELECT view_count FROM analytics_daily WHERE day='2026-08-20' AND page_id='home'").get().view_count,2);
    assert.equal(sqlite.prepare("SELECT view_count FROM analytics_totals WHERE page_id='home'").get().view_count,2);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM analytics_views').get().total,4);
    const plan=sqlite.prepare("EXPLAIN QUERY PLAN SELECT SUM(view_count) FROM analytics_daily WHERE day>=date('now','-29 days')").all().map(row=>row.detail).join(' ');
    assert.match(plan,/INDEX|PRIMARY KEY/i);
  }finally{sqlite.close()}
});

test('traffic self-provisions rollups once when migration cannot be run manually',async(t)=>{
  const db=new D1Mock('empty');t.after(()=>db.close());
  const recorded=await recordTraffic({env:{TOYSKUB_DB:db},request:request('/api/analytics/view',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pageId:'home',visitorId:'visitor-a'})})});
  assert.equal(recorded.status,200);
  assert.equal(db.sqlite.prepare("SELECT view_count FROM analytics_daily WHERE page_id='home'").get().view_count,1);
  const stats=await read(await getTrafficStats({env:{TOYSKUB_DB:db},request:request('/api/analytics/stats')}));
  assert.equal(stats.total,1);
  const helper=fs.readFileSync('functions/lib/analytics-db.js','utf8');
  assert.match(helper,/no such table/);
  assert.match(helper,/CREATE TABLE IF NOT EXISTS analytics_daily/);
});

test('auto catalog extracts Dalong cover and manual links and remains draft-first',()=>{
  const page='https://www.dalong.net/reviews/rg/rg32/rg32_i.htm';
  const html='<img src="th/s_rg32.jpg"><img src="th/s_rg32_box.jpg"><img src="th/s_rg32m_0001.jpg"><img src="th/s_rg32m_0002.jpg"><img src="th/s_rg32_runner.jpg">';
  assert.equal(extractCoverUrl(html,page),'https://www.dalong.net/reviews/rg/rg32/p/rg32.jpg');
  assert.deepEqual(extractManualUrls(html,page),[
    'https://www.dalong.net/reviews/rg/rg32/p/rg32m_0001.jpg',
    'https://www.dalong.net/reviews/rg/rg32/p/rg32m_0002.jpg'
  ]);
  const ai=fs.readFileSync('functions/api/admin/ai/catalog-fill.js','utf8');
  assert.match(ai,/dalongPageUrl/);assert.match(ai,/_i\.htm/);
  const template=fs.readFileSync('admin/rg-template/template.js','utf8');
  assert.match(template,/runAutoCatalog/);assert.match(template,/saveItem\(false,'draft'\)/);
  assert.match(template,/ระบบจะไม่ Publish เอง/);
  assert.equal(normalizeCatalogSeries('Real Grade (RG)'),null);
  assert.equal(normalizeCatalogSeries('RG'),null);
  assert.equal(normalizeCatalogSeries("Mobile Suit Gundam: Char's Counterattack"),"Mobile Suit Gundam: Char's Counterattack");
  assert.match(ai,/series ต้องเป็นชื่อซีรีส์\/ผลงานต้นทาง/);
  assert.equal(normalizeCatalogName('Nu Gundam'),'Nu Gundam');
  assert.equal(normalizeCatalogName('นิวกันดั้ม'),null);
  assert.match(ai,/ชื่อรุ่นภาษาอังกฤษ/);
  assert.equal(normalizeRecommendedAge(),'15 ปีขึ้นไป');
  assert.match(ai,/ชื่อนั้นค้นเฉพาะ bandai-hobby\.net/);
  assert.match(ai,/ยืนยันความสูงเมื่อประกอบ/);
});

test('catalog manager falls back to Dalong cover when an RG image is missing',()=>{
  const manager=fs.readFileSync('admin/catalog/catalog.js','utf8');
  assert.match(manager,/function dalongCoverFallback/);
  assert.match(manager,/\/api\/admin\/media\/dalong-cover\?id=rg-/);
  assert.match(manager,/data-fallback/);
  assert.doesNotMatch(manager,/onerror="this\.style\.visibility='hidden'"/);
  assert.equal(buildDalongCoverUrl('rg-031'),'https://www.dalong.net/reviews/rg/rg31/p/rg31.jpg');
  assert.equal(buildDalongCoverUrl('../etc/passwd'),'');
});

test('MGSD admin template keeps MGSD identifiers and catalog paths separate from RG',()=>{
  const page=fs.readFileSync('admin/mgsd-template/index.html','utf8');
  const template=fs.readFileSync('admin/rg-template/template.js','utf8');
  const manager=fs.readFileSync('admin/catalog/catalog.js','utf8');
  const ai=fs.readFileSync('functions/api/admin/ai/catalog-fill.js','utf8');
  assert.match(page,/data-template-line="MGSD"/);
  assert.match(page,/MGSD INLINE TEMPLATE/);
  assert.match(page,/Auto Catalog/);
  assert.match(template,/numberKey:'mgsdNumber'/);
  assert.match(template,/dataFolder:'mgsd'/);
  assert.match(template,/catalogLine:templateConfig\.line/);
  assert.match(manager,/"mgsd-template"/);
  assert.match(ai,/MGSD เท่านั้น/);
  const item=normalizeCatalogInput({id:'mgsd-006',name:'MGSD Test Gundam',categoryCode:'gd',productType:'Gunpla',productTypeCode:'gp',line:'MGSD',mgsdNumber:6,scale:'Non-scale'});
  assert.equal(item.mgsdNumber,6);
  assert.equal(item.rgNumber,null);
  assert.equal(item.lineCode,'mgsd');
  assert.equal(item.catalogPath,'gd/gp/mgsd');
  assert.equal(item.sortOrder,6);
});

test('public order reserves availability and rejects overselling',async(t)=>{
  const db=new D1Mock();t.after(()=>db.close());
  db.sqlite.prepare("INSERT INTO store_products(id,name,price_satang,stock_quantity,status) VALUES(?,?,?,?,?)").run('op-001','Starter Deck',25000,2,'published');
  const productsResponse=await listProducts({env:{TOYSKUB_DB:db}});const products=await read(productsResponse);
  assert.equal(products.products[0].availableStock,2);
  assert.equal('costPrice' in products.products[0],false);
  const payload={productId:'op-001',quantity:2,clientToken:crypto.randomUUID(),customerName:'สมชาย ใจดี',customerPhone:'0812345678',shippingAddress:'99 ถนนสุขุมวิท กรุงเทพมหานคร',customerNote:''};
  const first=await createOrder({env:{TOYSKUB_DB:db},request:request('/api/store/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})});
  assert.equal(first.status,201);const firstData=await read(first);assert.match(firstData.order.reference,/^TOY-\d{8}-[A-F0-9]{8}$/);assert.equal('shippingAddress' in firstData.order,false);
  const duplicate=await createOrder({env:{TOYSKUB_DB:db},request:request('/api/store/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})});
  assert.equal(duplicate.status,200);assert.equal((await read(duplicate)).order.reference,firstData.order.reference);
  const second=await createOrder({env:{TOYSKUB_DB:db},request:request('/api/store/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,quantity:1,clientToken:crypto.randomUUID()})})});
  assert.equal(second.status,409);
  assert.equal(db.sqlite.prepare('SELECT stock_quantity FROM store_products WHERE id=?').get('op-001').stock_quantity,2);
});

test('admin API requires auth and paid transition deducts stock once',async(t)=>{
  const db=new D1Mock();t.after(()=>db.close());const env={TOYSKUB_DB:db,ADMIN_PASSWORD:'test-admin-secret'};
  const denied=await createProduct({env,request:request('/api/admin/store/products',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})});assert.equal(denied.status,401);
  const cookie=(await createSessionCookie(env.ADMIN_PASSWORD)).split(';')[0];
  const productBody={id:'op-002',name:'Booster Pack',description:'สินค้า test',level:'SEC',price:120,costPrice:80,stockQuantity:1,status:'published',sortOrder:1,imageUrl:''};
  const created=await createProduct({env,request:request('/api/admin/store/products',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(productBody)})});assert.equal(created.status,201);
  assert.equal(db.sqlite.prepare('SELECT level FROM store_products WHERE id=?').get('op-002').level,'SEC');
  assert.equal(db.sqlite.prepare('SELECT cost_price_satang FROM store_products WHERE id=?').get('op-002').cost_price_satang,8000);
  const adminProducts=await read(await listAdminProducts({env,request:request('/api/admin/store/products',{headers:{cookie}})}));assert.equal(adminProducts.products[0].costPrice,80);
  const orderPayload={productId:'op-002',quantity:1,clientToken:crypto.randomUUID(),customerName:'ผู้รับ ทดสอบ',customerPhone:'0899999999',shippingAddress:'100 ถนนทดสอบ เขตทดสอบ กรุงเทพมหานคร'};
  await createOrder({env,request:request('/api/store/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(orderPayload)})});
  const id=Number(db.sqlite.prepare('SELECT id FROM store_orders').get().id);
  const review=await updateOrder({env,params:{id:String(id)},request:request(`/api/admin/store/orders/${id}`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({status:'payment_review'})})});assert.equal(review.status,200);
  const paid=await updateOrder({env,params:{id:String(id)},request:request(`/api/admin/store/orders/${id}`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({status:'paid'})})});assert.equal(paid.status,200);
  assert.equal(db.sqlite.prepare('SELECT stock_quantity FROM store_products WHERE id=?').get('op-002').stock_quantity,0);
  const repeated=await updateOrder({env,params:{id:String(id)},request:request(`/api/admin/store/orders/${id}`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({status:'paid'})})});assert.equal(repeated.status,409);
  assert.equal(db.sqlite.prepare('SELECT stock_quantity FROM store_products WHERE id=?').get('op-002').stock_quantity,0);
});
