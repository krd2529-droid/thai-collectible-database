const $ = (id) => document.getElementById(id);
const BANK_ACCOUNT = '444-118-1181';
const FACEBOOK_URL = 'https://www.facebook.com/IndyKookkoo/';
const ACTIVE_CATEGORY = new URLSearchParams(location.search).get('category');
let selected = null;
let orderMessage = '';
let clientToken = '';
const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const money = (value) => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(Number(value)||0);
function message(text='', type='') { const el=$('message'); el.textContent=text; el.className=text?`message ${type}`:'message hidden'; }
function checkoutMessage(text='', type='') { const el=$('checkoutMessage'); el.textContent=text; el.className=text?`message ${type}`:'message hidden'; }
function render(products) {
  $('products').innerHTML = products.length ? products.map((p) => { const soldOut=p.availableStock<1||p.status==='sold_out'; return `<article class="product-card"><div class="product-image">${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}">`:'<span>ยังไม่มีรูปสินค้า</span>'}</div><div class="product-body"><h2>${esc(p.name)}</h2>${p.level?`<small>ระดับ ${esc(p.level)}</small>`:''}<p class="description">${esc(p.description||'')}</p><div class="price">${money(p.price)}</div><div class="stock ${soldOut?'sold-out':''}">${soldOut?'Sold out':`พร้อมขาย ${p.availableStock} ชิ้น`}</div><div class="buy-row"><input id="qty-${esc(p.id)}" type="number" min="1" max="${p.availableStock}" value="1" aria-label="จำนวน ${esc(p.name)}" ${soldOut?'disabled':''}><button data-buy="${esc(p.id)}" type="button" ${soldOut?'disabled':''}>${soldOut?'Sold out':'ซื้อสินค้า'}</button></div></div></article>`; }).join('') : '<div class="message">ยังไม่มีสินค้าการ์ดวันพีชที่เผยแพร่</div>';
  $('products').querySelectorAll('[data-buy]').forEach((button)=>button.addEventListener('click',()=>{const product=products.find((item)=>item.id===button.dataset.buy);const quantity=Number($(`qty-${product.id}`).value);if(!Number.isInteger(quantity)||quantity<1||quantity>product.availableStock)return message('จำนวนสินค้าไม่ถูกต้อง','error');selected={product,quantity};clientToken=crypto.randomUUID();$('checkoutSummary').innerHTML=`<b>${esc(product.name)}</b><br>จำนวน ${quantity} × ${money(product.price)}<br><strong>ยอดรวม ${money(product.price*quantity)}</strong>`;$('createOrder').disabled=false;$('createOrder').classList.remove('hidden');$('facebookButton').classList.add('hidden');checkoutMessage();$('checkoutDialog').showModal()}));
}
async function load(){
  if(ACTIVE_CATEGORY!=='one-piece-card'){message();$('products').innerHTML='';return}
  $('shopCategories').classList.add('hidden');
  $('shopCrumb').innerHTML='<a href="/">หน้าหลัก</a> › <a href="/shop/">สินค้าที่มีจำหน่าย</a> › <strong>การ์ดวันพีช</strong>';
  $('shopTitle').textContent='การ์ดวันพีช';
  $('shopSubtitle').textContent='One Piece Card · เลือกสินค้าและจำนวน ระบบจะจองรายการไว้รอตรวจสอบการชำระเงิน';
  document.title='การ์ดวันพีชพร้อมจำหน่าย · TOYSKUB';
  const response=await fetch('/api/store/products?category=one-piece-card',{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'โหลดสินค้าไม่สำเร็จ');message();render(data.products||[])
}
$('closeCheckout').addEventListener('click',()=>$('checkoutDialog').close());
$('copyAccount').addEventListener('click',async()=>{await navigator.clipboard.writeText(BANK_ACCOUNT);checkoutMessage('คัดลอกเลขบัญชีแล้ว')});
$('checkoutForm').addEventListener('submit',async(event)=>{event.preventDefault();if(!selected)return;const button=$('createOrder');button.disabled=true;button.textContent='กำลังสร้างคำสั่งซื้อ…';checkoutMessage();try{const payload={productId:selected.product.id,quantity:selected.quantity,clientToken,customerName:$('customerName').value,customerPhone:$('customerPhone').value,shippingAddress:$('shippingAddress').value,customerNote:$('customerNote').value};const response=await fetch('/api/store/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'สร้างคำสั่งซื้อไม่สำเร็จ');const order=data.order;orderMessage=`แจ้งชำระคำสั่งซื้อ ${order.reference}\nสินค้า: ${order.productName}\nจำนวน: ${order.quantity}\nยอดรวม: ${money(order.total)}`;checkoutMessage(`สร้างคำสั่งซื้อ ${order.reference} แล้ว กรุณาชำระเงินและส่งหลักฐานทาง Facebook`);button.classList.add('hidden');const facebook=$('facebookButton');facebook.classList.remove('hidden');facebook.href=FACEBOOK_URL}catch(error){checkoutMessage(error.message,'error');button.disabled=false}finally{button.textContent='ยืนยันและสร้างคำสั่งซื้อ'}});
$('facebookButton').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(orderMessage)}catch{}});
load().catch((error)=>message(error.message,'error'));
