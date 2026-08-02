const $ = id => document.getElementById(id);
let items = [];
let editing = null;

const fields = [
  'id','sku','name','rgNumber','seriesGroup','seriesGroupOrder','series','line','scale','manufacturer',
  'releaseDate','launchPriceJPY','heightCm','recommendedAge','productType','modelCode','material','catalogImage',
  'images','summary','highlights','whatsDifferent','boxContents','pros','considerations','faq','manualImages',
  'videoEmbedUrl','sourceName','sourceUrl','references','status','sortOrder'
];

function msg(text = '', type = 'success') {
  const el = $('message');
  el.textContent = text;
  el.className = text ? `status ${type}` : 'status hidden';
}

function esc(value) {
  return String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}

function code(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {'content-type':'application/json', ...(options.headers || {})}
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    location.href = '/admin/';
    throw new Error('กรุณาเข้าสู่ระบบใหม่');
  }
  if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

async function load() {
  const data = await api('/api/admin/catalog');
  items = data.items || [];
  render();
}

function render() {
  const query = $('search').value.toLowerCase();
  const list = items.filter(item => `${item.id} ${item.name} ${item.line || item.grade || ''} ${item.series || ''}`.toLowerCase().includes(query));
  $('rows').innerHTML = list.length ? list.map(item => `
    <tr>
      <td>${item.catalogImage ? `<img class="thumb" src="/${esc(item.catalogImage).replace(/^\//,'')}" onerror="this.style.visibility='hidden'">` : '—'}</td>
      <td><b>${esc(item.id)}</b><br>${esc(item.name)}</td>
      <td><b>${esc(item.line || item.grade || '—')}</b>${item.series ? `<br><small>${esc(item.series)}</small>` : ''}</td>
      <td><span class="status-pill ${esc(item.status)}">${item.status === 'published' ? 'เผยแพร่' : item.status === 'hidden' ? 'ซ่อน' : 'ฉบับร่าง'}</span></td>
      <td><div class="row-actions">
        <button data-edit="${esc(item.id)}">แก้ไข</button>
        <button data-preview="${esc(item.id)}">ดูหน้าเว็บ</button>
        <button data-copy="${esc(item.id)}">คัดลอก</button>
        <button class="danger" data-delete="${esc(item.id)}">ลบ</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="5">ยังไม่มีรายการจาก D1 กด “เพิ่มรายการ” เพื่อสร้างรายการแรก</td></tr>';
}

function listToText(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function pairsToText(value, leftKey, rightKey) {
  return Array.isArray(value) ? value.map(item => `${item?.[leftKey] || ''} | ${item?.[rightKey] || ''}`.trim()).filter(line => line !== '|').join('\n') : '';
}

function textToList(value) {
  return String(value || '').split('\n').map(line => line.trim()).filter(Boolean);
}

function textToPairs(value, leftKey, rightKey) {
  return textToList(value).map(line => {
    const pipeIndex = line.indexOf('|');
    if (pipeIndex < 0) return {[leftKey]: line.trim(), [rightKey]: ''};
    return {
      [leftKey]: line.slice(0, pipeIndex).trim(),
      [rightKey]: line.slice(pipeIndex + 1).trim()
    };
  }).filter(item => item[leftKey] || item[rightKey]);
}

function normalizeYouTube(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iframeMatch = raw.match(/src=["']([^"']+)["']/i);
  const candidate = iframeMatch ? iframeMatch[1] : raw;
  try {
    const url = new URL(candidate, location.origin);
    let videoId = '';
    if (url.hostname.includes('youtu.be')) videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) videoId = url.pathname.split('/embed/')[1]?.split('/')[0] || '';
      else if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      else videoId = url.searchParams.get('v') || '';
    }
    if (!videoId) throw new Error('invalid');
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    throw new Error('YouTube Embed URL ต้องเป็นลิงก์ YouTube หรือโค้ด iframe ของ YouTube เท่านั้น');
  }
}

function updateLineCode() {
  const line = $('line').value;
  const map = {RG:'rg',MG:'mg',HG:'hg',PG:'pg',EG:'eg',SD:'sd',FM:'fm',MGEX:'mgex'};
  $('lineCode').value = map[line] || code(line);
  if (!$('seriesGroup').value) $('seriesGroup').value = line === 'RG' ? 'Gundam' : line === 'HG' ? 'HGUC' : '';
}

function openEditor(item = null, copy = false) {
  editing = copy ? null : item?.id || null;
  $('form').reset();
  $('categoryLabel').value = 'Gundam';
  $('categoryCode').value = 'gd';
  $('productType').value = 'Gunpla';
  $('productTypeCode').value = 'gp';
  $('line').value = 'RG';
  $('lineCode').value = 'rg';
  $('scale').value = '1/144';
  $('manufacturer').value = 'Bandai Spirits';
  $('status').value = 'draft';
  $('sortOrder').value = '0';

  if (item) {
    const normalized = {...item, line: item.line || item.grade || 'RG'};
    for (const key of fields) {
      if (!$(key)) continue;
      if (['images','highlights','boxContents','pros','considerations','manualImages'].includes(key)) $(key).value = listToText(normalized[key]);
      else if (key === 'whatsDifferent') $(key).value = pairsToText(normalized.whatsDifferent, 'title', 'detail');
      else if (key === 'faq') $(key).value = pairsToText(normalized.faq, 'q', 'a');
      else if (key === 'references') $(key).value = pairsToText(normalized.references, 'label', 'url');
      else $(key).value = normalized[key] ?? '';
    }
    $('shopee').value = item.affiliateLinks?.shopee || '';
    $('lazada').value = item.affiliateLinks?.lazada || '';
    $('tiktok').value = item.affiliateLinks?.tiktok || '';
    $('page').value = item.affiliateLinks?.page || '';
    if (copy) {
      $('id').value = '';
      $('sku').value = '';
      $('name').value = `${item.name || ''} (คัดลอก)`;
    }
  }

  $('id').disabled = Boolean(editing);
  $('editorTitle').textContent = editing ? 'แก้ไขรายการ' : copy ? 'คัดลอกรายการ' : 'เพิ่มรายการแคตตาล็อก';
  updateLineCode();
  $('editor').classList.remove('hidden');
  $('editor').scrollIntoView({behavior:'smooth'});
}

function payload() {
  const id = $('id').value.trim();
  if (!id) throw new Error('กรุณากรอกรหัสรายการ');

  const data = {
    id,
    sku: $('sku').value,
    name: $('name').value,
    rgNumber: $('rgNumber').value ? Number($('rgNumber').value) : null,
    category: 'model',
    categoryLabel: $('categoryLabel').value,
    categoryCode: code($('categoryCode').value),
    productType: $('productType').value,
    productTypeCode: code($('productTypeCode').value),
    line: $('line').value,
    grade: $('line').value,
    lineCode: code($('lineCode').value),
    seriesGroup: $('seriesGroup').value,
    seriesGroupOrder: Number($('seriesGroupOrder').value) || 0,
    series: $('series').value,
    scale: $('scale').value,
    manufacturer: $('manufacturer').value,
    releaseDate: $('releaseDate').value,
    launchPriceJPY: $('launchPriceJPY').value ? Number($('launchPriceJPY').value) : null,
    heightCm: $('heightCm').value ? Number($('heightCm').value) : null,
    recommendedAge: $('recommendedAge').value,
    modelCode: $('modelCode').value,
    material: $('material').value,
    catalogImage: $('catalogImage').value,
    images: textToList($('images').value),
    videoEmbedUrl: normalizeYouTube($('videoEmbedUrl').value),
    summary: $('summary').value,
    highlights: textToList($('highlights').value),
    whatsDifferent: textToPairs($('whatsDifferent').value, 'title', 'detail'),
    boxContents: textToList($('boxContents').value),
    pros: textToList($('pros').value),
    considerations: textToList($('considerations').value),
    faq: textToPairs($('faq').value, 'q', 'a'),
    manualImages: textToList($('manualImages').value),
    sourceName: $('sourceName').value,
    sourceUrl: $('sourceUrl').value,
    references: textToPairs($('references').value, 'label', 'url'),
    affiliateLinks: {
      shopee: $('shopee').value.trim(),
      lazada: $('lazada').value.trim(),
      tiktok: $('tiktok').value.trim(),
      page: $('page').value.trim()
    },
    status: $('status').value,
    catalogStatus: $('status').value === 'published' ? 'published' : 'draft',
    sortOrder: Number($('sortOrder').value) || 0
  };

  if (!data.catalogImage && data.images.length) data.catalogImage = data.images[0];
  return data;
}

$('line').onchange = updateLineCode;
$('newBtn').onclick = () => openEditor();
$('closeBtn').onclick = () => $('editor').classList.add('hidden');
$('search').oninput = render;

$('rows').onclick = async event => {
  const id = event.target.dataset.edit || event.target.dataset.copy || event.target.dataset.preview || event.target.dataset.delete;
  if (!id) return;
  if (event.target.dataset.preview) {
    window.open(`/#/product/${id}`, '_blank');
    return;
  }
  if (event.target.dataset.delete) {
    if (confirm(`ลบ ${id} หรือไม่?`)) {
      await api(`/api/admin/catalog/${encodeURIComponent(id)}`, {method:'DELETE'});
      await load();
    }
    return;
  }
  const data = await api(`/api/admin/catalog/${encodeURIComponent(id)}`);
  openEditor(data.item, Boolean(event.target.dataset.copy));
};

$('form').onsubmit = async event => {
  event.preventDefault();
  msg('กำลังบันทึก…', 'loading');
  try {
    const data = payload();
    await api(editing ? `/api/admin/catalog/${encodeURIComponent(editing)}` : '/api/admin/catalog', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });
    msg('บันทึกเรียบร้อย');
    $('editor').classList.add('hidden');
    await load();
  } catch (error) {
    msg(error.message, 'error');
  }
};

$('previewBtn').onclick = () => {
  try {
    const data = payload();
    localStorage.setItem('toyskub_catalog_preview', JSON.stringify(data));
    window.open('/#/product-preview', '_blank');
  } catch (error) {
    msg(error.message, 'error');
  }
};

updateLineCode();
load().catch(error => msg(error.message, 'error'));
