import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createSessionCookie } from '../functions/lib/admin-auth.js';
import { normalizeProduct, productFromRow, validateProduct } from '../functions/lib/store-db.js';
import { onRequestGet as listProducts } from '../functions/api/store/products/index.js';
import { onRequestPost as createOrder } from '../functions/api/store/orders/index.js';
import { onRequestGet as listAdminProducts, onRequestPost as createProduct } from '../functions/api/admin/store/products/index.js';
import { onRequestPut as updateOrder } from '../functions/api/admin/store/orders/[id].js';
import { onRequestPost as uploadMedia } from '../functions/api/admin/media/upload.js';

class BoundStatement {
  constructor(db, sql, args) { this.db=db; this.sql=sql; this.args=args; }
  async run() { const result=this.db.prepare(this.sql).run(...this.args); return { meta:{ changes:Number(result.changes), last_row_id:Number(result.lastInsertRowid||0) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results:this.db.prepare(this.sql).all(...this.args) }; }
}
class D1Mock {
  constructor(schema='full') { this.sqlite=new DatabaseSync(':memory:');if(schema!=='empty')this.sqlite.exec(fs.readFileSync('migrations/0005_store_products_orders.sql','utf8'));if(schema==='full'){this.sqlite.exec(fs.readFileSync('migrations/0006_store_product_level.sql','utf8'));this.sqlite.exec(fs.readFileSync('migrations/0007_store_product_cost.sql','utf8'))} }
  prepare(sql) { return { bind:(...args)=>new BoundStatement(this.sqlite,sql,args), run:async()=>new BoundStatement(this.sqlite,sql,[]).run(), first:async()=>new BoundStatement(this.sqlite,sql,[]).first(), all:async()=>new BoundStatement(this.sqlite,sql,[]).all() }; }
  async batch(statements) { this.sqlite.exec('BEGIN'); try { const results=[]; for(const statement of statements)results.push(await statement.run()); this.sqlite.exec('COMMIT'); return results; } catch(error) { this.sqlite.exec('ROLLBACK'); throw error; } }
  close() { this.sqlite.close(); }
}
const request=(url,options={})=>new Request(`https://toyskub.test${url}`,options);
const read=response=>response.json();

test('store products and checkout live directly on the home page',()=>{
  const app=fs.readFileSync('app.js','utf8');
  assert.doesNotMatch(app,/key:\s*["']available-products["']/);
  assert.doesNotMatch(app,/key:\s*["']zippo["']/);
  assert.match(app,/>สินค้าในร้าน</);
  assert.doesNotMatch(app,/\/shop\//);
  assert.match(app,/id="storePreviewGrid"/);
  assert.match(app,/<h2>การ์ดวันพีช<\/h2>/);
  assert.match(app,/data-store-category="one-piece-card"/);
  assert.match(app,/data-store-buy=/);
  assert.match(app,/beginStoreCheckout/);
  assert.match(app,/class="catalog-series-heading" aria-label="แคตตาล็อก"/);
  assert.match(app,/<h2>แคตตาล็อก<\/h2>/);
  const index=fs.readFileSync('index.html','utf8');
  assert.doesNotMatch(index,/href="\/shop\/"/);
  assert.match(index,/id="storeCheckoutDialog"/);
  assert.match(index,/444-118-1181/);
});

test('normalizes product money and rejects negative stock',()=>{
  const valid=normalizeProduct({id:' OP Card 001 ',name:'การ์ดทดสอบ',level:'  SR  ',price:19.99,costPrice:12.5,stockQuantity:2,status:'published'});
  assert.equal(valid.id,'op-card-001');assert.equal(valid.level,'SR');assert.equal(valid.priceSatang,1999);assert.equal(valid.costPriceSatang,1250);assert.equal(validateProduct(valid),'');
  assert.match(validateProduct(normalizeProduct({...valid,stockQuantity:-1})),/ไม่ติดลบ/);
  assert.match(validateProduct(normalizeProduct({...valid,price:19.99,costPrice:-1})),/ราคาต้นทุน/);
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
    const body={id:`op-${schema}`,name:'Gear 2',description:'ใบ RAW ไม่มีตำหนิ',level:'PA',price:10000,costPrice:7500,stockQuantity:4,status:'draft',imageUrl};
    const response=await createProduct({env:{TOYSKUB_DB:db,ADMIN_PASSWORD:secret},request:request('/api/admin/store/products',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)})});
    assert.equal(response.status,201,`${schema}: ${JSON.stringify(await read(response.clone()))}`);
    const saved=db.sqlite.prepare('SELECT level,cost_price_satang,stock_quantity FROM store_products WHERE id=?').get(`op-${schema}`);
    assert.equal(saved.level,'PA');assert.equal(saved.cost_price_satang,750000);assert.equal(saved.stock_quantity,4);
  }
});

test('zero available stock is always presented as sold_out',()=>{
  const product=productFromRow({id:'op-0',name:'หมด',priceSatang:10000,stockQuantity:0,reservedQuantity:0,status:'published'});
  assert.equal(product.availableStock,0);assert.equal(product.status,'sold_out');
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
