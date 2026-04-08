// src/dashboard.js
import { showToast } from './utils.js';
import { getSupa } from './supabase.js';

const BASE = 'https://pediway.vercel.app';
const EMOJIS = ['🍔','🍕','🌮','🥪','🍜','🥗','🍗','🥩','🫕','🥘',
                 '🍱','🧆','🍣','🍦','🧁','🎂','🥤','🧃','☕','🧋',
                 '🍺','🍷','🥂','🫖','🍹','🔥','⭐','💎','🎯','🏆'];

let emojiSel = '🍔';
let fotoFile = null;
let logoFile = null;

function getEstab() {
  return window._estab || JSON.parse(localStorage.getItem('pw_estab') || 'null');
}

// ============================================================
// INIT
// ============================================================
export async function initDashboard() {
  const estab = getEstab();
  if (!estab) return;

  document.getElementById('dash-store-name').textContent = estab.nome;
  const linkEl = document.getElementById('link-url');
  if (linkEl) linkEl.textContent = `${BASE}/${estab.slug}`;

  const cfgNome  = document.getElementById('cfg-nome');
  const cfgSlug  = document.getElementById('cfg-slug');
  const cfgWhats = document.getElementById('cfg-whats');
  const cfgDesc  = document.getElementById('cfg-desc');
  const cfgLink  = document.getElementById('cfg-link-preview');
  if (cfgNome)  cfgNome.value  = estab.nome;
  if (cfgSlug)  cfgSlug.value  = estab.slug;
  if (cfgWhats) cfgWhats.value = estab.whatsapp || '';
  if (cfgDesc)  cfgDesc.value  = estab.descricao || '';
  if (cfgLink)  cfgLink.textContent = `${BASE}/${estab.slug}`;

  if (estab.logo_url) {
    const img = document.getElementById('logo-preview-img');
    const txt = document.getElementById('logo-placeholder-text');
    if (img) { img.src = estab.logo_url; img.style.display = 'block'; }
    if (txt) txt.style.display = 'none';
  }

  // Demo mode — não busca dados do banco
  if (window._isDemo) {
    renderCardapioDemo();
    renderFresquinhoVazio();
    renderEmojiGrid();
    return;
  }

  await renderCardapio();
  await renderFresquinho();
  await renderPedidos();
  renderEmojiGrid();
}

// ============================================================
// CARDÁPIO DEMO
// ============================================================
function renderCardapioDemo() {
  const grid = document.getElementById('cardapio-grid');
  const stat = document.getElementById('stat-itens');
  if (stat) stat.textContent = '3';
  if (!grid) return;
  const demo = [
    { nome:'X-Burguer Especial', categoria:'LANCHES', preco:28.90, emoji:'🍔', promocao:false },
    { nome:'Batata Frita Grande', categoria:'ACOMPANHAMENTOS', preco:14.90, emoji:'🍟', promocao:false },
    { nome:'Refrigerante 350ml', categoria:'BEBIDAS', preco:7.90, emoji:'🥤', promocao:true, preco_original:9.90 },
  ];
  grid.innerHTML = demo.map(p => `
    <div class="item-card">
      <div class="item-card-img">
        <div class="item-emoji-bg">${p.emoji}</div>
        <span class="item-disponivel">Disponível</span>
        ${p.promocao ? `<span class="item-promo-badge">🔥 Promoção</span>` : ''}
      </div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-footer">
          <div>
            ${p.promocao ? `<div class="item-preco-original">R$ ${p.preco_original.toFixed(2).replace('.',',')}</div>` : ''}
            <div class="item-preco">R$ ${p.preco.toFixed(2).replace('.',',')}</div>
          </div>
          <div class="item-acoes">
            <button class="btn-icon danger" onclick="showToast('No demo, remover não salva 😊')">🗑️</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

// ============================================================
// CARDÁPIO REAL
// ============================================================
async function renderCardapio() {
  const estab = getEstab();
  const grid  = document.getElementById('cardapio-grid');
  const stat  = document.getElementById('stat-itens');
  if (!grid || !estab) return;

  const { data } = await getSupa().from('produtos').select('*')
    .eq('estabelecimento_id', estab.id).order('created_at', { ascending: false });

  if (stat) stat.textContent = data?.length || 0;

  if (!data?.length) {
    grid.innerHTML = `<div class="empty-state-light" style="grid-column:1/-1">
      <span>🍽️</span><p>Nenhum item ainda.<br>Adicione seu primeiro produto!</p></div>`;
    return;
  }

  grid.innerHTML = data.map(p => `
    <div class="item-card">
      <div class="item-card-img">
        ${p.foto_url ? `<img class="item-img" src="${p.foto_url}" alt="${p.nome}">` : `<div class="item-emoji-bg">${p.emoji || '🍔'}</div>`}
        <span class="item-disponivel">${p.disponivel ? 'Disponível' : 'Indisponível'}</span>
        ${p.promocao ? `<span class="item-promo-badge">🔥 Promoção</span>` : ''}
      </div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria || 'SEM CATEGORIA'}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-desc-text">${p.descricao || ''}</div>
        <div class="item-footer">
          <div>
            ${p.promocao && p.preco_original ? `<div class="item-preco-original">R$ ${Number(p.preco_original).toFixed(2).replace('.',',')}</div>` : ''}
            <div class="item-preco">R$ ${Number(p.preco).toFixed(2).replace('.',',')}</div>
          </div>
          <div class="item-acoes">
            <button class="btn-icon danger" onclick="deletarItem('${p.id}')">🗑️</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderEmojiGrid() {
  const grid = document.getElementById('emoji-grid'); if (!grid) return;
  grid.innerHTML = EMOJIS.map(e =>
    `<button class="emoji-btn ${e === emojiSel ? 'selected' : ''}" onclick="selecionarEmoji('${e}',this)">${e}</button>`
  ).join('');
}

export function abrirModalItem() {
  if (window._isDemo) return showToast('No demo não é possível salvar. Crie sua conta! 😊');
  document.getElementById('modal-item').classList.add('open');
  ['item-nome','item-desc','item-cat','item-preco','item-preco-orig'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const promo = document.getElementById('item-promocao');
  if (promo) promo.checked = false;
  const grp = document.getElementById('preco-orig-group');
  if (grp) grp.style.display = 'none';
  fotosFiles = []; const fg = document.getElementById('fotos-grid'); if (fg) fg.innerHTML = '<div class="foto-add-btn" onclick="document.getElementById(\"foto-input\").click()"><span style="font-size:1.5rem">📷</span><span style="font-size:0.75rem;color:#aaa">Adicionar</span></div>'; emojiSel = '🍔';
  renderEmojiGrid();
}

export function fecharModal()        { document.getElementById('modal-item').classList.remove('open'); }
export function fecharModalFora(e)   { if (e.target.id === 'modal-item') fecharModal(); }

let fotosFiles = []; // até 5 fotos

export function previewFotos(event) {
  const files = Array.from(event.target.files).slice(0, 5 - fotosFiles.length);
  files.forEach(file => {
    if (fotosFiles.length >= 5) return;
    fotosFiles.push(file);
  });
  renderFotosGrid();
  event.target.value = '';
}

function renderFotosGrid() {
  const grid = document.getElementById('fotos-grid');
  if (!grid) return;
  let html = fotosFiles.map((f, i) => `
    <div class="foto-thumb-item" style="position:relative">
      <img src="${URL.createObjectURL(f)}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;display:block">
      ${i === 0 ? `<div style="position:absolute;top:3px;left:3px;background:var(--red);color:#fff;font-size:0.55rem;font-weight:700;padding:2px 5px;border-radius:4px">PRINCIPAL</div>` : ''}
      <button onclick="removerFotoItem(${i})" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,0.6);border:none;color:#fff;width:20px;height:20px;border-radius:50%;font-size:0.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    </div>`).join('');
  if (fotosFiles.length < 5) {
    html += `<div class="foto-add-btn" onclick="document.getElementById('foto-input').click()">
      <span style="font-size:1.5rem">📷</span>
      <span style="font-size:0.75rem;color:#aaa">Adicionar</span>
    </div>`;
  }
  grid.innerHTML = html;
}

window.removerFotoItem = function(i) {
  fotosFiles.splice(i, 1);
  renderFotosGrid();
};

// Mantém compatibilidade com previewFoto legacy
export function previewFoto(event) { previewFotos(event); }

export function selecionarEmoji(emoji, btn) {
  emojiSel = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

export async function salvarItem() {
  const estab = getEstab(); if (!estab) return showToast('Faça login novamente.', 'error');
  const nome  = document.getElementById('item-nome')?.value.trim();
  const preco = parseFloat(document.getElementById('item-preco')?.value);
  if (!nome)        return showToast('Digite o nome do item.', 'error');
  if (isNaN(preco)) return showToast('Digite o preço.', 'error');

  const btn = document.querySelector('#modal-item .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    let foto_url = null;
    if (fotosFiles.length > 0) {
      // Upload da foto principal
      const file = fotosFiles[0];
      const ext  = file.name.split('.').pop();
      const path = `${estab.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await getSupa().storage.from('fotos').upload(path, file, { upsert: true });
      if (upErr) throw new Error('Erro no upload: ' + upErr.message);
      foto_url = getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
    }
    const promocao   = document.getElementById('item-promocao')?.checked || false;
    const preco_orig = parseFloat(document.getElementById('item-preco-orig')?.value) || null;

    const { error } = await getSupa().from('produtos').insert({
      estabelecimento_id: estab.id, nome,
      descricao: document.getElementById('item-desc')?.value.trim(),
      categoria: document.getElementById('item-cat')?.value.trim().toUpperCase(),
      preco, preco_original: promocao ? preco_orig : null,
      foto_url, emoji: emojiSel, disponivel: true, promocao,
    });
    if (error) throw new Error(error.message);

    await renderCardapio();
    fecharModal();
    showToast('Item adicionado! ✅');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar item'; }
  }
}

export async function deletarItem(id) {
  if (!confirm('Remover este item?')) return;
  await getSupa().from('produtos').delete().eq('id', id);
  await renderCardapio();
  showToast('Item removido.');
}

// ============================================================
// FRESQUINHO — Stories style
// ============================================================
function renderFresquinhoVazio() {
  const grid = document.getElementById('fresquinho-grid'); if (!grid) return;
  grid.innerHTML = `<div class="empty-state-light">
    <span>✨</span>
    <p>Nenhuma foto ou vídeo postado ainda.<br>Clique em <strong>+ Postar</strong> para adicionar conteúdo.</p>
  </div>`;
}

async function renderFresquinho() {
  const estab = getEstab();
  const grid  = document.getElementById('fresquinho-grid');
  if (!grid || !estab) return;

  const { data } = await getSupa().from('fresquinhos').select('*')
    .eq('estabelecimento_id', estab.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (!data?.length) { renderFresquinhoVazio(); return; }

  grid.innerHTML = `<div class="fresh-stories-row">` + data.map(f => {
    const rest = new Date(f.expires_at) - new Date();
    const h = Math.floor(rest / 3600000), m = Math.floor((rest % 3600000) / 60000);
    const tempo = h > 0 ? `${h}h ${m}min` : `${m}min`;
    return `
      <div class="fresh-story-item">
        <div class="fresh-story-thumb" onclick="abrirStoryDash('${f.url}','${f.tipo||'foto'}')">
          ${f.tipo === 'video'
            ? `<video src="${f.url}" muted playsinline loop style="width:100%;height:100%;object-fit:cover"></video>
               <div class="fresh-play">▶</div>`
            : `<img src="${f.url}" alt="Fresquinho" style="width:100%;height:100%;object-fit:cover">`}
          <div class="fresh-overlay"></div>
          <div class="fresh-timer-badge">⏱ ${tempo}</div>
        </div>
        <button class="fresh-remove-btn" onclick="removerFresquinho('${f.id}')">🗑️</button>
      </div>`;
  }).join('') + `</div>`;
}

export async function postarFresquinho(event) {
  const estab = getEstab();
  const file  = event.target.files[0];
  if (!file || !estab || window._isDemo) {
    if (window._isDemo) showToast('No demo não é possível postar. Crie sua conta! 😊');
    return;
  }
  if (file.size > 50 * 1024 * 1024) return showToast('Máx. 50MB', 'error');

  showToast('Enviando...');
  const ext  = file.name.split('.').pop();
  const path = `${estab.id}/fresh_${Date.now()}.${ext}`;
  const tipo = file.type.startsWith('video') ? 'video' : 'foto';

  const { error } = await getSupa().storage.from('fotos').upload(path, file, { upsert: true });
  if (error) return showToast('Erro: ' + error.message, 'error');

  const url = getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
  await getSupa().from('fresquinhos').insert({
    estabelecimento_id: estab.id, url, tipo,
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  });

  await renderFresquinho();
  showToast('Postado! Disponível por 4h ✨');
  event.target.value = '';
}

export async function removerFresquinho(id) {
  if (!confirm('Remover este conteúdo?')) return;
  await getSupa().from('fresquinhos').delete().eq('id', id);
  await renderFresquinho();
  showToast('Removido.');
}

// Abre story em tela cheia
window.abrirStoryDash = function(url, tipo) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = tipo === 'video'
    ? `<video src="${url}" controls autoplay style="max-width:90vw;max-height:90vh;border-radius:12px"></video>`
    : `<img src="${url}" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain">`;
  const close = document.createElement('button');
  close.style.cssText = 'position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.15);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:1.1rem;cursor:pointer';
  close.textContent = '✕';
  close.onclick = e => { e.stopPropagation(); overlay.remove(); };
  overlay.appendChild(close);
  document.body.appendChild(overlay);
};

window.abrirStory = function(url, tipo) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer`;
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = tipo === 'video'
    ? `<video src="${url}" controls autoplay style="max-width:90vw;max-height:90vh;border-radius:12px"></video>`
    : `<img src="${url}" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain">`;
  document.body.appendChild(overlay);
};

// ============================================================
// PEDIDOS
// ============================================================
async function renderPedidos() {
  const estab = getEstab(); if (!estab) return;
  const { data } = await getSupa().from('pedidos').select('*')
    .eq('estabelecimento_id', estab.id)
    .order('created_at', { ascending: false }).limit(50);

  const hoje    = new Date().toDateString();
  const pedHoje = (data || []).filter(p => new Date(p.created_at).toDateString() === hoje);
  const fatHoje = pedHoje.reduce((s, p) => s + Number(p.total || 0), 0);

  const statPed = document.getElementById('stat-pedidos');
  const statFat = document.getElementById('stat-faturamento');
  if (statPed) statPed.textContent = pedHoje.length;
  if (statFat) statFat.textContent = `R$ ${fatHoje.toFixed(2).replace('.', ',')}`;

  const card = p => {
    const cls = { novo:'status-novo', preparo:'status-preparo', pronto:'status-pronto' }[p.status] || 'status-novo';
    const lbl = { novo:'NOVO', preparo:'PREPARO', pronto:'PRONTO' }[p.status] || 'NOVO';
    const min = Math.floor((Date.now() - new Date(p.created_at)) / 60000);
    return `<div class="pedido-card">
      <div class="pedido-top">
        <div>
          <div class="pedido-id">#${p.id.slice(-4).toUpperCase()} — ${p.cliente_nome || 'Cliente'}</div>
          <div class="pedido-tempo">há ${min < 1 ? 'menos de 1' : min} min</div>
        </div>
        <span class="pedido-status ${cls}">${lbl}</span>
      </div>
      <div class="pedido-itens">${Array.isArray(p.itens) ? p.itens.map(i => `${i.qtd}x ${i.nome}`).join(' • ') : ''}</div>
      <div class="pedido-total">R$ ${Number(p.total || 0).toFixed(2).replace('.', ',')}</div>
    </div>`;
  };

  const listUlt = document.getElementById('ultimos-pedidos');
  const listTod = document.getElementById('todos-pedidos');
  if (listUlt && pedHoje.length) listUlt.innerHTML = pedHoje.slice(0, 3).map(card).join('');
  if (listTod && data?.length)   listTod.innerHTML = data.map(card).join('');
}

// ============================================================
// LOGO
// ============================================================
export function previewLogo(event) {
  const file = event.target.files[0]; if (!file) return;
  logoFile = file;
  const img = document.getElementById('logo-preview-img');
  const txt = document.getElementById('logo-placeholder-text');
  if (img) { img.src = URL.createObjectURL(file); img.style.display = 'block'; }
  if (txt) txt.style.display = 'none';
}

// ── CROP LOGO ────────────────────────────────────────────────
let cropObjectUrl = null;

window.abrirCropLogo = function(event) {
  const file = event.target.files[0]; if (!file) return;
  logoFile = file;
  cropObjectUrl = URL.createObjectURL(file);
  const cropImg = document.getElementById('crop-img');
  if (cropImg) {
    cropImg.src = cropObjectUrl;
    cropImg.style.transform = 'scale(1) translate(0px, 0px)';
  }
  document.getElementById('crop-zoom').value = 100;
  document.getElementById('crop-x').value = 0;
  document.getElementById('crop-y').value = 0;
  document.getElementById('crop-overlay').classList.add('open');
  event.target.value = '';
};

window.ajustarCropZoom = function(v) {
  const img = document.getElementById('crop-img'); if (!img) return;
  const x = document.getElementById('crop-x')?.value || 0;
  const y = document.getElementById('crop-y')?.value || 0;
  img.style.transform = `scale(${v/100}) translate(${x}px, ${y}px)`;
};

window.ajustarCropX = function(v) {
  const img = document.getElementById('crop-img'); if (!img) return;
  const zoom = document.getElementById('crop-zoom')?.value || 100;
  const y = document.getElementById('crop-y')?.value || 0;
  img.style.transform = `scale(${zoom/100}) translate(${v}px, ${y}px)`;
};

window.ajustarCropY = function(v) {
  const img = document.getElementById('crop-img'); if (!img) return;
  const zoom = document.getElementById('crop-zoom')?.value || 100;
  const x = document.getElementById('crop-x')?.value || 0;
  img.style.transform = `scale(${zoom/100}) translate(${x}px, ${v}px)`;
};

window.fecharCrop = function() {
  document.getElementById('crop-overlay').classList.remove('open');
  logoFile = null;
};

window.confirmarCrop = function() {
  // Usa a imagem como está (com CSS transform aplicado visualmente)
  const img = document.getElementById('logo-preview-img');
  const txt = document.getElementById('logo-placeholder-text');
  if (img && cropObjectUrl) {
    img.src = cropObjectUrl;
    const zoom = document.getElementById('crop-zoom')?.value || 100;
    const x = document.getElementById('crop-x')?.value || 0;
    const y = document.getElementById('crop-y')?.value || 0;
    img.style.transform = `scale(${zoom/100}) translate(${x}px, ${y}px)`;
    img.style.display = 'block';
  }
  if (txt) txt.style.display = 'none';
  document.getElementById('crop-overlay').classList.remove('open');
};

// ============================================================
// CONFIGURAÇÕES
// ============================================================
export async function salvarConfig() {
  if (window._isDemo) return showToast('No demo não é possível salvar. Crie sua conta! 😊');
  const estab = getEstab(); if (!estab) return;

  const nome  = document.getElementById('cfg-nome')?.value.trim();
  const slug  = document.getElementById('cfg-slug')?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const whats = document.getElementById('cfg-whats')?.value.trim();
  const desc  = document.getElementById('cfg-desc')?.value.trim();
  if (!nome || !slug) return showToast('Preencha nome e link.', 'error');

  const btn = document.querySelector('[onclick="salvarConfig()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    if (slug !== estab.slug) {
      const { data: existe } = await getSupa().from('estabelecimentos').select('id').eq('slug', slug).maybeSingle();
      if (existe) throw new Error('Esse link já está em uso. Escolha outro.');
    }

    let logo_url = estab.logo_url || null;
    if (logoFile) {
      const ext  = logoFile.name.split('.').pop();
      const path = `${estab.id}/logo.${ext}`;
      const { error: upErr } = await getSupa().storage.from('fotos').upload(path, logoFile, { upsert: true });
      if (upErr) throw new Error('Erro no upload da logo: ' + upErr.message);
      logo_url = getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
      logoFile = null;
    }

    const { error } = await getSupa().from('estabelecimentos')
      .update({ nome, slug, whatsapp: whats, descricao: desc, logo_url })
      .eq('id', estab.id);
    if (error) throw new Error(error.message);

    const novoEstab = { ...estab, nome, slug, whatsapp: whats, descricao: desc, logo_url };
    window._estab = novoEstab;
    localStorage.setItem('pw_estab', JSON.stringify(novoEstab));

    document.getElementById('dash-store-name').textContent = nome;
    const linkEl = document.getElementById('link-url');
    if (linkEl) linkEl.textContent = `${BASE}/${slug}`;
    const cfgLink = document.getElementById('cfg-link-preview');
    if (cfgLink) cfgLink.textContent = `${BASE}/${slug}`;

    showToast('Configurações salvas! ✅');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar configurações'; }
  }
}

// Expõe globalmente
window.abrirModalItem    = abrirModalItem;
  window.previewFotos      = previewFotos;
window.fecharModal       = fecharModal;
window.fecharModalFora   = fecharModalFora;
window.previewFoto       = previewFoto;
window.previewLogo       = previewLogo;
window.selecionarEmoji   = selecionarEmoji;
window.salvarItem        = salvarItem;
window.deletarItem       = deletarItem;
window.postarFresquinho  = postarFresquinho;
window.removerFresquinho = removerFresquinho;
window.salvarConfig      = salvarConfig;
window.initDashboard     = initDashboard;
