// src/dashboard.js
import { getSupa } from './supabase.js';
import { showToast } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://pediway.vercel.app';
const CORES = [
  // Cores sólidas
  '#C0392B','#E74C3C','#E67E22','#F39C12','#F1C40F',
  '#27AE60','#16A085','#1ABC9C','#2980B9','#3498DB',
  '#8E44AD','#9B59B6','#2C3E50','#34495E','#7F8C8D',
  '#D35400','#C0392B','#1A252F','#6C3483','#1B4F72',
  // Gradientes (salvos como string especial)
  'grad:linear-gradient(135deg,#C0392B,#E74C3C)',
  'grad:linear-gradient(135deg,#E67E22,#F39C12)',
  'grad:linear-gradient(135deg,#27AE60,#1ABC9C)',
  'grad:linear-gradient(135deg,#2980B9,#8E44AD)',
  'grad:linear-gradient(135deg,#2C3E50,#4CA1AF)',
  'grad:linear-gradient(135deg,#C0392B,#8E44AD)',
  'grad:linear-gradient(135deg,#F39C12,#27AE60)',
  'grad:linear-gradient(135deg,#2980B9,#16A085)',
  'grad:linear-gradient(135deg,#1A252F,#C0392B)',
  'grad:linear-gradient(135deg,#D35400,#F39C12)',
];
const EMOJIS   = ['🍔','🍕','🌮','🥪','🍜','🥗','🍗','🥩','🫕','🥘','🍱','🧆','🍣','🍦','🧁','🎂','🥤','🧃','☕','🧋'];

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────────────────────────────────────
let emojiSel    = '🍔';
let fotosFiles  = [];
let fotosPosX   = [];
let fotosPosY   = [];
let logoFile    = null;
let corAtiva    = '#C0392B';
let realtimeSub = null;
let pollingId   = null;
let pedidosConhecidos = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const getEstab = () => window._estab || JSON.parse(localStorage.getItem('pw_estab') || 'null');

function normalizeHex(cor) {
  if (!cor) return '#C0392B';
  if (cor.startsWith('grad:')) return cor.replace('grad:', ''); // gradiente
  if (cor.startsWith('#')) return cor;
  if (cor.startsWith('linear-gradient')) return cor;
  const m = cor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) return '#' + [m[1],m[2],m[3]].map(n => (+n).toString(16).padStart(2,'0')).join('');
  return '#C0392B';
}
function isGradient(cor) { return cor && (cor.startsWith('grad:') || cor.startsWith('linear-gradient')); }
function gradToHex(cor) {
  // Extrai a primeira cor do gradiente para uso em contextos que precisam de hex
  const m = (cor || '').match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : '#C0392B';
}

async function uploadFile(bucket, path, file) {
  const { error } = await getSupa().storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw new Error('Upload falhou: ' + error.message);
  return getSupa().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
export async function initDashboard() {
  const estab = getEstab();
  if (!estab) return;

  // Textos do header
  const sn = $('dash-store-name');
  if (sn) sn.textContent = estab.nome;
  const lu = $('link-url');
  if (lu) lu.textContent = `${BASE_URL}/${estab.slug}`;

  // Preenche configurações
  preencherConfig(estab);

  // Logo preview
  if (estab.logo_url) mostrarLogoPreview(estab.logo_url);

  // Capa preview (cor)
  mostrarCapaPreview(corAtiva);

  // Cor
  corAtiva = normalizeHex(estab.cor_primaria || '#C0392B');
  renderCores(corAtiva);
  aplicarCorDash(corAtiva);
  mostrarCapaPreview(corAtiva);

  // Status loja
  atualizarBadgeLoja(estab.aberto !== false);
  const cbAberto = $('cfg-aberto');
  if (cbAberto) cbAberto.checked = estab.aberto !== false;

  // Dados
  if (!window._isDemo) {
    await renderCardapio();
    await renderFresquinho();
    await renderPedidos();
    iniciarRealtime();
    renderEmojiGrid();
  } else {
    renderCardapioDemo();
    renderEmojiGrid();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
function preencherConfig(estab) {
  const set = (id, val) => { const el = $(id); if (el && val != null) el.value = val; };
  set('cfg-nome',     estab.nome);
  set('cfg-slug',     estab.slug);
  set('cfg-whats',    estab.whatsapp || '');
  set('cfg-desc',     estab.descricao || '');
  set('cfg-endereco', estab.endereco || '');
  set('cfg-tempo',    estab.tempo_entrega || '30-45 min');
  const cfgLink = $('cfg-link-preview');
  if (cfgLink) cfgLink.textContent = `${BASE_URL}/${estab.slug}`;
  const ce = $('cfg-entrega');  if (ce) ce.checked = estab.faz_entrega  !== false;
  const cr = $('cfg-retirada'); if (cr) cr.checked = estab.faz_retirada !== false;
}

function aplicarCorDash(cor) {
  const hex = isGradient(cor) ? gradToHex(cor) : cor;
  const dash = document.querySelector('[data-screen="s-dash"]');
  if (dash) dash.style.setProperty('--red', hex);
  document.querySelectorAll('.dash-nav,.tab-content,.config-card').forEach(el => el.style.setProperty('--red', hex));
}

function renderCores(ativa) {
  const grid = $('cores-grid'); if (!grid) return;
  grid.innerHTML = CORES.map(c => `
    <div class="cor-opcao ${c === ativa ? 'ativa' : ''}"
         style="background:${c}"
         data-hex="${c}"
         onclick="selecionarCor('${c}',this)"
         title="${c}"></div>`).join('');
}

window.selecionarCor = function(hex, el) {
  corAtiva = hex;
  document.querySelectorAll('.cor-opcao').forEach(e => e.classList.remove('ativa'));
  if (el) el.classList.add('ativa');
  aplicarCorDash(hex);
  // Atualiza preview da capa se não tiver imagem
  const prev = $('capa-preview');
  if (prev) prev.style.background = isGradient(hex) ? hex : hex;
};

function atualizarBadgeLoja(aberto) {
  const b = $('loja-status-badge'); if (!b) return;
  b.className = 'loja-status-badge ' + (aberto ? 'loja-aberta' : 'loja-fechada');
  b.textContent = aberto ? 'Aberta' : 'Fechada';
}

window.atualizarStatusLoja = function(aberto) { atualizarBadgeLoja(aberto); };

// ─────────────────────────────────────────────────────────────────────────────
// LOGO
// ─────────────────────────────────────────────────────────────────────────────
function mostrarLogoPreview(url) {
  const img = $('logo-preview-img');
  const txt = $('logo-placeholder-text');
  if (img) { img.src = url; img.style.display = 'block'; }
  if (txt) txt.style.display = 'none';
}

export function previewLogo(event) {
  const file = event.target.files[0]; if (!file) return;
  logoFile = file;
  mostrarLogoPreview(URL.createObjectURL(file));
}
window.previewLogo = previewLogo;

// Crop da logo — drag
let _cropDragging = false, _cropDragX = 0, _cropDragY = 0, _cropOfsX = 0, _cropOfsY = 0, _cropZoom = 100;

window.abrirCropLogo = function(event) {
  const file = event.target.files[0]; if (!file) return;
  logoFile = file;
  _cropOfsX = 0; _cropOfsY = 0; _cropZoom = 100;
  const img = $('crop-img');
  if (img) { img.src = URL.createObjectURL(file); img.style.transform = 'scale(1) translate(0,0)'; }
  const zEl = $('crop-zoom'); if (zEl) zEl.value = 100;
  $('crop-overlay')?.classList.add('open');
  event.target.value = '';

  const preview = $('crop-preview');
  if (preview) {
    const drag = e => {
      const t = e.touches ? e.touches[0] : e;
      _cropOfsX += t.clientX - _cropDragX; _cropDragX = t.clientX;
      _cropOfsY += t.clientY - _cropDragY; _cropDragY = t.clientY;
      aplicarCrop();
    };
    preview.onmousedown = preview.ontouchstart = e => {
      _cropDragging = true;
      const t = e.touches ? e.touches[0] : e;
      _cropDragX = t.clientX; _cropDragY = t.clientY;
      e.preventDefault();
    };
    document.onmousemove = document.ontouchmove = e => { if (_cropDragging) drag(e); };
    document.onmouseup = document.ontouchend = () => _cropDragging = false;
  }
};
window.aplicarCrop = function() {
  const z = $('crop-zoom')?.value || 100;
  _cropZoom = +z;
  const img = $('crop-img');
  if (img) img.style.transform = `scale(${_cropZoom/100}) translate(${_cropOfsX}px,${_cropOfsY}px)`;
};
window.fecharCrop = function() { $('crop-overlay')?.classList.remove('open'); logoFile = null; };
window.confirmarCrop = function() {
  const img = $('logo-preview-img');
  if (img && logoFile) { img.src = URL.createObjectURL(logoFile); img.style.display = 'block'; }
  $('logo-placeholder-text').style.display = 'none';
  $('crop-overlay')?.classList.remove('open');
};

// ─────────────────────────────────────────────────────────────────────────────
// CAPA — apenas cor/gradiente (sem upload de imagem)
// ─────────────────────────────────────────────────────────────────────────────
function mostrarCapaPreview(cor) {
  const prev = $('capa-preview');
  if (prev) prev.style.background = isGradient(cor) ? cor : cor;
}

// ─────────────────────────────────────────────────────────────────────────────
// SALVAR CONFIG
// ─────────────────────────────────────────────────────────────────────────────
export async function salvarConfig() {
  if (window._isDemo) return showToast('No demo não é possível salvar.', 'error');
  const estab = getEstab(); if (!estab) return;

  const nome     = $('cfg-nome')?.value.trim();
  const slug     = $('cfg-slug')?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-');
  const whats    = $('cfg-whats')?.value.trim();
  const desc     = $('cfg-desc')?.value.trim();
  const endereco = $('cfg-endereco')?.value.trim();
  const tempo    = $('cfg-tempo')?.value;
  const aberto   = $('cfg-aberto')?.checked;
  const entrega  = $('cfg-entrega')?.checked;
  const retirada = $('cfg-retirada')?.checked;

  if (!nome || !slug) return showToast('Preencha nome e link.', 'error');

  const btn = document.querySelector('[onclick="salvarConfig()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    // Verifica slug único
    if (slug !== estab.slug) {
      const { data: ex } = await getSupa().from('estabelecimentos').select('id').eq('slug', slug).maybeSingle();
      if (ex) throw new Error('Esse link já está em uso.');
    }

    // Upload logo
    let logo_url = estab.logo_url || null;
    if (logoFile) {
      logo_url = await uploadFile('fotos', `${estab.id}/logo_${Date.now()}.${logoFile.name.split('.').pop()}`, logoFile);
      logoFile = null;
    }

    // Cor — suporta gradientes
    const cor_primaria = normalizeHex(corAtiva);

    const updates = {
      nome, slug, whatsapp: whats, descricao: desc, endereco,
      tempo_entrega: tempo, aberto, faz_entrega: entrega, faz_retirada: retirada,
      cor_primaria, logo_url,
      capa_url: null, capa_tipo: 'cor', // capa sempre por cor
    };

    const { error } = await getSupa().from('estabelecimentos').update(updates).eq('id', estab.id);
    if (error) throw new Error(error.message);

    const novoEstab = { ...estab, ...updates };
    window._estab = novoEstab;
    localStorage.setItem('pw_estab', JSON.stringify(novoEstab));

    // Atualiza UI
    const sn = $('dash-store-name'); if (sn) sn.textContent = nome;
    const lu = $('link-url');        if (lu) lu.textContent = `${BASE_URL}/${slug}`;
    const cl = $('cfg-link-preview');if (cl) cl.textContent = `${BASE_URL}/${slug}`;
    atualizarBadgeLoja(aberto);
    aplicarCorDash(cor_primaria);

    showToast('Configurações salvas! ✅');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar configurações'; }
  }
}
window.salvarConfig = salvarConfig;

// ─────────────────────────────────────────────────────────────────────────────
// CARDÁPIO
// ─────────────────────────────────────────────────────────────────────────────
async function renderCardapio() {
  const estab = getEstab();
  const grid  = $('cardapio-grid');
  const stat  = $('stat-itens');
  if (!grid || !estab) return;

  const { data } = await getSupa().from('produtos').select('*')
    .eq('estabelecimento_id', estab.id).order('created_at', { ascending: false });

  if (stat) stat.textContent = data?.length || 0;

  if (!data?.length) {
    grid.innerHTML = `<div class="empty-state-light" style="grid-column:1/-1">
      <span>🍽️</span><p>Nenhum item ainda. Adicione seu primeiro produto!</p></div>`;
    return;
  }

  grid.innerHTML = data.map(p => `
    <div class="item-card">
      <div class="item-card-img">
        ${p.foto_url
          ? `<img class="item-img" src="${p.foto_url}" alt="${p.nome}">`
          : `<div class="item-emoji-bg">${p.emoji || '🍔'}</div>`}
        <span class="item-disponivel">${p.disponivel ? 'Disponível' : 'Indisponível'}</span>

      </div>
      <div class="item-body">
        ${p.promocao ? `<span style="display:inline-block;background:#fff3f0;color:var(--red);font-size:0.6rem;font-weight:800;padding:2px 8px;border-radius:50px;border:1px solid rgba(192,57,43,0.2);margin-bottom:4px">🔥 PROMOÇÃO</span>` : ''}
        <div class="item-categoria">${p.categoria || 'SEM CATEGORIA'}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-desc-text">${p.descricao || ''}</div>
        <div class="item-footer">
          <div>
            ${p.promocao && p.preco_original ? `<div class="item-preco-original">R$ ${Number(p.preco_original).toFixed(2).replace('.',',')}</div>` : ''}
            <div class="item-preco">R$ ${Number(p.preco).toFixed(2).replace('.',',')}</div>
          </div>
          <div class="item-acoes">
            <button class="btn-icon" onclick="editarItem('${p.id}')">✏️</button>
            <button class="btn-icon danger" onclick="deletarItem('${p.id}')">🗑️</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderCardapioDemo() {
  const grid = $('cardapio-grid'); const stat = $('stat-itens');
  if (stat) stat.textContent = '3';
  if (!grid) return;
  const demo = [
    { nome:'X-Burguer Especial', categoria:'LANCHES', preco:28.90, emoji:'🍔', promocao:false },
    { nome:'Batata Frita Grande', categoria:'ACOMPANHAMENTOS', preco:14.90, emoji:'🍟', promocao:false },
    { nome:'Refrigerante 350ml', categoria:'BEBIDAS', preco:7.90, emoji:'🥤', promocao:true, preco_original:9.90 },
  ];
  grid.innerHTML = demo.map(p => `
    <div class="item-card">
      <div class="item-card-img"><div class="item-emoji-bg">${p.emoji}</div></div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-footer">
          <div class="item-preco">R$ ${p.preco.toFixed(2).replace('.',',')}</div>
        </div>
      </div>
    </div>`).join('');
}

function renderEmojiGrid() {
  const grid = $('emoji-grid'); if (!grid) return;
  grid.innerHTML = EMOJIS.map(e =>
    `<button class="emoji-btn ${e === emojiSel ? 'selected' : ''}" onclick="selecionarEmoji('${e}',this)">${e}</button>`
  ).join('');
}

// ─── Modal de item ───────────────────────────────────────────────────────────
export function abrirModalItem() {
  if (window._isDemo) return showToast('No demo não é possível salvar.');
  $('modal-item').classList.add('open');
  ['item-nome','item-desc','item-cat','item-preco','item-preco-orig'].forEach(id => { const el=$(id); if(el) el.value=''; });
  const pr = $('item-promocao'); if (pr) pr.checked = false;
  const pg = $('preco-orig-group'); if (pg) pg.style.display = 'none';
  fotosFiles = []; fotosPosX = []; fotosPosY = [];
  renderFotosGrid();
  emojiSel = '🍔'; renderEmojiGrid();
  // Reset botão salvar
  const btn = document.querySelector('#modal-item .btn-primary');
  if (btn) { btn.textContent = 'Salvar item'; btn.onclick = salvarItem; }
}
export function fecharModal() { $('modal-item').classList.remove('open'); }
export function fecharModalFora(e) { if (e.target.id === 'modal-item') fecharModal(); }
export function selecionarEmoji(emoji, btn) {
  emojiSel = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

// ─── Fotos com drag de posição ───────────────────────────────────────────────
export function previewFotos(event) {
  const files = Array.from(event.target.files).slice(0, 5 - fotosFiles.length);
  files.forEach(f => { if (fotosFiles.length < 5) { fotosFiles.push(f); fotosPosX.push(50); fotosPosY.push(50); } });
  renderFotosGrid();
  event.target.value = '';
}
export function previewFoto(e) { previewFotos(e); }

function renderFotosGrid() {
  const grid = $('fotos-grid'); if (!grid) return;
  let html = fotosFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    const px  = fotosPosX[i], py = fotosPosY[i];
    return `
    <div class="foto-thumb-wrap" id="foto-wrap-${i}">
      <!-- Preview grande com drag -->
      <!-- Preview grande estilo crop da logo -->
      <div style="position:relative;width:100%;aspect-ratio:1/1;max-height:280px;border-radius:14px;overflow:hidden;background:#f0ebe4;border:2px solid var(--border);margin-bottom:8px;touch-action:none"
           id="foto-drag-${i}">
        <!-- Imagem draggável -->
        <img src="${url}" id="foto-img-${i}" draggable="false"
             style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:${px}% ${py}%;pointer-events:none;user-select:none">
        <!-- Badge principal -->
        ${i===0?`<div style="position:absolute;top:10px;left:10px;background:var(--red);color:#fff;font-size:0.65rem;font-weight:800;padding:3px 10px;border-radius:50px;z-index:2">PRINCIPAL</div>`:''}
        <!-- Instrução centralizada -->
        <div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:12px;pointer-events:none">
          <div style="background:rgba(0,0,0,0.5);color:#fff;font-size:0.65rem;font-weight:600;padding:4px 12px;border-radius:50px;backdrop-filter:blur(4px)">✋ Arraste para ajustar</div>
        </div>
        <!-- Minimap canto inferior direito -->
        <div style="position:absolute;bottom:10px;right:10px;width:48px;height:48px;border-radius:8px;background:rgba(0,0,0,0.6);overflow:hidden;border:2px solid rgba(255,255,255,0.4);z-index:2">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover;opacity:0.75">
          <div id="foto-pin-${i}" style="position:absolute;width:9px;height:9px;background:#fff;border-radius:50%;border:2px solid var(--red);transform:translate(-50%,-50%);left:${px}%;top:${py}%;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button onclick="removerFotoItem(${i})" style="background:none;border:1px solid #ddd;color:#aaa;padding:4px 12px;border-radius:8px;font-size:0.72rem;font-weight:600;cursor:pointer">🗑 Remover</button>
      </div>
    </div>`;
  }).join('');
  if (fotosFiles.length < 5) html += `
    <div class="foto-add-btn" onclick="document.getElementById('foto-input').click()">
      <span style="font-size:1.5rem">📷</span>
      <span style="font-size:0.72rem;color:#aaa">Adicionar foto</span>
    </div>`;
  grid.innerHTML = html;
  // Reinicia drag nos novos elementos
  fotosFiles.forEach((_, i) => iniciarDragFoto(null, i, true));
}

let _fotoDrag = { ativo:false, idx:-1, startX:0, startY:0 };

function iniciarDragFoto(event, i, apenasSetup) {
  const area = $(`foto-drag-${i}`); if (!area) return;
  // Sempre configura via addEventListener (funciona melhor no mobile)
  area.removeEventListener('mousedown',  area._onMD);
  area.removeEventListener('touchstart', area._onTS);
  area._onMD = e => _startDragFoto(e, i);
  area._onTS = e => { e.preventDefault(); _startDragFoto(e, i); };
  area.addEventListener('mousedown',  area._onMD);
  area.addEventListener('touchstart', area._onTS, { passive:false });
  if (!apenasSetup && event) _startDragFoto(event, i);
}

function _startDragFoto(e, i) {
  _fotoDrag.ativo = true; _fotoDrag.idx = i;
  const t = e.touches ? e.touches[0] : e;
  _fotoDrag.startX = t.clientX; _fotoDrag.startY = t.clientY;
  e.preventDefault();
}

document.addEventListener('mousemove', _moveDragFoto);
document.addEventListener('touchmove', _moveDragFoto, { passive:false });
document.addEventListener('mouseup',   () => _fotoDrag.ativo = false);
document.addEventListener('touchend',  () => _fotoDrag.ativo = false);

function _moveDragFoto(e) {
  if (!_fotoDrag.ativo) return;
  const i = _fotoDrag.idx;
  const t = e.touches ? e.touches[0] : e;
  const area = $(`foto-drag-${i}`); if (!area) return;
  const dx = (t.clientX - _fotoDrag.startX) / area.offsetWidth  * 100;
  const dy = (t.clientY - _fotoDrag.startY) / area.offsetHeight * 100;
  _fotoDrag.startX = t.clientX; _fotoDrag.startY = t.clientY;
  fotosPosX[i] = Math.max(0, Math.min(100, fotosPosX[i] - dx * 0.5));
  fotosPosY[i] = Math.max(0, Math.min(100, fotosPosY[i] - dy * 0.5));
  const img = $(`foto-img-${i}`);
  if (img) img.style.objectPosition = `${fotosPosX[i]}% ${fotosPosY[i]}%`;
  const pin = $(`foto-pin-${i}`);
  if (pin) { pin.style.left = fotosPosX[i] + '%'; pin.style.top = fotosPosY[i] + '%'; }
  e.preventDefault();
}
window.removerFotoExistente = function(btn) {
  btn.closest('.foto-thumb-item').remove();
};

window.removerFotoItem = function(i) { fotosFiles.splice(i,1); fotosPosX.splice(i,1); fotosPosY.splice(i,1); renderFotosGrid(); };

export async function salvarItem() {
  const estab = getEstab(); if (!estab) return showToast('Faça login novamente.','error');
  const nome  = $('item-nome')?.value.trim();
  const preco = parseFloat($('item-preco')?.value);
  if (!nome)        return showToast('Digite o nome do item.','error');
  if (isNaN(preco)) return showToast('Digite o preço.','error');

  const btn = document.querySelector('#modal-item .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    // Upload de todas as fotos
    const fotos_urls = [];
    for (let fi = 0; fi < fotosFiles.length; fi++) {
      const file = fotosFiles[fi];
      const url  = await uploadFile('fotos', `${estab.id}/${Date.now()}_${fi}.${file.name.split('.').pop()}`, file);
      fotos_urls.push(url);
    }
    const foto_url = fotos_urls[0] || null;
    const promocao   = $('item-promocao')?.checked || false;
    const preco_orig = parseFloat($('item-preco-orig')?.value) || null;
    const { error } = await getSupa().from('produtos').insert({
      estabelecimento_id: estab.id, nome,
      descricao:    $('item-desc')?.value.trim(),
      categoria:    $('item-cat')?.value.trim().toUpperCase(),
      preco, preco_original: promocao ? preco_orig : null,
      foto_url, fotos_urls, emoji: emojiSel, disponivel: true, promocao,
    });
    if (error) throw new Error(error.message);
    await renderCardapio(); fecharModal(); showToast('Item adicionado! ✅');
  } catch (e) { showToast(e.message,'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Salvar item'; } }
}

export async function editarItem(id) {
  const estab = getEstab(); if (!estab) return;
  const { data: p } = await getSupa().from('produtos').select('*').eq('id', id).maybeSingle();
  if (!p) return;

  abrirModalItem();
  setTimeout(() => {
    const set = (sel, val) => { const el=$(sel); if(el && val!=null) el.value=val; };
    set('item-nome', p.nome); set('item-desc', p.descricao||'');
    set('item-cat',  p.categoria||''); set('item-preco', p.preco);
    set('item-preco-orig', p.preco_original||'');
    const pr = $('item-promocao'); if (pr) { pr.checked = !!p.promocao; const g=$('preco-orig-group'); if(g) g.style.display=p.promocao?'flex':'none'; }
    emojiSel = p.emoji || '🍔'; renderEmojiGrid();
    // Fotos existentes no modal
    const fotosExist = (p.fotos_urls && p.fotos_urls.length) ? p.fotos_urls : (p.foto_url ? [p.foto_url] : []);
    if (fotosExist.length) {
      const grid = $('fotos-grid');
      if (grid) {
        const html = fotosExist.map((url, idx) => `
          <div class="foto-thumb-item" style="position:relative" data-exist-url="${url}">
            <div style="width:80px;height:80px;border-radius:10px;overflow:hidden;border:2px solid var(--red)">
              <img src="${url}" style="width:100%;height:100%;object-fit:cover">
            </div>
            ${idx===0?`<div style="position:absolute;top:2px;left:2px;background:var(--red);color:#fff;font-size:0.5rem;font-weight:700;padding:2px 5px;border-radius:4px">PRINCIPAL</div>`:''}
            <button onclick="removerFotoExistente(this)" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.65);border:none;color:#fff;width:18px;height:18px;border-radius:50%;font-size:0.6rem;cursor:pointer">✕</button>
          </div>`).join('');
        grid.insertAdjacentHTML('afterbegin', html);
      }
    }
    // Botão salvar
    const btn = document.querySelector('#modal-item .btn-primary');
    if (btn) {
      btn.textContent = 'Salvar alterações';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Salvando...';
        try {
          // Upload novas fotos
          const novas_urls = [];
          for (let fi = 0; fi < fotosFiles.length; fi++) {
            const file = fotosFiles[fi];
            const url  = await uploadFile('fotos', `${estab.id}/${Date.now()}_${fi}.${file.name.split('.').pop()}`, file);
            novas_urls.push(url);
          }
          // Mantém fotos existentes + adiciona novas
          const fotos_existentes = (p.fotos_urls && p.fotos_urls.length) ? p.fotos_urls : (p.foto_url ? [p.foto_url] : []);
          const fotos_urls = [...fotos_existentes, ...novas_urls].slice(0, 5);
          const foto_url   = fotos_urls[0] || null;
          const promocao   = $('item-promocao')?.checked || false;
          const preco_orig = parseFloat($('item-preco-orig')?.value) || null;
          const { error } = await getSupa().from('produtos').update({
            nome:         $('item-nome')?.value.trim(),
            descricao:    $('item-desc')?.value.trim(),
            categoria:    $('item-cat')?.value.trim().toUpperCase(),
            preco:        parseFloat($('item-preco')?.value),
            preco_original: promocao ? preco_orig : null,
            foto_url, fotos_urls, emoji: emojiSel, promocao,
          }).eq('id', id);
          if (error) throw new Error(error.message);
          await renderCardapio(); fecharModal(); showToast('Item atualizado!');
        } catch (e) { showToast(e.message,'error'); }
        finally { btn.disabled = false; btn.textContent = 'Salvar alterações'; }
      };
    }
  }, 100);
}

export async function deletarItem(id) {
  if (!confirm('Remover este item?')) return;
  await getSupa().from('produtos').delete().eq('id', id);
  await renderCardapio(); showToast('Item removido.');
}

// ─────────────────────────────────────────────────────────────────────────────
// FRESQUINHO
// ─────────────────────────────────────────────────────────────────────────────
async function renderFresquinho() {
  const estab = getEstab(); const grid = $('fresquinho-grid');
  if (!grid || !estab) return;
  const { data } = await getSupa().from('fresquinhos').select('*')
    .eq('estabelecimento_id', estab.id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
  if (!data?.length) { grid.innerHTML = `<div class="empty-state-light"><span>✨</span><p>Nenhum conteúdo ainda.</p></div>`; return; }
  grid.innerHTML = '<div class="fresh-stories-row">' + data.map(f => {
    const rest = new Date(f.expires_at) - new Date();
    const h = Math.floor(rest/3600000), m = Math.floor((rest%3600000)/60000);
    return `<div class="fresh-story-item">
      <div class="fresh-story-thumb" onclick="abrirStoryDash('${f.url}','${f.tipo||'foto'}')">
        ${f.tipo === 'video'
          ? `<video src="${f.url}" muted playsinline loop style="width:100%;height:100%;object-fit:cover"></video>`
          : `<img src="${f.url}" style="width:100%;height:100%;object-fit:cover">`}
        <div class="fresh-overlay"></div>
        <div class="fresh-timer-badge">⏱ ${h > 0 ? h+'h '+m+'min' : m+'min'}</div>
      </div>
      <button class="fresh-remove-btn" onclick="removerFresquinho('${f.id}')">🗑️</button>
    </div>`;
  }).join('') + '</div>';
}

export async function postarFresquinho(event) {
  const estab = getEstab(); const file = event.target.files[0];
  if (!file || !estab) return;
  if (file.size > 50 * 1024 * 1024) return showToast('Máx. 50MB','error');

  const tipo = file.type.startsWith('video') ? 'video' : 'foto';

  // Valida duração do vídeo (máx 30s)
  if (tipo === 'video') {
    const durOk = await new Promise(resolve => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => resolve(v.duration <= 30);
      v.onerror = () => resolve(true); // se não conseguir checar, deixa passar
      v.src = URL.createObjectURL(file);
    });
    if (!durOk) return showToast('Vídeo deve ter no máximo 30 segundos.', 'error');
  }

  showToast('Enviando...');
  const url = await uploadFile('fotos', `${estab.id}/fresh_${Date.now()}.${file.name.split('.').pop()}`, file);
  await getSupa().from('fresquinhos').insert({
    estabelecimento_id: estab.id, url, tipo,
    expires_at: new Date(Date.now() + 4*60*60*1000).toISOString(),
  });
  await renderFresquinho(); showToast('Postado! Disponível por 4h ✨');
  event.target.value = '';
}

export async function removerFresquinho(id) {
  await getSupa().from('fresquinhos').delete().eq('id', id);
  await renderFresquinho(); showToast('Removido.');
}

window.abrirStoryDash = function(url, tipo) {
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  o.onclick = () => o.remove();
  o.innerHTML = tipo === 'video'
    ? `<video src="${url}" controls autoplay style="max-width:90vw;max-height:90vh;border-radius:12px"></video>`
    : `<img src="${url}" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain">`;
  const btn = document.createElement('button');
  btn.style.cssText = 'position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.15);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:1rem;cursor:pointer';
  btn.textContent = '✕'; btn.onclick = e => { e.stopPropagation(); o.remove(); };
  o.appendChild(btn); document.body.appendChild(o);
};

// ─────────────────────────────────────────────────────────────────────────────
// PEDIDOS
// ─────────────────────────────────────────────────────────────────────────────
async function renderPedidos() {
  const estab = getEstab(); if (!estab) return;
  const { data } = await getSupa().from('pedidos').select('*')
    .eq('estabelecimento_id', estab.id).order('created_at', { ascending: false }).limit(50);

  const hoje    = new Date().toDateString();
  const pedHoje = (data || []).filter(p => new Date(p.created_at).toDateString() === hoje);
  const fatHoje = pedHoje.reduce((s, p) => s + Number(p.total || 0), 0);

  const sp = $('stat-pedidos'); if (sp) sp.textContent = pedHoje.length;
  const sf = $('stat-faturamento'); if (sf) sf.textContent = `R$ ${fatHoje.toFixed(2).replace('.',',')}`;

  // Área de novos pedidos
  const novos = (data||[]).filter(p => p.status === 'novo');
  novos.forEach(p => pedidosConhecidos.add(p.id));
  const lista = $('pedidos-novos-lista');
  if (lista) {
    lista.innerHTML = novos.length
      ? novos.map(p => cardNovoHTML(p)).join('')
      : '<div style="color:#bbb;font-size:0.82rem;margin:auto">Nenhum pedido novo no momento</div>';
    atualizarBadgePedidos();
  }

  // Histórico
  const lu = $('ultimos-pedidos'); const td = $('todos-pedidos');
  const cardHtml = p => {
    const cls = { novo:'status-novo', preparo:'status-preparo', pronto:'status-pronto', recusado:'status-recusado' }[p.status] || 'status-novo';
    const lbl = { novo:'NOVO', preparo:'PREPARO', pronto:'PRONTO', recusado:'RECUSADO' }[p.status] || 'NOVO';
    const min = Math.floor((Date.now() - new Date(p.created_at)) / 60000);
    return `<div class="pedido-card">
      <div class="pedido-top">
        <div><div class="pedido-id">#${p.id.slice(-4).toUpperCase()} — ${p.cliente_nome||'Cliente'}</div>
        <div class="pedido-tempo">há ${min < 1 ? 'menos de 1' : min} min</div></div>
        <span class="pedido-status ${cls}">${lbl}</span>
      </div>
      <div class="pedido-itens">${Array.isArray(p.itens) ? p.itens.map(i=>`${i.qtd}x ${i.nome}`).join(' · ') : ''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
        <div class="pedido-total">R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</div>
        <div class="pedido-actions">
          ${p.status==='novo'?`<button class="btn-ped-aceitar" onclick="aceitarPedido('${p.id}')">Aceitar</button><button class="btn-ped-recusar" onclick="recusarPedido('${p.id}')">Recusar</button>`:''}
          ${p.status==='preparo'?`<button class="btn-ped-aceitar" onclick="marcarPronto('${p.id}')">Marcar pronto</button>`:''}
          <button class="btn-ped-imprimir" onclick="verPedido('${p.id}')">Ver mais</button>
        </div>
      </div>
    </div>`;
  };
  if (lu) lu.innerHTML = pedHoje.length ? pedHoje.slice(0,3).map(cardHtml).join('') : '<div class="empty-state-light"><span>🛵</span><p>Nenhum pedido ainda.</p></div>';
  if (td) td.innerHTML = data?.length ? data.map(cardHtml).join('') : '<div class="empty-state-light"><span>📋</span><p>Nenhum pedido ainda.</p></div>';
}

function cardNovoHTML(p) {
  const itens = Array.isArray(p.itens) ? p.itens.map(i=>`${i.qtd}x ${i.nome}`).join(', ') : '';
  return `<div class="pedido-novo-card" id="pnc-${p.id}">
    <div class="pnc-id">#${p.id.slice(-4).toUpperCase()}</div>
    <div class="pnc-cliente">${p.cliente_nome||'Cliente'}</div>
    <div class="pnc-total">R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</div>
    <div style="font-size:0.72rem;color:#888;margin-bottom:8px">${itens}</div>
    <div class="pnc-actions">
      <button class="btn-aceitar" onclick="aceitarPedido('${p.id}')">Aceitar</button>
      <button class="btn-recusar" onclick="recusarPedido('${p.id}')">Recusar</button>
    </div>
    <button class="btn-ver-ped" onclick="verPedido('${p.id}')">Ver detalhes</button>
  </div>`;
}

function atualizarBadgePedidos() {
  const lista = $('pedidos-novos-lista');
  const qtd   = lista ? lista.querySelectorAll('.pedido-novo-card').length : 0;
  const badge = $('badge-pedidos');
  const count = $('novos-count');
  if (badge)  { badge.textContent = qtd; badge.classList.toggle('show', qtd > 0); }
  if (count) count.textContent = qtd;
}

function removerCardNovo(id) {
  const card = $(`pnc-${id}`); if (!card) return;
  card.style.transition = 'opacity 0.3s,transform 0.3s';
  card.style.opacity = '0'; card.style.transform = 'scale(0.8)';
  setTimeout(() => {
    card.remove(); atualizarBadgePedidos();
    const lista = $('pedidos-novos-lista');
    if (lista && !lista.querySelector('.pedido-novo-card'))
      lista.innerHTML = '<div style="color:#bbb;font-size:0.82rem;margin:auto">Nenhum pedido novo no momento</div>';
  }, 300);
}

window.aceitarPedido = async function(id) {
  pararNotif();
  const { error } = await getSupa().from('pedidos').update({ status:'preparo' }).eq('id', id);
  if (error) return showToast('Erro ao aceitar.','error');
  removerCardNovo(id); showToast('Pedido aceito! Cliente notificado.');
  await renderPedidos();
};

window.recusarPedido = async function(id) {
  if (!confirm('Recusar este pedido?')) return;
  pararNotif();
  await getSupa().from('pedidos').update({ status:'recusado' }).eq('id', id);
  removerCardNovo(id); showToast('Pedido recusado.');
  await renderPedidos();
};

window.marcarPronto = async function(id) {
  await getSupa().from('pedidos').update({ status:'pronto' }).eq('id', id);
  fecharModalPedido(); showToast('Pedido pronto!');
  await renderPedidos();
};

window.verPedido = async function(id) {
  const { data: p } = await getSupa().from('pedidos').select('*').eq('id', id).maybeSingle();
  if (!p) return;
  const itens = Array.isArray(p.itens) ? p.itens : [];
  const body  = $('modal-pedido-body');
  if (!body) return;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between">
        <strong>#${p.id.slice(-4).toUpperCase()}</strong>
        <span class="pedido-status status-${p.status||'novo'}">${{novo:'NOVO',preparo:'PREPARO',pronto:'PRONTO',recusado:'RECUSADO'}[p.status]||'NOVO'}</span>
      </div>
      <div><b>Cliente:</b> ${p.cliente_nome||'-'}</div>
      <div><b>WhatsApp:</b> ${p.cliente_whats||'-'}</div>
      <div><b>Entrega:</b> ${p.endereco||'Retirada no local'}</div>
      ${p.observacao?`<div><b>Obs:</b> ${p.observacao}</div>`:''}
      <hr style="border:none;border-top:1px solid var(--border)">
      ${itens.map(i=>`<div style="display:flex;justify-content:space-between"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(i.preco*i.qtd).toFixed(2).replace('.',',')}</span></div>`).join('')}
      <hr style="border:none;border-top:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;font-weight:800"><span>Total</span><span>R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</span></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        ${p.status==='novo'?`<button class="btn-ped-aceitar" onclick="aceitarPedido('${p.id}');fecharModalPedido()">Aceitar</button><button class="btn-ped-recusar" onclick="recusarPedido('${p.id}');fecharModalPedido()">Recusar</button>`:''}
        ${p.status==='preparo'?`<button class="btn-ped-aceitar" onclick="marcarPronto('${p.id}')">Marcar pronto</button>`:''}
        <button class="btn-ped-imprimir" onclick="imprimirPedido('${p.id}')">🖨️ Imprimir</button>
      </div>
    </div>`;
  $('modal-pedido').classList.add('open');
};
window.fecharModalPedido = () => $('modal-pedido')?.classList.remove('open');

window.imprimirPedido = async function(id) {
  const { data: p } = await getSupa().from('pedidos').select('*').eq('id', id).maybeSingle();
  if (!p) return;
  const estab = getEstab();
  const itens = Array.isArray(p.itens) ? p.itens : [];
  const area  = $('print-area'); if (!area) return;
  area.innerHTML = `<div class="notinha">
    <div class="notinha-header"><div class="notinha-logo">PEDIWAY</div><div class="notinha-sub">${estab?.nome||''}</div></div>
    <div class="notinha-linha"><span>Pedido</span><strong>#${p.id.slice(-4).toUpperCase()}</strong></div>
    <div class="notinha-linha"><span>Cliente</span><span>${p.cliente_nome||'-'}</span></div>
    <div class="notinha-linha"><span>WhatsApp</span><span>${p.cliente_whats||'-'}</span></div>
    <div class="notinha-linha"><span>Entrega</span><span>${p.endereco||'Retirada'}</span></div>
    ${p.observacao?`<div class="notinha-linha"><span>Obs</span><span>${p.observacao}</span></div>`:''}
    <hr class="notinha-divider">
    ${itens.map(i=>`<div class="notinha-linha"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(i.preco*i.qtd).toFixed(2).replace('.',',')}</span></div>`).join('')}
    <hr class="notinha-divider">
    <div class="notinha-total"><span>TOTAL</span><span>R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</span></div>
    <div style="text-align:center;margin-top:12px;font-size:0.65rem;color:#aaa">Feito com PEDIWAY</div>
  </div>`;
  area.style.display = 'block'; window.print();
  setTimeout(() => { area.style.display = 'none'; area.innerHTML = ''; }, 1000);
};

window.buscarPedidos = function(termo) {
  const t = (termo||'').toLowerCase();
  document.querySelectorAll('#todos-pedidos .pedido-card').forEach(c => {
    c.style.display = (!t || c.textContent.toLowerCase().includes(t)) ? '' : 'none';
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME + POLLING (pedidos)
// ─────────────────────────────────────────────────────────────────────────────
let _notifLoop = null;

function tocarNotif() {
  try { const a = new Audio('/notificacao.mp3'); a.volume = 0.8; a.play().catch(()=>{}); } catch(e){}
}
function pararNotif() { clearTimeout(_notifLoop); _notifLoop = null; }
function notifLoop(id) {
  tocarNotif();
  _notifLoop = setTimeout(() => {
    if ($(`pnc-${id}`)) notifLoop(id);
  }, 5000);
}

function iniciarRealtime() {
  const estab = getEstab(); if (!estab || estab.id === 'demo') return;
  if (realtimeSub) { try { getSupa().removeChannel(realtimeSub); } catch(e){} }

  realtimeSub = getSupa()
    .channel('dash-' + estab.id + '-' + Date.now())
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'pedidos', filter:`estabelecimento_id=eq.${estab.id}` }, payload => {
      const p = payload.new;
      if (!pedidosConhecidos.has(p.id)) {
        pedidosConhecidos.add(p.id);
        const lista = $('pedidos-novos-lista');
        if (lista) {
          const ph = lista.querySelector('div[style]');
          if (ph && ph.textContent.includes('Nenhum')) ph.remove();
          lista.insertAdjacentHTML('afterbegin', cardNovoHTML(p));
          atualizarBadgePedidos();
          notifLoop(p.id);
        }
      }
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'pedidos', filter:`estabelecimento_id=eq.${estab.id}` }, () => { renderPedidos(); })
    .subscribe();

  // Polling de segurança a cada 5s
  clearInterval(pollingId);
  pollingId = setInterval(async () => {
    const est = getEstab(); if (!est || est.id === 'demo') return;
    const { data } = await getSupa().from('pedidos').select('id,cliente_nome,itens,total,status,created_at,endereco')
      .eq('estabelecimento_id', est.id).eq('status','novo').order('created_at',{ascending:false}).limit(20);
    if (!data) return;
    data.forEach(p => {
      if (!pedidosConhecidos.has(p.id)) {
        pedidosConhecidos.add(p.id);
        const lista = $('pedidos-novos-lista');
        if (lista) {
          const ph = lista.querySelector('div[style]');
          if (ph && ph.textContent.includes('Nenhum')) ph.remove();
          lista.insertAdjacentHTML('afterbegin', cardNovoHTML(p));
          atualizarBadgePedidos();
          notifLoop(p.id);
        }
      }
    });
  }, 5000);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS GLOBAIS
// ─────────────────────────────────────────────────────────────────────────────
window.initDashboard     = initDashboard;
window.abrirModalItem    = abrirModalItem;
window.fecharModal       = fecharModal;
window.fecharModalFora   = fecharModalFora;
window.selecionarEmoji   = selecionarEmoji;
window.previewFotos      = previewFotos;
window.previewFoto       = previewFoto;
window.salvarItem        = salvarItem;
window.editarItem        = editarItem;
window.deletarItem       = deletarItem;
window.postarFresquinho  = postarFresquinho;
window.removerFresquinho = removerFresquinho;
window.renderPedidos     = renderPedidos;
