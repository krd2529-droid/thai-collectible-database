const $=id=>document.getElementById(id);
let gallery=[],manual=[],editingId=null,dragSource=null,mediaTarget='gallery',mediaCandidates=[],mediaSelected=new Set();
const lists={highlights:[],differences:[],box:[],notIncluded:[],pros:[],considerations:[],faq:[],references:[]};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showMessage(title,message){$('dialogTitle').textContent=title;$('dialogMessage').textContent=message;$('messageDialog').showModal()}
$('dialogClose').onclick=()=>$('messageDialog').close();
function setDirty(text='มีการแก้ไขยังไม่บันทึก'){$('saveState').textContent=text;$('saveState').style.color='var(--red)'}
document.addEventListener('input',()=>setDirty());
function emptyRow(type){if(type==='differences')return {title:'',detail:''};if(type==='faq')return {q:'',a:''};if(type==='references')return {label:'',url:''};return ''}
function renderList(type){
 const map={highlights:'highlightsList',differences:'differencesList',box:'boxContentsList',notIncluded:'notIncludedList',pros:'prosList',considerations:'considerationsList',faq:'faqList',references:'referencesList'};
 const el=$(map[type]),data=lists[type];
 if(['differences','faq','references'].includes(type)){
  el.innerHTML=data.map((x,i)=> type==='differences'?`<div class="pair-row"><input data-list="${type}" data-i="${i}" data-key="title" value="${esc(x.title)}" placeholder="ชื่อหัวข้อ"><textarea data-list="${type}" data-i="${i}" data-key="detail" placeholder="รายละเอียด">${esc(x.detail)}</textarea><button class="remove-row" data-remove="${type}" data-i="${i}">ลบ</button></div>`:type==='faq'?`<div class="pair-row"><input data-list="${type}" data-i="${i}" data-key="q" value="${esc(x.q)}" placeholder="คำถาม"><textarea data-list="${type}" data-i="${i}" data-key="a" placeholder="คำตอบ">${esc(x.a)}</textarea><button class="remove-row" data-remove="${type}" data-i="${i}">ลบ</button></div>`:`<div class="reference-row"><input data-list="${type}" data-i="${i}" data-key="label" value="${esc(x.label)}" placeholder="ชื่อแหล่งอ้างอิง"><input data-list="${type}" data-i="${i}" data-key="url" value="${esc(x.url)}" placeholder="URL"><button class="remove-row" data-remove="${type}" data-i="${i}">ลบ</button></div>`).join('');
 } else {
  el.innerHTML=data.map((x,i)=>`<div class="repeat-row"><input data-list="${type}" data-i="${i}" value="${esc(x)}" placeholder="${type==='box'?'ชื่ออุปกรณ์':type==='notIncluded'?'รายการที่ไม่มีในกล่อง':'กรอกข้อความ'}"><button class="remove-row" data-remove="${type}" data-i="${i}">ลบ</button></div>`).join('');
 }
}
function add(type){lists[type].push(emptyRow(type));renderList(type);setDirty()}
document.addEventListener('click',e=>{const aliases={highlight:'highlights',difference:'differences',pro:'pros',consideration:'considerations',reference:'references'};const rawType=e.target.dataset.add;const type=aliases[rawType]||rawType;if(type){if(!lists[type])return;add(type);return}const rem=e.target.dataset.remove;if(rem){lists[rem].splice(Number(e.target.dataset.i),1);renderList(rem);setDirty()}});
document.addEventListener('input',e=>{const type=e.target.dataset.list;if(!type)return;const i=Number(e.target.dataset.i),key=e.target.dataset.key;if(key)lists[type][i][key]=e.target.value;else lists[type][i]=e.target.value});
function initializeRows(){['highlights','differences','box','notIncluded','pros','considerations','faq','references'].forEach(t=>{if(!lists[t].length)add(t)});$('saveState').textContent='เทมเพลตเปล่า';$('saveState').style.color=''}

document.querySelectorAll('.edit-block').forEach(btn=>btn.onclick=()=>{const block=btn.closest('.template-block');block.classList.add('editing');block.querySelectorAll('[contenteditable]').forEach(x=>x.contentEditable='true');block.querySelector('input,textarea,[contenteditable="true"]')?.focus()});
document.querySelectorAll('.save-block').forEach(btn=>btn.onclick=async()=>{const block=btn.closest('.template-block');block.classList.remove('editing');block.querySelectorAll('[contenteditable]').forEach(x=>x.contentEditable='false');await saveItem(false)});

async function compressImage(file,max=1100,quality=.78,suffix=''){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{let w=img.width,h=img.height;if(Math.max(w,h)>max){const r=max/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);const base=file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]+/g,'-')||'image';c.toBlob(blob=>blob?resolve({file:new File([blob],`${base}${suffix}.webp`,{type:'image/webp'}),width:w,height:h,originalBytes:file.size,optimizedBytes:blob.size}):reject(new Error('แปลงรูปไม่สำเร็จ')),'image/webp',quality)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'))};img.src=url})}
async function uploadMediaFile(file,target){const id=val('itemId').toLowerCase();if(!id)throw new Error('กรุณากรอกรหัสรายการก่อนอัปโหลดรูป');const display=await compressImage(file,target==='manual'?1600:1200,target==='manual'?.82:.78);const thumb=await compressImage(file,400,.72,'-thumb');const form=new FormData();form.append('file',display.file);form.append('thumbnail',thumb.file);form.append('id',id);form.append('kind',target);const r=await fetch('/api/admin/media/upload',{method:'POST',body:form,cache:'no-store'});const d=await r.json().catch(()=>({}));if(r.status===401){location.href='/admin/';throw new Error('กรุณาเข้าสู่ระบบใหม่')}if(!r.ok)throw new Error(d.error||'อัปโหลดรูปไม่สำเร็จ');return {src:d.url,thumbSrc:d.thumbnailUrl||d.url,name:d.name||display.file.name,width:display.width,height:display.height,originalBytes:display.originalBytes,optimizedBytes:display.optimizedBytes}}
async function addFiles(files,target){const accepted=[...files].filter(x=>x.type.startsWith('image/'));if(!accepted.length)return;try{$('saveState').textContent=`กำลังอัปโหลด 0/${accepted.length}…`;$('saveState').style.color='var(--blue)';let done=0;for(const f of accepted){const uploaded=await uploadMediaFile(f,target);(target==='manual'?manual:gallery).push(uploaded);done++;$('saveState').textContent=`กำลังอัปโหลด ${done}/${accepted.length}…`;renderImages(target)}setDirty('อัปโหลดรูปสำเร็จ · กด Save Draft เพื่อผูกกับรายการ');showMessage('อัปโหลดรูปสำเร็จ',`อัปโหลดแล้ว ${done} รูป`)}catch(e){showMessage('อัปโหลดรูปไม่สำเร็จ',e.message);$('saveState').textContent='อัปโหลดรูปไม่สำเร็จ';$('saveState').style.color='var(--red)'}}
function renderImages(target){const arr=target==='manual'?manual:gallery,thumbs=$(target==='manual'?'manualThumbs':'galleryThumbs'),main=$(target==='manual'?'mainManualImg':'mainProductImg'),placeholder=$(target==='manual'?'manualPlaceholder':'coverPlaceholder');if(arr.length){main.src=arr[0].src;main.hidden=false;placeholder.hidden=true}else{main.hidden=true;placeholder.hidden=false}thumbs.innerHTML=arr.map((x,i)=>`<span class="thumb-wrap" draggable="true" data-target="${target}" data-i="${i}"><img src="${x.thumbSrc||x.src}" data-index="${i}" loading="lazy" class="${i===0&&target==='gallery'?'cover-thumb':''}" alt="${esc(x.name)}">${i===0&&target==='gallery'?'<span class="cover-chip">COVER</span>':''}<button class="thumb-delete" data-image-remove="${target}" data-i="${i}">×</button></span>`).join('');thumbs.querySelectorAll('img').forEach(img=>img.onclick=()=>{main.src=arr[Number(img.dataset.index)].src;thumbs.querySelectorAll('img').forEach(x=>x.classList.remove('active'));img.classList.add('active')})}
$('uploadGalleryButton').onclick=()=>$('galleryInput').click();$('uploadManualButton').onclick=()=>$('manualInput').click();$('galleryInput').onchange=e=>addFiles(e.target.files,'gallery');$('manualInput').onchange=e=>addFiles(e.target.files,'manual');
async function importManualFromDalong(){
 const id=val('itemId').toLowerCase();
 if(!id){showMessage('ยังไม่มีรหัสรายการ','กรุณากรอกรหัสรายการก่อนดึงรูปคู่มือ');$('itemId')?.focus();return}
 const pageUrl=prompt('วางลิงก์หน้าข้อมูลของ Dalong\nตัวอย่าง https://www.dalong.net/reviews/rg/rg32/rg32_i.htm');
 if(!pageUrl)return;
 const button=$('importManualUrlButton');
 button.disabled=true;
 $('saveState').textContent='กำลังดึงและอัปโหลดรูปคู่มือจาก Dalong…';
 $('saveState').style.color='var(--blue)';
 try{
  const response=await fetch('/api/admin/media/import-dalong-manual',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id,pageUrl})});
  const result=await response.json().catch(()=>({}));
  if(response.status===401){location.href='/admin/';return}
  if(!response.ok)throw Error(result.error||'ดึงรูปคู่มือไม่สำเร็จ');
  const existing=new Set(manual.map(x=>x.src));
  let added=0;
  for(const image of result.images||[]){if(image?.src&&!existing.has(image.src)){manual.push(image);existing.add(image.src);added++}}
  renderImages('manual');
  setDirty(`ดึงรูปคู่มือสำเร็จ ${added} รูป · กด Save Draft เพื่อผูกกับรายการ`);
  showMessage('ดึงรูปคู่มือสำเร็จ',`นำเข้ารูปจาก Dalong แล้ว ${added} รูป${result.skipped?` · ข้าม ${result.skipped} รูปที่โหลดไม่ได้`:''}`);
 }catch(error){
  $('saveState').textContent='ดึงรูปคู่มือไม่สำเร็จ';
  $('saveState').style.color='var(--red)';
  showMessage('ดึงรูปคู่มือไม่สำเร็จ',error.message||'เกิดข้อผิดพลาด');
 }finally{button.disabled=false}
}
$('importManualUrlButton')?.addEventListener('click',importManualFromDalong);
for(const [drop,target] of [[$('galleryDrop'),'gallery'],[$('manualDrop'),'manual']]){drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragover')};drop.ondragleave=()=>drop.classList.remove('dragover');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragover');addFiles(e.dataTransfer.files,target)}}
document.addEventListener('click',e=>{const target=e.target.dataset.imageRemove;if(!target)return;(target==='manual'?manual:gallery).splice(Number(e.target.dataset.i),1);renderImages(target);setDirty()});
document.addEventListener('dragstart',e=>{const w=e.target.closest('.thumb-wrap');if(w)dragSource={target:w.dataset.target,index:Number(w.dataset.i)}});document.addEventListener('dragover',e=>{if(e.target.closest('.thumb-wrap'))e.preventDefault()});document.addEventListener('drop',e=>{const w=e.target.closest('.thumb-wrap');if(!w||!dragSource||w.dataset.target!==dragSource.target)return;e.preventDefault();const arr=w.dataset.target==='manual'?manual:gallery;const [m]=arr.splice(dragSource.index,1);arr.splice(Number(w.dataset.i),0,m);renderImages(w.dataset.target);dragSource=null;setDirty()});
function val(id){const el=$(id);return el&&'value' in el?String(el.value).trim():String(el?.textContent||'').trim()}function num(id){return val(id)===''?null:Number(val(id))}
function normalizeYouTubeEmbed(input){
 const raw=String(input||'').trim();
 if(!raw)return '';
 try{
  const u=new URL(raw,location.origin);
  const host=u.hostname.replace(/^www\./,'').toLowerCase();
  let id='';
  if(host==='youtu.be')id=u.pathname.split('/').filter(Boolean)[0]||'';
  else if(host.endsWith('youtube.com')){
   if(u.pathname.startsWith('/embed/'))id=u.pathname.split('/')[2]||'';
   else if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
   else if(u.pathname.startsWith('/shorts/'))id=u.pathname.split('/')[2]||'';
  }
  return /^[A-Za-z0-9_-]{6,20}$/.test(id)?`https://www.youtube.com/embed/${id}`:'';
 }catch{return ''}
}
function payload(){return {id:val('itemId'),sku:val('itemSku')||val('itemId').toUpperCase(),name:val('name'),category:'model',categoryLabel:'Gundam',categoryCode:'gd',productType:val('productType'),productTypeCode:'gp',line:'RG',lineCode:'rg',grade:'RG',seriesGroup:val('seriesGroup')||'Gundam',seriesGroupOrder:0,rgNumber:num('rgNumber'),modelCode:val('modelCode'),manufacturer:val('manufacturer'),series:val('series'),scale:val('scale'),releaseDate:val('releaseDate'),launchPriceJPY:num('launchPriceJPY'),heightCm:num('heightCm'),recommendedAge:val('recommendedAge'),material:val('material'),images:gallery.map(x=>x.src),imageThumbnails:gallery.map(x=>x.thumbSrc||x.src),imageDimensions:gallery.map(x=>({width:x.width||null,height:x.height||null})),catalogImage:gallery[0]?.thumbSrc||gallery[0]?.src||'',videoEmbedUrl:normalizeYouTubeEmbed(val('videoEmbedUrl')),summary:val('summary'),highlights:lists.highlights.filter(Boolean),whatsDifferent:lists.differences.filter(x=>x.title||x.detail),boxContents:lists.box.filter(Boolean),notIncluded:lists.notIncluded.filter(Boolean),pros:lists.pros.filter(Boolean),considerations:lists.considerations.filter(Boolean),faq:lists.faq.filter(x=>x.q||x.a),references:lists.references.filter(x=>x.label||x.url),sourceName:lists.references[0]?.label||'',sourceUrl:lists.references[0]?.url||'',affiliateLinks:{shopee:val('shopee'),lazada:val('lazada'),tiktok:val('tiktok'),page:val('pageLink')},manualImages:manual.map(x=>x.src),manualThumbnails:manual.map(x=>x.thumbSrc||x.src),manualImageDimensions:manual.map(x=>({width:x.width||null,height:x.height||null})),priceTaxIncluded:false,status:val('status'),catalogStatus:val('status')==='published'?'published':'draft',sortOrder:num('rgNumber')||0,mergeMode:'preserve-existing'}}
async function api(url,options={}){const r=await fetch(url,{cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(r.status===401){location.href='/admin/';throw Error('กรุณาเข้าสู่ระบบใหม่')}if(!r.ok)throw Error(d.error||'เกิดข้อผิดพลาด');return d}
async function saveItem(show=true,forceStatus=''){const p=payload();if(forceStatus){p.status=forceStatus;p.catalogStatus=forceStatus==='published'?'published':'draft';$('status').value=forceStatus}if(!p.id){if(show)showMessage('ยังไม่มีรหัสรายการ','กรุณากรอกรหัสรายการก่อนบันทึก รหัสนี้ใช้สร้าง URL เช่น /product/rg-039');return false}try{$('saveState').textContent='กำลังบันทึก…';let useId=editingId; if(!useId){try{await api(`/api/admin/catalog/${encodeURIComponent(p.id)}`);useId=p.id}catch(e){if(!String(e.message).includes('ไม่พบรายการ'))throw e}} const url=useId?`/api/admin/catalog/${encodeURIComponent(useId)}`:'/api/admin/catalog';await api(url,{method:useId?'PUT':'POST',body:JSON.stringify(p)});editingId=p.id;$('itemId').disabled=true;$('saveState').textContent=p.status==='published'?'เผยแพร่แล้ว':'บันทึกฉบับร่างแล้ว';$('saveState').style.color='var(--blue)';if(show)showMessage('บันทึกสำเร็จ',p.status==='published'?`เผยแพร่ ${p.id} แล้ว`:`บันทึกฉบับร่าง ${p.id} แล้ว ข้อมูลเดิมในช่องที่ไม่ได้กรอกจะยังอยู่`);return true}catch(e){showMessage('บันทึกไม่สำเร็จ',e.message);$('saveState').textContent='บันทึกไม่สำเร็จ';return false}}
$('saveAllButton').onclick=()=>saveItem(true,'draft');$('publishButton').onclick=()=>saveItem(true,'published');$('previewButton').onclick=()=>{const p=payload();localStorage.setItem('toyskub_catalog_preview',JSON.stringify(p));window.open('/#/product-preview','_blank')};
async function deleteCatalog(mode){const id=val('itemId');if(!id){showMessage('ยังไม่มีรหัสรายการ','กรอกรหัสรายการก่อน');return}const permanent=mode==='permanent';const text=permanent?`ลบหน้า ${id} แบบถาวรหรือไม่? หน้านี้จะไม่แสดงแม้มีไฟล์ JSON เก่าอยู่`:`ย้ายหน้า ${id} ไปถังขยะหรือไม่? สามารถกู้คืนได้`;if(!confirm(text))return;try{await api(`/api/admin/catalog/${encodeURIComponent(id)}${permanent?'?permanent=1':''}`,{method:'DELETE'});$('saveState').textContent=permanent?'ลบถาวรแล้ว':'ย้ายไปถังขยะแล้ว';$('saveState').style.color='var(--red)';showMessage(permanent?'ลบถาวรแล้ว':'ย้ายไปถังขยะแล้ว',`หน้า /product/${id} จะไม่แสดงบนเว็บ`)}catch(e){showMessage('ลบไม่สำเร็จ',e.message)}}
$('trashButton')?.addEventListener('click',()=>deleteCatalog('trash'));$('deleteButton')?.addEventListener('click',()=>deleteCatalog('permanent'));
async function loadFromQuery(){const id=new URLSearchParams(location.search).get('id');if(!id)return;try{const d=await api(`/api/admin/catalog/${encodeURIComponent(id)}`);fill(d.item);editingId=id;$('itemId').disabled=true;$('saveState').textContent=`กำลังแก้ไข ${id}`}catch(e){showMessage('เปิดรายการไม่ได้',e.message)}}
function fill(p){$('itemId').value=p.id||'';$('itemSku').value=p.sku||'';$('seriesGroup').value=p.seriesGroup||'Gundam';$('status').value=p.status||'draft';$('name').value=(p.name==='ยังไม่ระบุชื่อ'?'':(p.name||''));$('summary').value=p.summary||'';for(const id of ['rgNumber','modelCode','manufacturer','series','scale','releaseDate','launchPriceJPY','heightCm','recommendedAge','productType','material'])$(id).value=p[id]??'';$('videoEmbedUrl').value=normalizeYouTubeEmbed(p.videoEmbedUrl||'');$('shopee').value=p.affiliateLinks?.shopee||'';$('lazada').value=p.affiliateLinks?.lazada||'';$('tiktok').value=p.affiliateLinks?.tiktok||'';$('pageLink').value=p.affiliateLinks?.page||'';gallery=(p.images||[]).map((src,i)=>({src,thumbSrc:p.imageThumbnails?.[i]||src,width:p.imageDimensions?.[i]?.width||null,height:p.imageDimensions?.[i]?.height||null,name:`รูป ${i+1}`}));manual=(p.manualImages||[]).map((src,i)=>({src,thumbSrc:p.manualThumbnails?.[i]||src,width:p.manualImageDimensions?.[i]?.width||null,height:p.manualImageDimensions?.[i]?.height||null,name:`คู่มือ ${i+1}`}));Object.assign(lists,{highlights:p.highlights||[],differences:p.whatsDifferent||[],box:p.boxContents||[],notIncluded:p.notIncluded||[],pros:p.pros||[],considerations:p.considerations||[],faq:p.faq||[],references:p.references||[]});Object.keys(lists).forEach(renderList);renderImages('gallery');renderImages('manual')}

function fileNameFromUrl(src){try{return decodeURIComponent(String(src).split('/').pop().split('?')[0])}catch{return String(src)}}
function normalizeAssetUrl(src){const v=String(src||'').trim();if(!v)return '';if(v.startsWith('data:')||v.startsWith('http://')||v.startsWith('https://')||v.startsWith('/'))return v;return '/'+v.replace(/^\.\//,'')}
async function openMediaLibrary(target){mediaTarget=target;mediaCandidates=[];mediaSelected.clear();$('mediaGrid').innerHTML='';$('mediaCatalogInfo').textContent='';$('mediaSelectedCount').textContent='เลือกแล้ว 0 รูป';$('mediaCatalogId').value=val('itemId')||'rg-039';$('mediaDialog').showModal();await loadCatalogMedia()}
async function loadCatalogMedia(){const id=$('mediaCatalogId').value.trim().toLowerCase();if(!id){$('mediaCatalogInfo').textContent='กรอกรหัสรายการก่อน';return}try{$('mediaCatalogInfo').textContent='กำลังโหลด…';let item=null;const local=await fetch(`/data/catalog/gundam/gunpla/rg/${encodeURIComponent(id)}.json`,{cache:'no-store'});if(local.ok)item=await local.json();if(!item){const dynamic=await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`,{cache:'no-store'});if(dynamic.ok)item=(await dynamic.json()).item}if(!item)throw Error('ไม่พบข้อมูลแคตตาล็อก '+id);const sources=mediaTarget==='manual'?(item.manualImages||[]):[...(item.images||[]),...(item.catalogImage?[item.catalogImage]:[])];mediaCandidates=[...new Set(sources.filter(Boolean))];$('mediaCatalogInfo').textContent=`${item.name||id} · ${mediaCandidates.length} รูป`;renderMediaGrid()}catch(e){$('mediaCatalogInfo').textContent=e.message;$('mediaGrid').innerHTML='<div class="empty-state">ไม่พบรูปในรายการนี้</div>'}}
function renderMediaGrid(){$('mediaGrid').innerHTML=mediaCandidates.map((src,i)=>`<button class="media-card ${mediaSelected.has(i)?'selected':''}" data-media-index="${i}" type="button"><span class="media-check">✓</span><img src="${esc(normalizeAssetUrl(src))}" alt=""><small>${esc(fileNameFromUrl(src))}</small></button>`).join('');$('mediaSelectedCount').textContent=`เลือกแล้ว ${mediaSelected.size} รูป`}
$('catalogGalleryButton').onclick=()=>openMediaLibrary('gallery');$('catalogManualButton').onclick=()=>openMediaLibrary('manual');$('mediaClose').onclick=()=>$('mediaDialog').close();$('mediaLoad').onclick=loadCatalogMedia;$('mediaGrid').onclick=e=>{const card=e.target.closest('[data-media-index]');if(!card)return;const i=Number(card.dataset.mediaIndex);mediaSelected.has(i)?mediaSelected.delete(i):mediaSelected.add(i);renderMediaGrid()};$('mediaUseSelected').onclick=()=>{const chosen=[...mediaSelected].sort((a,b)=>a-b).map(i=>({src:normalizeAssetUrl(mediaCandidates[i]),name:fileNameFromUrl(mediaCandidates[i])}));if(!chosen.length){showMessage('ยังไม่ได้เลือกรูป','เลือกรูปอย่างน้อย 1 รูป');return}const arr=mediaTarget==='manual'?manual:gallery;const existing=new Set(arr.map(x=>x.src));chosen.forEach(x=>{if(!existing.has(x.src))arr.push(x)});renderImages(mediaTarget);setDirty('เลือกรูปจากแคตตาล็อกแล้ว · ยังไม่บันทึก');$('mediaDialog').close()};


function bindAddButtons(){
 document.querySelectorAll('[data-add]').forEach(btn=>{
  btn.addEventListener('click',e=>{
   e.preventDefault();
   const aliases={highlight:'highlights',difference:'differences',pro:'pros',consideration:'considerations',reference:'references'};
   const type=aliases[btn.dataset.add]||btn.dataset.add;
   if(!lists[type])return;
   add(type);
   const map={highlights:'highlightsList',differences:'differencesList',box:'boxContentsList',notIncluded:'notIncludedList',pros:'prosList',considerations:'considerationsList',faq:'faqList',references:'referencesList'};
   $(map[type])?.querySelector('input:last-of-type,textarea:last-of-type')?.focus();
  });
 });
}
$('videoEmbedUrl').addEventListener('blur',()=>{
 const raw=val('videoEmbedUrl');
 if(!raw)return;
 const fixed=normalizeYouTubeEmbed(raw);
 if(fixed)$('videoEmbedUrl').value=fixed;
 else{ $('videoEmbedUrl').value=''; showMessage('ลิงก์วิดีโอไม่ถูกต้อง','ช่องนี้รับเฉพาะลิงก์ YouTube เท่านั้น เพื่อป้องกันหน้าเว็บซ้อนใน Embed'); }
});


function jarvisSetStatus(message,state=''){
 const el=$('jarvisStatus');
 if(!el)return;
 el.textContent=message;
 el.className=`jarvis-status ${state}`.trim();
}
function jarvisHasMeaningfulList(type){
 const data=lists[type]||[];
 return data.some(item=>typeof item==='string'?item.trim():Object.values(item||{}).some(v=>String(v||'').trim()));
}
function jarvisSetField(id,value,fillOnly){
 const el=$(id);
 if(!el||value===null||value===undefined||String(value).trim()==='')return;
 if(fillOnly&&val(id))return;
 el.value=value;
}
function jarvisReplaceList(type,data,fillOnly){
 if(!Array.isArray(data)||!data.length)return;
 if(fillOnly&&jarvisHasMeaningfulList(type))return;
 lists[type]=data;
 renderList(type);
}
function applyJarvisData(data,fillOnly=true){
 const scalar={
  itemId:data.id,itemSku:data.sku,name:data.name,summary:data.summary,rgNumber:data.rgNumber,
  modelCode:data.modelCode,manufacturer:data.manufacturer,series:data.series,scale:data.scale,
  releaseDate:data.releaseDate,launchPriceJPY:data.launchPriceJPY,heightCm:data.heightCm,
  recommendedAge:data.recommendedAge,productType:data.productType,material:data.material,
  seriesGroup:data.seriesGroup
 };
 Object.entries(scalar).forEach(([id,value])=>jarvisSetField(id,value,fillOnly));
 jarvisReplaceList('highlights',data.highlights,fillOnly);
 jarvisReplaceList('differences',data.whatsDifferent,fillOnly);
 jarvisReplaceList('box',data.boxContents,fillOnly);
 jarvisReplaceList('notIncluded',data.notIncluded,fillOnly);
 jarvisReplaceList('pros',data.pros,fillOnly);
 jarvisReplaceList('considerations',data.considerations,fillOnly);
 jarvisReplaceList('faq',data.faq,fillOnly);
 if(Array.isArray(data.references)&&data.references.length){
  if(fillOnly&&jarvisHasMeaningfulList('references')){
   const known=new Set(lists.references.map(x=>String(x.url||'').trim()).filter(Boolean));
   data.references.forEach(ref=>{if(ref?.url&&!known.has(ref.url)){lists.references.push(ref);known.add(ref.url)}});
   renderList('references');
  }else{
   lists.references=data.references;
   renderList('references');
  }
 }
 setDirty('จาวิสเติมข้อมูลแล้ว · กรุณาตรวจสอบก่อนบันทึก');
}
async function runJarvis(fillOnly){
 const query=val('jarvisQuery')||val('name')||val('itemSku')||val('itemId');
 if(!query){showMessage('ยังไม่มีชื่อรุ่น','กรอกชื่อรุ่นหรือรหัสที่ช่อง JARVIS AI ก่อน');$('jarvisQuery')?.focus();return}
 const buttons=[$('jarvisFillEmpty'),$('jarvisReplaceAll')].filter(Boolean);
 buttons.forEach(b=>b.disabled=true);
 jarvisSetStatus(`กำลังค้นหาข้อมูล “${query}” และตรวจแหล่งอ้างอิง…`,'working');
 try{
  const response=await fetch('/api/admin/ai/catalog-fill',{
   method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
   body:JSON.stringify({
    query,
    includeEditorial:$('jarvisIncludeEditorial')?.checked!==false,
    includeBox:$('jarvisIncludeBox')?.checked!==false
   })
  });
  const result=await response.json().catch(()=>({}));
  if(response.status===401){location.href='/admin/';return}
  if(!response.ok)throw Error(result.error||'จาวิสค้นหาข้อมูลไม่สำเร็จ');
  applyJarvisData(result.item||{},fillOnly);
  const sourceCount=(result.item?.references||[]).length;
  jarvisSetStatus(`เติมข้อมูลแล้ว ${sourceCount?`พร้อมแหล่งอ้างอิง ${sourceCount} รายการ`:'แต่ยังไม่พบแหล่งอ้างอิง'} · กรุณาตรวจสอบก่อน Save`,'success');
 }catch(error){
  jarvisSetStatus(error.message||'เกิดข้อผิดพลาด','error');
  showMessage('JARVIS ทำงานไม่สำเร็จ',error.message||'เกิดข้อผิดพลาด');
 }finally{buttons.forEach(b=>b.disabled=false)}
}
$('jarvisFillEmpty')?.addEventListener('click',()=>runJarvis(true));
$('jarvisReplaceAll')?.addEventListener('click',()=>{
 if(confirm('ให้จาวิสเขียนทับข้อมูลที่กรอกอยู่ในฟอร์มหรือไม่? รูป คู่มือ YouTube และ Affiliate จะไม่ถูกแตะ'))runJarvis(false);
});
$('jarvisQuery')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();runJarvis(true)}});

initializeRows();bindAddButtons();loadFromQuery();
