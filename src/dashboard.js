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
let _audioAtual = null; // instância de Audio ativa
let pedidosConhecidos = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const getEstab = () => {
  if (window._estab) return window._estab;
  try { return JSON.parse(localStorage.getItem('pw_estab') || 'null'); } catch(e) { return null; }
};

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
// ── Restrição por plano ──────────────────────────────────────────────────────
function aplicarRestricaoPlano(estab) {
  const plano   = estab?.plano || 'basico';
  const criado  = estab?.created_at ? new Date(estab.created_at) : null;
  const diasTrial = criado ? Math.floor((Date.now() - criado) / 86400000) : 999;
  const trialAtivo = plano === 'basico' && diasTrial <= 15;
  const diasRestantes = Math.max(0, 15 - diasTrial);

  // Tabs disponíveis por plano:
  // Trial (basico, até 15 dias): TUDO
  // Pro: visao, pedidos, cardapio, fresquinho, configuracoes
  // Premium: visao, pedidos, comandas, cardapio, fresquinho, financeiro, configuracoes
  // Trial vencido (basico > 15 dias): apenas visao + configuracoes (forçar upgrade)

  const CONFIG_PLANOS = {
    basico_ativo:  ['visao-geral','pedidos-tab','comandas','cardapio','fresquinho','financeiro','configuracoes'],
    basico_vencido:['visao-geral','configuracoes'],
    pro:           ['visao-geral','pedidos-tab','cardapio','fresquinho','configuracoes'],
    premium:       ['visao-geral','pedidos-tab','comandas','cardapio','fresquinho','financeiro','configuracoes'],
  };

  const chave = plano === 'basico'
    ? (trialAtivo ? 'basico_ativo' : 'basico_vencido')
    : (plano === 'pro' ? 'pro' : 'premium');

  const permitidas = CONFIG_PLANOS[chave] || CONFIG_PLANOS.pro;

  // Aplica visibilidade em todas as abas
  ['visao-geral','pedidos-tab','comandas','cardapio','fresquinho','financeiro','configuracoes'].forEach(tab => {
    const btn = document.querySelector(`[data-tab="${tab}"]`);
    const pg  = document.getElementById(`tab-${tab}`);
    const vis = permitidas.includes(tab);
    if (btn) btn.style.display = vis ? '' : 'none';
    if (pg)  pg.style.display  = vis ? '' : 'none';
  });

  // Banner trial
  const bannerTrial = document.getElementById('banner-trial');
  if (bannerTrial) {
    if (plano === 'basico' && trialAtivo) {
      bannerTrial.style.display = 'flex';
      const diasEl = document.getElementById('trial-dias');
      if (diasEl) diasEl.textContent = diasRestantes === 0 ? 'Último dia!' : `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`;
    } else {
      bannerTrial.style.display = 'none';
    }
  }

  // Banner upgrade (trial vencido ou plano básico expirado)
  const banner = document.getElementById('banner-upgrade');
  if (banner) banner.style.display = (plano === 'basico' && !trialAtivo) ? 'flex' : 'none';
}

// ── Link ME AJUDA PEDIWAY — usa config do CEO ──────────────────────────────
function atualizarLinkSuporte() {
  const cfg = JSON.parse(localStorage.getItem('pw_ceo_cfg') || '{}');
  const wpp = cfg.wpp || '5500000000000';
  const msg = encodeURIComponent(cfg.wppMsg || 'Olá! Preciso de ajuda com o PEDIWAY.');
  const link = document.getElementById('link-me-ajuda');
  if (link) link.href = `https://wa.me/${wpp}?text=${msg}`;
}


// ── CHECKOUT / PLANOS ─────────────────────────────────────────────────────────
window.irCheckout = function(plano) {
  const estab = getEstab();
  if (!estab) return showToast('Faça login primeiro.', 'error');
  const cfg  = JSON.parse(localStorage.getItem('pw_ceo_cfg') || '{}');
  const pro  = cfg.precoPro  || '49';
  const prem = cfg.precoPrem || '99';
  window.open(`/checkout?plano=${plano}&estab=${estab.id}&precoPro=${pro}&precoPrem=${prem}`, '_blank');
};

// Atualiza preços no dashboard conforme config do CEO
function atualizarPrecosDash() {
  const cfg = JSON.parse(localStorage.getItem('pw_ceo_cfg') || '{}');
  const pro  = cfg.precoPro  || '49';
  const prem = cfg.precoPrem || '99';
  const elPro  = document.getElementById('dash-preco-pro');
  const elPrem = document.getElementById('dash-preco-prem') || document.getElementById('dash-preco-premium');
  if (elPro)  elPro.textContent  = pro;
  if (elPrem) elPrem.textContent = prem;
}

function atualizarInfoPlano() {
  const estab = getEstab();
  if (!estab) return;
  const el    = document.getElementById('cfg-plano-atual');
  const elvenc= document.getElementById('cfg-venc-atual');
  const nomes = { basico:'Trial (grátis)', pro:'Pro', premium:'Premium' };
  if (el)    el.textContent = nomes[estab.plano] || 'Trial';
  if (elvenc && estab.assinatura_vencimento) {
    const venc = new Date(estab.assinatura_vencimento);
    const hoje = new Date();
    const dias = Math.round((venc - hoje) / 86400000);
    elvenc.textContent = dias > 0
      ? `Vence em ${dias} dia${dias !== 1 ? 's' : ''} (${venc.toLocaleDateString('pt-BR')})`
      : `Assinatura vencida em ${venc.toLocaleDateString('pt-BR')}`;
    if (dias <= 5) elvenc.style.color = '#C0392B';
  }
}

export async function initDashboard() {
  let estab = getEstab();
  if (!estab) return;
  atualizarLinkSuporte();
  atualizarInfoPlano();
  aplicarRestricaoPlano(estab);
  atualizarPrecosDash();
  atualizarBotaoCancelar(estab);

  // SEMPRE busca dados frescos do banco — garante sync entre mobile e desktop
  if (!window._isDemo) {
    try {
      const { data: fresh } = await getSupa()
        .from('estabelecimentos').select('*').eq('id', estab.id).maybeSingle();
      if (fresh) {
        estab = fresh;
        window._estab = fresh;
        localStorage.setItem('pw_estab', JSON.stringify(fresh));
        // Sincroniza número de mesas do banco para o localStorage local
        if (fresh.num_mesas) {
          localStorage.setItem('pw_num_mesas_' + fresh.id, String(fresh.num_mesas));
        }
      }
    } catch(e) { console.log('Sync estab:', e); }
  }

  // Textos do header
  const sn = $('dash-store-name'); if (sn) sn.textContent = estab.nome;
  const lu = $('link-url');        if (lu) lu.textContent = `${BASE_URL}/${estab.slug}`;
  const lug = $('link-url-garcom');if (lug) lug.textContent = `${BASE_URL}/comandas/${estab.slug}`;

  // Preenche configurações
  preencherConfig(estab);
  if (estab.logo_url) mostrarLogoPreview(estab.logo_url);

  // Cor e capa
  corAtiva = normalizeHex(estab.cor_primaria || '#C0392B');
  renderCores(corAtiva);
  aplicarCorDash(corAtiva);
  mostrarCapaPreview(corAtiva);

  // Status loja
  atualizarBadgeLoja(estab.aberto !== false);
  const cbAberto = $('cfg-aberto');
  if (cbAberto) cbAberto.checked = estab.aberto !== false;
  // Taxa entrega
  const tw = document.getElementById('taxa-entrega-wrap');
  if (tw) tw.style.display = estab.faz_entrega !== false ? 'block' : 'none';

  // Dados
  if (!window._isDemo) {
    await renderCardapio();
    await renderFresquinho();
    await renderPedidos();
    await carregarFinanceiro();
    iniciarRealtime();
    await carregarPedidosMesas();
    renderMesas();
    window.renderHistoricoMesas();
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
  const cfgLinkGarcom = $('cfg-link-garcom');
  if (cfgLinkGarcom) cfgLinkGarcom.textContent = `${BASE_URL}/comandas/${estab.slug}`;
  const ce = $('cfg-entrega');  if (ce) ce.checked = estab.faz_entrega  !== false;
  const cr = $('cfg-retirada'); if (cr) cr.checked = estab.faz_retirada !== false;
  const ct = $('cfg-taxa');     if (ct) ct.value   = estab.taxa_entrega || '';
  const cp = $('cfg-pix');      if (cp) cp.checked = estab.aceita_pix      !== false;
  const cc = $('cfg-cartao');   if (cc) cc.checked = estab.aceita_cartao   !== false;
  const cd = $('cfg-dinheiro'); if (cd) cd.checked = estab.aceita_dinheiro !== false;
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

    const taxa_entrega   = parseFloat($('cfg-taxa')?.value)     || 0;
    const aceita_pix     = $('cfg-pix')?.checked      !== false;
    const aceita_cartao  = $('cfg-cartao')?.checked   !== false;
    const aceita_dinheiro= $('cfg-dinheiro')?.checked !== false;

    const updates = {
      nome, slug, whatsapp: whats, descricao: desc, endereco,
      tempo_entrega: tempo, aberto, faz_entrega: entrega, faz_retirada: retirada,
      cor_primaria, logo_url,
      capa_url: null, capa_tipo: 'cor',
      taxa_entrega, aceita_pix, aceita_cartao, aceita_dinheiro,
    };

    const { error } = await getSupa().from('estabelecimentos').update(updates).eq('id', estab.id);
    if (error) throw new Error(error.message);

    const novoEstab = { ...estab, ...updates };
    window._estab = novoEstab;
    localStorage.setItem('pw_estab', JSON.stringify(novoEstab));

    // Atualiza UI
    const sn = $('dash-store-name'); if (sn) sn.textContent = nome;
    const lu  = $('link-url');        if (lu)  lu.textContent  = `${BASE_URL}/${slug}`;
    const lug = $('link-url-garcom'); if (lug) lug.textContent = `${BASE_URL}/comandas/${slug}`;
    const cl  = $('cfg-link-preview');if (cl)  cl.textContent  = `${BASE_URL}/${slug}`;
    const clg = $('cfg-link-garcom'); if (clg) clg.textContent = `${BASE_URL}/comandas/${slug}`;
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
  const file = event.target.files[0]; if (!file) return;
  event.target.value = '';
  // Abre modal de crop para ajuste antes de adicionar
  abrirCropFoto(file);
}
export function previewFoto(e) { previewFotos(e); }



// ── CROP DE FOTO DO PRODUTO ────────────────────────────────────────────────
let _cropFotoFile  = null;
let _cropFotoUrl   = null;
let _cropFotoPosX  = 50;
let _cropFotoPosY  = 50;
let _cropFotoDragAtivo = false;
let _cropFotoDragX = 0, _cropFotoDragY = 0;

window.abrirCropFoto = function(file) {
  _cropFotoFile = file;
  _cropFotoPosX = 50; _cropFotoPosY = 50;
  _cropFotoUrl  = URL.createObjectURL(file);

  const modal = $('modal-crop-foto'); if (!modal) return;
  const img   = $('crop-foto-img');
  const mini  = $('crop-foto-mini');
  if (img)  { img.src  = _cropFotoUrl; img.style.objectPosition  = '50% 50%'; }
  if (mini) { mini.src = _cropFotoUrl; }

  // Atualiza pin do minimap
  const pin = $('crop-foto-pin');
  if (pin) { pin.style.left = '50%'; pin.style.top = '50%'; }

  modal.classList.add('open');
};

window.confirmarCropFoto = function() {
  if (!_cropFotoFile) return;
  fotosFiles.push(_cropFotoFile);
  fotosPosX.push(_cropFotoPosX);
  fotosPosY.push(_cropFotoPosY);
  $('modal-crop-foto').classList.remove('open');
  renderFotosGrid();
};

window.fecharCropFoto = function() {
  $('modal-crop-foto').classList.remove('open');
  _cropFotoFile = null;
};

// Drag no modal de crop
document.addEventListener('DOMContentLoaded', function() {
  const area = $('crop-foto-area'); if (!area) return;

  const start = function(e) {
    _cropFotoDragAtivo = true;
    const t = e.touches ? e.touches[0] : e;
    _cropFotoDragX = t.clientX; _cropFotoDragY = t.clientY;
    area.style.cursor = 'grabbing';
    e.preventDefault();
  };
  const move = function(e) {
    if (!_cropFotoDragAtivo) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = (t.clientX - _cropFotoDragX) / area.offsetWidth  * 100;
    const dy = (t.clientY - _cropFotoDragY) / area.offsetHeight * 100;
    _cropFotoDragX = t.clientX; _cropFotoDragY = t.clientY;
    _cropFotoPosX = Math.max(0, Math.min(100, _cropFotoPosX - dx * 0.6));
    _cropFotoPosY = Math.max(0, Math.min(100, _cropFotoPosY - dy * 0.6));
    const img = $('crop-foto-img');
    if (img) img.style.objectPosition = _cropFotoPosX + '% ' + _cropFotoPosY + '%';
    const pin = $('crop-foto-pin');
    if (pin) { pin.style.left = _cropFotoPosX + '%'; pin.style.top = _cropFotoPosY + '%'; }
    e.preventDefault();
  };
  const end = function() { _cropFotoDragAtivo = false; area.style.cursor = 'grab'; };

  area.addEventListener('mousedown',  start, {passive:false});
  area.addEventListener('touchstart', start, {passive:false});
  document.addEventListener('mousemove',  move, {passive:false});
  document.addEventListener('touchmove',  move, {passive:false});
  document.addEventListener('mouseup',  end);
  document.addEventListener('touchend', end);
});

function renderFotosGrid() {
  const grid = $('fotos-grid'); if (!grid) return;

  const fotoHtml = (url, i) => {
    const px = fotosPosX[i] ?? 50;
    const py = fotosPosY[i] ?? 50;
    const eh = fotosFiles[i]?._urlExistente ? '📎 Existente' : '✨ Nova';
    return `<div class="foto-thumb-wrap" id="foto-wrap-${i}">
      <div style="position:relative;width:100%;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:#f0ebe4;border:2px solid var(--border);margin-bottom:8px;cursor:grab;touch-action:none" id="foto-drag-${i}">
        <img src="${url}" id="foto-img-${i}" draggable="false"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${px}% ${py}%;pointer-events:none;user-select:none;transition:object-position .05s">
        ${i===0 ? '<div style="position:absolute;top:8px;left:8px;background:var(--red);color:#fff;font-size:.62rem;font-weight:800;padding:3px 10px;border-radius:50px;z-index:3;letter-spacing:.04em">PRINCIPAL</div>' : ''}
        <!-- Instrução -->
        <div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;pointer-events:none;z-index:2">
          <div style="background:rgba(0,0,0,.55);color:#fff;font-size:.62rem;font-weight:600;padding:4px 12px;border-radius:50px;backdrop-filter:blur(6px)">
            ✋ Arraste para reposicionar
          </div>
        </div>
        <!-- Minimap -->
        <div style="position:absolute;bottom:10px;right:10px;width:44px;height:44px;border-radius:8px;overflow:hidden;background:rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.35);z-index:3">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover;opacity:.7">
          <div id="foto-pin-${i}" style="position:absolute;width:8px;height:8px;background:#fff;border-radius:50%;border:1.5px solid var(--red);transform:translate(-50%,-50%);left:${px}%;top:${py}%;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:.65rem;color:#aaa">${eh}</span>
        <button onclick="removerFotoItem(${i})" style="background:none;border:1px solid #e0dbd5;color:#aaa;padding:4px 12px;border-radius:8px;font-size:.7rem;font-weight:600;cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'" onmouseout="this.style.borderColor='#e0dbd5';this.style.color='#aaa'">🗑 Remover</button>
      </div>
    </div>`;
  };

  let html = fotosFiles.map((f, i) => {
    const url = f._urlExistente ? f._urlExistente : URL.createObjectURL(f);
    return fotoHtml(url, i);
  }).join('');

  if (fotosFiles.length < 5) {
    html += `<div class="foto-add-btn" onclick="document.getElementById('foto-input').click()">
      <span style="font-size:1.5rem">📷</span>
      <span style="font-size:.72rem;color:#aaa">Adicionar foto</span>
    </div>`;
  }

  grid.innerHTML = html;
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
    // Fotos existentes — carrega no mesmo sistema de drag 1:1
    const fotosExist = (p.fotos_urls && p.fotos_urls.length) ? p.fotos_urls : (p.foto_url ? [p.foto_url] : []);
    // Converte URLs existentes para Blob para entrar no mesmo array fotosFiles
    const carregarFotosExist = async () => {
      for (const url of fotosExist) {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const ext  = url.split('.').pop().split('?')[0] || 'jpg';
          const file = new File([blob], 'existente.' + ext, { type: blob.type });
          file._urlExistente = url; // marca URL original para salvar sem re-upload
          fotosFiles.push(file);
          fotosPosX.push(50);
          fotosPosY.push(50);
        } catch(e) {
          console.warn('Foto não carregou:', url, e);
        }
      }
      renderFotosGrid();
    };
    carregarFotosExist();
    // Botão salvar
    const btn = document.querySelector('#modal-item .btn-primary');
    if (btn) {
      btn.textContent = 'Salvar alterações';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Salvando...';
        try {
          // Upload só das fotos novas; fotos existentes (com _urlExistente) reutilizam a URL
          const fotos_urls = [];
          for (let fi = 0; fi < fotosFiles.length; fi++) {
            const file = fotosFiles[fi];
            if (file._urlExistente) {
              fotos_urls.push(file._urlExistente); // reusa URL original — sem re-upload
            } else {
              const url = await uploadFile('fotos', `${estab.id}/${Date.now()}_${fi}.${file.name.split('.').pop()}`, file);
              fotos_urls.push(url);
            }
          }
          const foto_url = fotos_urls[0] || null;
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

  // Delivery/retirada na aba Pedidos, mesas na aba Comandas
  const pedidos    = (data || []).filter(p => !((p.endereco||'').startsWith('No local')));
  const pedidosMes = (data || []); // TODOS os pedidos para faturamento total

  const hoje       = new Date().toDateString();
  const pedHoje    = pedidos.filter(p => new Date(p.created_at).toDateString() === hoje);
  // Faturamento inclui MESAS + delivery
  const todosHoje  = pedidosMes.filter(p => new Date(p.created_at).toDateString() === hoje && p.status !== 'recusado');
  const fatHoje    = todosHoje.reduce((s, p) => s + Number(p.total || 0), 0);
  const totalPeds  = todosHoje.length;

  const sp = $('stat-pedidos'); if (sp) sp.textContent = totalPeds;
  const sf = $('stat-faturamento'); if (sf) sf.textContent = `R$ ${fatHoje.toFixed(2).replace('.',',')}`;

  // Área de novos pedidos
  const novos = pedidos.filter(p => p.status === 'novo');
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
    const CLS = { novo:'status-novo', preparo:'status-preparo', pronto:'status-pronto', recusado:'status-recusado' };
    const LBL = { novo:'Novo', preparo:'Em preparo', pronto:'Pronto', recusado:'Recusado' };
    const ICONS = { novo:'🔔', preparo:'👨‍🍳', pronto:'✅', recusado:'❌' };
    const cls = CLS[p.status] || 'status-novo';
    const lbl = LBL[p.status] || 'Novo';
    const ico = ICONS[p.status] || '🔔';
    const min = Math.floor((Date.now() - new Date(p.created_at)) / 60000);
    const tempoStr = min < 1 ? 'agora' : min < 60 ? `${min}min` : `${Math.floor(min/60)}h${min%60>0?min%60+'min':''}`;
    const itensStr = Array.isArray(p.itens) ? p.itens.map(i=>`${i.qtd}x ${i.nome}`).join(' · ') : '';
    const totalFmt = 'R$ ' + Number(p.total||0).toFixed(2).replace('.',',');
    const endStr   = p.endereco === 'Retirada no local' ? '🏃 Retirada' : p.endereco ? `🛵 ${p.endereco.split(',')[0]}` : '🏃 Retirada';
    const pgto     = p.pagamento ? p.pagamento.toUpperCase() : '';
    return `<div class="pedido-card ped-status-${p.status||'novo'}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div style="width:38px;height:38px;border-radius:10px;background:#f5f0eb;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${ico}</div>
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:.92rem;font-weight:800">#${p.id.slice(-4).toUpperCase()}</span>
              <span style="font-size:.82rem;font-weight:600;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">${p.cliente_nome||'Cliente'}</span>
            </div>
            <div style="font-size:.7rem;color:#aaa;margin-top:2px">${tempoStr} atrás · ${endStr}</div>
          </div>
        </div>
        <span class="pedido-status ${cls}" style="white-space:nowrap;flex-shrink:0">${lbl}</span>
      </div>
      ${itensStr ? `<div style="font-size:.82rem;color:#666;background:#faf8f5;border-radius:8px;padding:8px 10px;margin-bottom:10px;line-height:1.5">${itensStr}</div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem;font-weight:800;color:var(--red)">${totalFmt}</span>
          ${pgto ? `<span style="background:#f0e9e0;padding:2px 8px;border-radius:50px;font-size:.65rem;font-weight:700;color:#888">${pgto}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${p.status==='novo'?`<button class="btn-ped-aceitar" onclick="aceitarPedido('${p.id}')">Aceitar</button><button class="btn-ped-recusar" onclick="recusarPedido('${p.id}')">Recusar</button>`:''}
          ${p.status==='preparo'?`<button class="btn-ped-aceitar" onclick="marcarPronto('${p.id}')">✅ Marcar pronto</button>`:''}
          <button class="btn-ped-imprimir" onclick="verPedido('${p.id}')">Ver mais</button>
        </div>
      </div>
    </div>`;
  };
  if (lu) lu.innerHTML = pedHoje.length ? pedHoje.slice(0,3).map(cardHtml).join('') : '<div class="empty-state-light"><span>🛵</span><p>Nenhum pedido ainda.</p></div>';
  if (td) td.innerHTML = pedidos.length ? pedidos.map(cardHtml).join('') : '<div class="empty-state-light"><span>📋</span><p>Nenhum pedido ainda.</p></div>';
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
  removerCardNovo(id); showToast('Pedido aceito! 👍');
  await carregarPedidosMesas(); renderMesas();
  await renderPedidos();
};

window.recusarPedido = async function(id) {
  if (!confirm('Recusar este pedido?')) return;
  pararNotif();
  await getSupa().from('pedidos').update({ status:'recusado' }).eq('id', id);
  removerCardNovo(id); showToast('Pedido recusado.');
  await carregarPedidosMesas(); renderMesas();
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
  if (_audioAtual) {
    _audioAtual.pause();
    _audioAtual.currentTime = 0;
  }
  try {
    const a = new Audio('/sounds/new-order.mp3');
    a.volume = 0.85;
    _audioAtual = a;
    a.play().catch(() => {
      // Fallback: tenta o arquivo antigo
      const b = new Audio('/notificacao.mp3');
      b.volume = 0.85; _audioAtual = b;
      b.play().catch(()=>{});
    });
  } catch(e) {}
}
function pararNotif() {
  clearTimeout(_notifLoop);
  _notifLoop = null;
  if (_audioAtual) { _audioAtual.pause(); _audioAtual.currentTime = 0; _audioAtual = null; }
}
function notifLoop(id) {
  tocarNotif();
  // Quando o som terminar, aguarda 5s e toca de novo se o pedido ainda está aguardando
  if (_audioAtual) {
    _audioAtual.onended = () => {
      _notifLoop = setTimeout(() => {
        if (document.getElementById(`pnc-${id}`)) notifLoop(id);
      }, 5000);
    };
  } else {
    _notifLoop = setTimeout(() => {
      if (document.getElementById(`pnc-${id}`)) notifLoop(id);
    }, 5000);
  }
}

function iniciarRealtime() {
  const estab = getEstab(); if (!estab || estab.id === 'demo') return;

  // Remove canal anterior limpo
  if (realtimeSub) {
    try { getSupa().removeChannel(realtimeSub); } catch(e) {}
    realtimeSub = null;
  }

  const channelName = 'pedidos-' + estab.id;

  realtimeSub = getSupa()
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pedidos' },
      async payload => {
        const p = payload.new;
        if (!p || !p.id) return;
        if (p.estabelecimento_id !== estab.id) return;

        // ── Pedido de mesa (No local) ──────────────────────────────
        if (p.endereco && p.endereco.startsWith('No local')) {
          const parts = p.endereco.split('—');
          if (parts.length >= 2) {
            const key = parts[1].trim();
            if (!_pedidosMesas[key]) _pedidosMesas[key] = [];
            if (!_pedidosMesas[key].find(x => x.id === p.id)) {
              _pedidosMesas[key].push(p);
              renderMesas();
              showToast('🍽️ Novo pedido na ' + key + '!');
            }
          }
        }

        // ── Pedido de mesa: atualiza visão geral e financeiro
        if ((p.endereco||'').startsWith('No local')) {
          await carregarPedidosMesas(); renderMesas();
          await renderPedidos(); // atualiza stats da visão geral
          return;
        }
        // ── Pedido normal (delivery/retirada) — aparece na aba Pedidos ─
        if (pedidosConhecidos.has(p.id)) return;
        pedidosConhecidos.add(p.id);
        const lista = $('pedidos-novos-lista');
        if (lista) {
          const ph = lista.querySelector('[data-placeholder]');
          if (ph) ph.remove();
          lista.insertAdjacentHTML('afterbegin', cardNovoHTML(p));
          atualizarBadgePedidos();
          notifLoop(p.id);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'pedidos' },
      async payload => {
        const p = payload.new;
        if (!p || p.estabelecimento_id !== estab.id) return;
        renderPedidos();
        // Se é pedido de mesa, re-sincroniza mesas (ex: garçom fechou comanda)
        if ((p.endereco||'').startsWith('No local')) {
          await carregarPedidosMesas();
          renderMesas();
          window.renderHistoricoMesas();
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Conectado ao canal:', channelName);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] Erro, tentando reconectar em 5s...');
        setTimeout(iniciarRealtime, 5000);
      }
    });

  // Polling de segurança a cada 5s
  clearInterval(pollingId);
  pollingId = setInterval(async () => {
    const est = getEstab(); if (!est || est.id === 'demo') return;
    const { data } = await getSupa().from('pedidos').select('id,cliente_nome,itens,total,status,created_at,endereco')
      .eq('estabelecimento_id', est.id).eq('status','novo').order('created_at',{ascending:false}).limit(20);
    if (!data) return;
    data.forEach(p => {
      if ((p.endereco||'').startsWith('No local')) return; // mesa → aba Comandas
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
// FINANCEIRO DO ESTABELECIMENTO
// ─────────────────────────────────────────────────────────────────────────────
let _finPeriodo = 'hoje';
let _finPedidos = [];

async function carregarFinanceiro() {
  const estab = getEstab(); if (!estab || estab.id === 'demo') return;
  const { data } = await getSupa()
    .from('pedidos').select('*')
    .eq('estabelecimento_id', estab.id)
    .order('created_at', { ascending: false })
    .limit(500);
  // Financeiro inclui TODOS os pedidos: delivery + mesas/comandas
  _finPedidos = (data || []);
  renderFinanceiro();
}

function filtroPedidosFin() {
  const now = new Date();
  return _finPedidos.filter(p => {
    if (p.status === 'recusado') return false;
    const d = new Date(p.created_at);
    if (_finPeriodo === 'hoje')   return d.toDateString() === now.toDateString();
    if (_finPeriodo === 'semana') { const s=new Date(now); s.setDate(s.getDate()-7); return d>=s; }
    if (_finPeriodo === 'mes')    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    return true;
  });
}

function renderFinanceiro() {
  const peds = filtroPedidosFin();
  const fat  = peds.reduce((s,p)=>s+Number(p.total||0),0);
  const taxa = peds.reduce((s,p)=>s+Number(p.taxa_entrega||0),0);
  const tick = peds.length ? fat/peds.length : 0;
  const fmtR = v => 'R$ ' + Number(v||0).toFixed(2).replace('.',',');

  const se = id => document.getElementById(id);
  if (se('fin-fat-est'))  se('fin-fat-est').textContent  = fmtR(fat);
  if (se('fin-qtd-est'))  se('fin-qtd-est').textContent  = peds.length;
  if (se('fin-tick-est')) se('fin-tick-est').textContent = fmtR(tick);
  if (se('fin-taxa-est')) se('fin-taxa-est').textContent = fmtR(taxa);

  // Formas de Pagamento
  const pm = {};
  peds.forEach(p => { const k=(p.pagamento||'Não informado').toUpperCase(); pm[k]=(pm[k]||0)+Number(p.total||0); });
  const totPag = Object.values(pm).reduce((s,v)=>s+v,0)||1;
  const pagsEl = se('fin-pags-est');
  if (pagsEl) pagsEl.innerHTML = Object.entries(pm).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{
    const pct = Math.round(v/totPag*100);
    return `<div class="pag-row">
      <span class="pag-label">${k}</span>
      <div class="pag-bar-wrap"><div class="pag-bar-fill" style="width:${pct}%"></div></div>
      <span class="pag-val">${fmtR(v)}</span>
      <span class="pag-pct">${pct}%</span>
    </div>`;
  }).join('') || '<div style="color:#aaa;font-size:.82rem;text-align:center;padding:20px">Sem pedidos no período</div>';

  // Histórico
  const histEl = se('fin-hist-est');
  if (histEl) histEl.innerHTML = !peds.length
    ? '<tr><td colspan="5" style="text-align:center;padding:24px;color:#aaa;font-size:0.82rem">Nenhum pedido no período</td></tr>'
    : peds.slice(0,100).map(p => {
        const dt = new Date(p.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        const fmtV = v => 'R$ '+Number(v||0).toFixed(2).replace('.',',');
        const stCls = {novo:'#f59e0b',preparo:'#3b82f6',pronto:'#22c55e',recusado:'#ef4444'}[p.status]||'#aaa';
        const endCurto = (p.endereco||'Retirada').length > 22 ? (p.endereco||'Retirada').slice(0,22)+'…' : (p.endereco||'Retirada');
        return `<tr>
          <td style="font-weight:800;color:var(--red)">#${p.id.slice(-4).toUpperCase()}</td>
          <td style="font-weight:600">${p.cliente_nome||'—'}</td>
          <td style="font-size:.72rem;color:#aaa" title="${p.endereco||''}">${endCurto}</td>
          <td><span style="background:#f0e9e0;padding:2px 8px;border-radius:50px;font-size:.68rem;font-weight:700">${(p.pagamento||'—').toUpperCase()}</span></td>
          <td style="text-align:right;font-weight:800;color:var(--red)">${fmtV(p.total)}</td>
          <td style="color:#aaa;font-size:.7rem;white-space:nowrap">${dt}</td>
        </tr>`;
      }).join('');
}

function setFinPeriodo(p, btn) {
  _finPeriodo = p;
  ['fin-hoje','fin-semana','fin-mes','fin-tudo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('ativo');
  });
  if (btn) btn.classList.add('ativo');
  renderFinanceiro();
}

function exportarCSV() {
  const estab  = getEstab();
  const linhas = [['#','Cliente','WhatsApp','Status','Pagamento','Total','Taxa Entrega','Data']];
  _finPedidos.forEach(p => {
    linhas.push([
      p.id.slice(-4).toUpperCase(),
      p.cliente_nome||'',
      p.cliente_whats||'',
      p.status,
      p.pagamento||'',
      Number(p.total||0).toFixed(2),
      Number(p.taxa_entrega||0).toFixed(2),
      new Date(p.created_at).toLocaleString('pt-BR'),
    ]);
  });
  const csv = linhas.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download= `pedidos-${estab?.slug||'loja'}-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;
  a.click();
}

function exportarPDF() {
  const estab = getEstab();
  const peds  = filtroPedidosFin();
  const fmtR  = v => 'R$ ' + Number(v||0).toFixed(2).replace('.',',');
  const fat   = peds.reduce((s,p)=>s+Number(p.total||0),0);
  const taxa  = peds.reduce((s,p)=>s+Number(p.taxa_entrega||0),0);
  const tick  = peds.length ? fat/peds.length : 0;
  const periodoLabel = {hoje:'Hoje',semana:'Esta semana',mes:'Este mês',tudo:'Todo o período'}[_finPeriodo]||'';
  const agora = new Date().toLocaleString('pt-BR');

  // Breakdown de pagamentos
  const pm = {};
  peds.forEach(p => {
    const k = (p.pagamento||'Não informado').toUpperCase();
    if (!pm[k]) pm[k] = { q:0, f:0 };
    pm[k].q++; pm[k].f += Number(p.total||0);
  });
  const totPag = Object.values(pm).reduce((s,v)=>s+v.f,0)||1;
  const pagRows = Object.entries(pm).sort((a,b)=>b[1].f-a[1].f)
    .map(([k,d]) => '<tr><td>'+k+'</td><td>'+d.q+'</td><td style="text-align:right">'+fmtR(d.f)+'</td><td style="text-align:right">'+Math.round(d.f/totPag*100)+'%</td></tr>')
    .join('');

  // Linhas do histórico
  const pedRows = peds.slice(0,200).map(p => {
    const dt = new Date(p.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    return '<tr><td style="font-weight:700">#'+p.id.slice(-4).toUpperCase()+'</td><td>'+(p.cliente_nome||'—')+'</td><td style="font-size:10px;color:#666">'+(p.endereco||'Retirada')+'</td><td>'+(p.pagamento||'—')+'</td><td style="text-align:right;font-weight:700;color:#C0392B">'+fmtR(p.total)+'</td><td style="color:#888">'+dt+'</td></tr>';
  }).join('') + '<tr style="font-weight:800;background:#fdf8f5"><td colspan="4">TOTAL ('+peds.length+' pedidos)</td><td style="text-align:right;color:#16a34a">'+fmtR(fat)+'</td><td></td></tr>';

  const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório — '+(estab?.nome||'Loja')+'</title>'
    + '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a;padding:32px}'
    + '.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;border-bottom:2px solid #C0392B;padding-bottom:16px}'
    + '.logo{font-size:20px;font-weight:900}.logo span{color:#C0392B}'
    + '.meta{text-align:right;font-size:11px;color:#666}'
    + '.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}'
    + '.card{background:#f8f5f2;border-radius:8px;padding:14px}'
    + '.card-label{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}'
    + '.card-val{font-size:18px;font-weight:800}.card-val.g{color:#16a34a}.card-val.r{color:#C0392B}'
    + '.section{margin-bottom:20px}.section-title{font-size:11px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:10px}'
    + 'table{width:100%;border-collapse:collapse}'
    + 'th{background:#f0ebe4;padding:7px 10px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;color:#666}'
    + 'td{padding:8px 10px;border-bottom:1px solid #ede8e0;font-size:11px}'
    + 'tr:last-child td{border-bottom:none}'
    + '.footer{margin-top:32px;text-align:center;font-size:10px;color:#aaa}'
    + '@media print{body{padding:0}}'
    + '</style></head><body>'
    + '<div class="header"><div><div class="logo">PEDI<span>WAY</span></div><div style="font-size:13px;font-weight:700;margin-top:4px">'+(estab?.nome||'Estabelecimento')+'</div></div>'
    + '<div class="meta"><strong style="display:block;font-size:13px;color:#1a1a1a">Relatório Financeiro</strong>Período: '+periodoLabel+'<br>Gerado em: '+agora+'</div></div>'
    + '<div class="cards">'
    + '<div class="card"><div class="card-label">Faturamento</div><div class="card-val g">'+fmtR(fat)+'</div></div>'
    + '<div class="card"><div class="card-label">Pedidos</div><div class="card-val">'+peds.length+'</div></div>'
    + '<div class="card"><div class="card-label">Ticket médio</div><div class="card-val r">'+fmtR(tick)+'</div></div>'
    + '<div class="card"><div class="card-label">Taxa entrega</div><div class="card-val">'+fmtR(taxa)+'</div></div>'
    + '</div>'
    + '<div class="section"><div class="section-title">Por forma de pagamento</div>'
    + '<table><thead><tr><th>Forma</th><th>Pedidos</th><th style="text-align:right">Total</th><th style="text-align:right">%</th></tr></thead><tbody>'+pagRows+'</tbody></table></div>'
    + '<div class="section"><div class="section-title">Histórico de pedidos</div>'
    + '<table><thead><tr><th>#</th><th>Cliente</th><th>Endereço</th><th>Pagamento</th><th style="text-align:right">Total</th><th>Data</th></tr></thead><tbody>'+pedRows+'</tbody></table></div>'
    + '<div class="footer">Relatório gerado pelo PEDIWAY — '+agora+'</div>'
    + '</body></html>';

  const w = window.open('','_blank');
  if (!w) { alert('Permita pop-ups para exportar o PDF.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}


// ── CANCELAR PLANO ────────────────────────────────────────────────────────────
window.abrirCancelarPlano = function() {
  document.getElementById('modal-cancelar-plano')?.classList.add('open');
};
window.fecharCancelarPlano = function() {
  document.getElementById('modal-cancelar-plano')?.classList.remove('open');
};
window.confirmarCancelamento = async function() {
  const radios = document.querySelectorAll('input[name="motivo-cancel"]');
  let motivo = '';
  radios.forEach(r => { if(r.checked) motivo = r.value; });
  if (!motivo) return showToast('Selecione um motivo.', 'error');

  const msg    = document.getElementById('cancel-msg')?.value.trim() || '';
  const estab  = getEstab();
  if (!estab) return;

  const { error } = await getSupa().from('cancelamentos_plano').insert({
    estab_id: estab.id,
    motivo,
    mensagem: msg || null,
  });

  if (error) return showToast('Erro ao registrar cancelamento.', 'error');

  // Atualiza plano para basico
  await getSupa().from('estabelecimentos')
    .update({ plano:'basico', pagamento_status:'cancelado' })
    .eq('id', estab.id);

  fecharCancelarPlano();
  showToast('Cancelamento registrado. Sentiremos sua falta! 😔');
  setTimeout(() => initDashboard(), 1000);
};

// Mostra/esconde botão cancelar baseado no plano
function atualizarBotaoCancelar(estab) {
  const wrap = document.getElementById('cancelar-plano-wrap');
  if (wrap) wrap.style.display = (estab?.plano && estab.plano !== 'basico') ? 'block' : 'none';
}





// ═══════════════════════════════════════════════════════════
// SISTEMA DE ADICIONAIS (comanda garçom + cardápio)
// ═══════════════════════════════════════════════════════════
let _adicionalProduto   = null; // produto sendo configurado
let _adicionalSel       = {};   // { grupoIdx: [opcaoIdx, ...] }
let _adicionalMesaKey   = null;

window.fecharAdicionais = function() {
  document.getElementById('modal-adicionais')?.classList.remove('open');
  document.body.style.overflow = '';
  _adicionalProduto = null;
  _adicionalSel = {};
};

// Chamada quando produto tem adicionais
window.abrirAdicionais = function(mesaKey, prodJSON) {
  const prod = JSON.parse(decodeURIComponent(prodJSON));
  _adicionalProduto = prod;
  _adicionalMesaKey = mesaKey;
  _adicionalSel     = {};

  document.getElementById('adicionais-nome').textContent  = prod.nome;
  document.getElementById('adicionais-preco-base').textContent = 'R$ ' + Number(prod.preco).toFixed(2).replace('.',',');

  const grupos = Array.isArray(prod.adicionais) ? prod.adicionais : [];
  const el = document.getElementById('adicionais-grupos');
  if (!el) return;

  el.innerHTML = grupos.map((g, gi) => {
    const maxTxt = g.max === 1 ? 'Escolha 1' : g.min > 0 ? `Mín. ${g.min}, Máx. ${g.max}` : `Até ${g.max}`;
    const obrig  = g.min > 0;
    return `<div class="adicional-grupo">
      <div class="adicional-grupo-titulo">${g.grupo} ${obrig?'<span style="color:var(--red);font-size:.65rem">*obrigatório</span>':''}</div>
      <div class="adicional-grupo-desc">${maxTxt}</div>
      ${g.opcoes.map((o, oi) => `
        <div class="adicional-opt" id="aopt-${gi}-${oi}" onclick="toggleAdicional(${gi},${oi},${g.max})">
          <div class="adicional-opt-left">
            <div class="adicional-opt-check">✓</div>
            <span class="adicional-opt-nome">${o.nome}</span>
          </div>
          <span class="adicional-opt-preco">${Number(o.preco||0) > 0 ? '+R$ '+Number(o.preco).toFixed(2).replace('.',',') : 'Grátis'}</span>
        </div>`).join('')}
      <div class="adicional-limite-aviso" id="aviso-${gi}">Limite de ${g.max} opções atingido</div>
    </div>`;
  }).join('');

  calcTotalAdicionais();
  document.getElementById('modal-adicionais')?.classList.add('open');
};

window.toggleAdicional = function(gi, oi, max) {
  if (!_adicionalSel[gi]) _adicionalSel[gi] = [];
  const sel = _adicionalSel[gi];
  const idx = sel.indexOf(oi);

  if (idx >= 0) {
    // Deseleciona
    sel.splice(idx, 1);
    document.getElementById('aopt-'+gi+'-'+oi)?.classList.remove('sel');
  } else {
    if (sel.length >= max) {
      // Atingiu limite
      document.getElementById('aviso-'+gi)?.classList.add('show');
      setTimeout(()=>document.getElementById('aviso-'+gi)?.classList.remove('show'), 2000);
      return;
    }
    sel.push(oi);
    document.getElementById('aopt-'+gi+'-'+oi)?.classList.add('sel');
  }
  calcTotalAdicionais();
};

function calcTotalAdicionais() {
  if (!_adicionalProduto) return;
  const grupos = Array.isArray(_adicionalProduto.adicionais) ? _adicionalProduto.adicionais : [];
  let extra = 0;
  Object.entries(_adicionalSel).forEach(([gi, ois]) => {
    ois.forEach(oi => {
      extra += Number(grupos[gi]?.opcoes?.[oi]?.preco || 0);
    });
  });
  const total = Number(_adicionalProduto.preco) + extra;
  const el = document.getElementById('adicionais-total');
  if (el) el.textContent = 'R$ ' + total.toFixed(2).replace('.',',');
}

window.confirmarAdicionais = function() {
  if (!_adicionalProduto || !_adicionalMesaKey) return;
  const grupos  = Array.isArray(_adicionalProduto.adicionais) ? _adicionalProduto.adicionais : [];

  // Valida obrigatórios
  for (let gi = 0; gi < grupos.length; gi++) {
    const g = grupos[gi];
    const qtdSel = (_adicionalSel[gi]||[]).length;
    if (g.min > 0 && qtdSel < g.min) {
      showToast('Escolha pelo menos ' + g.min + ' opção em "' + g.grupo + '"', 'error');
      return;
    }
  }

  // Monta descrição dos adicionais selecionados
  const descAdic = [];
  Object.entries(_adicionalSel).forEach(([gi, ois]) => {
    ois.forEach(oi => descAdic.push(grupos[gi]?.opcoes?.[oi]?.nome));
  });
  let extra = 0;
  Object.entries(_adicionalSel).forEach(([gi, ois]) => {
    ois.forEach(oi => { extra += Number(grupos[gi]?.opcoes?.[oi]?.preco || 0); });
  });

  const nomeCompleto = descAdic.length ? _adicionalProduto.nome + ' (' + descAdic.join(', ') + ')' : _adicionalProduto.nome;
  const precoFinal   = Number(_adicionalProduto.preco) + extra;

  addItemComanda(_adicionalMesaKey, _adicionalProduto.id + '_' + Date.now(), nomeCompleto, precoFinal, _adicionalProduto.emoji||'🍽️');
  window.fecharAdicionais();
  showToast('Adicionado! ✅');
};

// ── Imprimir comanda da mesa ──────────────────────────────────────────────────
window.imprimirComanda = function() {
  if (!_mesaAtual) return;
  const estab = getEstab();
  const peds  = _pedidosMesas[_mesaAtual] || [];
  const nome  = _nomeComanda[_mesaAtual] || _mesaAtual;
  const fmtR  = v => 'R$ ' + Number(v||0).toFixed(2).replace('.',',');
  const total = peds.reduce((s,p)=>s+Number(p.total||0),0);
  const agora = new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

  const pedRows = peds.map((p,idx)=>{
    const itens = Array.isArray(p.itens)?p.itens:[];
    const dt    = new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return '<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #ddd">'
      + '<div style="font-size:10px;color:#888;margin-bottom:4px">Pedido '+(idx+1)+' · '+dt+'</div>'
      + itens.map(i=>'<div style="display:flex;justify-content:space-between;font-size:11px;padding:1px 0"><span>'+i.qtd+'x '+i.nome+'</span><span>'+fmtR((i.preco||0)*(i.qtd||1))+'</span></div>').join('')
      + '<div style="text-align:right;font-size:11px;color:#C0392B;font-weight:700;margin-top:2px">'+fmtR(p.total)+'</div>'
      + '</div>';
  }).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Comanda — ${_mesaAtual}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:12px;padding:16px;max-width:300px;margin:0 auto}
      .logo{font-size:16px;font-weight:900;text-align:center;margin-bottom:4px}
      .logo span{color:#C0392B}
      .loja{font-size:11px;text-align:center;color:#888;margin-bottom:8px}
      .divider{border:none;border-top:2px dashed #ddd;margin:8px 0}
      .mesa{font-size:14px;font-weight:800;text-align:center;margin:6px 0}
      .cliente{font-size:11px;text-align:center;color:#888;margin-bottom:8px}
      .total-row{display:flex;justify-content:space-between;font-size:14px;font-weight:800;margin-top:8px;border-top:2px solid #1a1a1a;padding-top:8px}
      .rodape{text-align:center;font-size:9px;color:#aaa;margin-top:12px}
      @media print{body{padding:0}}
    </style></head><body>
    <div class="logo">PEDI<span>WAY</span></div>
    <div class="loja">${estab?.nome||'Estabelecimento'}</div>
    <hr class="divider">
    <div class="mesa">${_mesaAtual}</div>
    <div class="cliente">${nome !== _mesaAtual ? 'Cliente: '+nome : ''}</div>
    <div style="font-size:9px;text-align:center;color:#aaa;margin-bottom:8px">${agora}</div>
    <hr class="divider">
    ${pedRows}
    <div class="total-row"><span>TOTAL</span><span style="color:#C0392B">${fmtR(total)}</span></div>
    <div class="rodape">Obrigado pela preferência!<br>Feito com PEDIWAY</div>
  </body></html>`;

  const w = window.open('','_blank','width=320,height=600');
  if (!w) { alert('Permita pop-ups para imprimir.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(), 400);
};


// ═══════════════════════════════════════════════════════════════════════════════
// GRUPOS DE ADICIONAIS — SISTEMA SEPARADO
// ═══════════════════════════════════════════════════════════════════════════════
let _gruposAdicionais = [];  // grupos do estabelecimento
let _produtosCache    = [];  // produtos para vincular
let _grupoEditando    = null; // grupo em edição (null = novo)
let _opcoesTmp        = [];  // opções do grupo sendo editado

// ── Abre gerenciador de grupos ──────────────────────────────────────────────────
window.abrirGerenciadorAdicionais = async function() {
  document.getElementById('modal-gerenciador-add').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  await carregarGruposAdicionais();
};

window.fecharGerenciadorAdicionais = function() {
  document.getElementById('modal-gerenciador-add').style.display = 'none';
  document.body.style.overflow = '';
};

async function carregarGruposAdicionais() {
  const estab = getEstab(); if (!estab) return;
  const el = document.getElementById('ger-add-lista'); if (!el) return;

  const { data: grupos } = await getSupa()
    .from('grupos_adicionais')
    .select('*')
    .eq('estabelecimento_id', estab.id)
    .order('created_at', { ascending: true });

  _gruposAdicionais = grupos || [];

  const { data: prods } = await getSupa()
    .from('produtos').select('id, nome, emoji, grupo_adicional_id')
    .eq('estabelecimento_id', estab.id);
  _produtosCache = prods || [];

  if (!_gruposAdicionais.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#aaa">
      <div style="font-size:2rem;margin-bottom:10px">🧩</div>
      <div style="font-size:.88rem;font-weight:600;margin-bottom:4px">Nenhum grupo criado</div>
      <div style="font-size:.78rem">Crie grupos como "Complementos Açaí" e vincule aos produtos</div>
    </div>`;
    return;
  }

  el.innerHTML = _gruposAdicionais.map(g => {
    const prodsV = _produtosCache.filter(p => p.grupo_adicional_id === g.id);
    const opcStr = (g.opcoes||[]).slice(0,3).map(o=>o.nome).join(', ') + ((g.opcoes||[]).length>3?'…':'');
    const prodsHtml = prodsV.length
      ? prodsV.map(p=>`<span style="background:#f0e9e0;padding:2px 8px;border-radius:50px;font-size:.68rem;font-weight:600">${p.emoji||'🍽️'} ${p.nome}</span>`).join('')
      : '<span style="font-size:.68rem;color:#ccc">Nenhum produto vinculado</span>';
    return `<div style="border:1.5px solid #e0dbd5;border-radius:14px;padding:14px;margin-bottom:10px;background:#fff">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
        <div>
          <div style="font-size:.92rem;font-weight:800">${g.nome}</div>
          <div style="font-size:.68rem;color:#aaa;margin-top:2px">Mín. ${g.min} · Máx. ${g.max} · ${(g.opcoes||[]).length} opções</div>
          <div style="font-size:.72rem;color:#888;margin-top:2px">${opcStr}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="editarGrupoAdicional('${g.id}')" style="padding:6px 10px;border:1.5px solid #e0dbd5;background:#fff;border-radius:8px;font-size:.72rem;font-weight:600;cursor:pointer">✏️ Editar</button>
          <button onclick="deletarGrupoAdicional('${g.id}')" style="padding:6px 10px;border:1.5px solid #fee2e2;background:#fff;border-radius:8px;font-size:.72rem;font-weight:600;cursor:pointer;color:#ef4444">🗑️</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">${prodsHtml}</div>
    </div>`;
  }).join('');
}


// ── Criar/Editar grupo ─────────────────────────────────────────────────────────
window.criarNovoGrupoAdicional = function() {
  _grupoEditando = null;
  _opcoesTmp = [{ nome: '', preco: 0 }, { nome: '', preco: 0 }];
  document.getElementById('eger-titulo').textContent = 'Novo grupo de adicionais';
  document.getElementById('eger-nome').value = '';
  document.getElementById('eger-min').value  = '0';
  document.getElementById('eger-max').value  = '3';
  renderOpcoesTmp();
  renderProdutosVincular(null);
  document.getElementById('modal-editar-grupo-add').style.display = 'flex';
};

window.editarGrupoAdicional = async function(id) {
  const g = _gruposAdicionais.find(x => x.id === id);
  if (!g) return;
  _grupoEditando = g;
  _opcoesTmp     = JSON.parse(JSON.stringify(g.opcoes || []));
  document.getElementById('eger-titulo').textContent = 'Editar — ' + g.nome;
  document.getElementById('eger-nome').value = g.nome;
  document.getElementById('eger-min').value  = g.min;
  document.getElementById('eger-max').value  = g.max;
  renderOpcoesTmp();
  renderProdutosVincular(id);
  document.getElementById('modal-editar-grupo-add').style.display = 'flex';
};

window.fecharEditarGrupoAdd = function() {
  document.getElementById('modal-editar-grupo-add').style.display = 'none';
  _grupoEditando = null; _opcoesTmp = [];
};


function renderOpcoesTmp() {
  const el = document.getElementById('eger-opcoes'); if (!el) return;
  el.innerHTML = _opcoesTmp.map((o, i) => `
    <div style="display:flex;gap:8px;align-items:center">
      <input value="${o.nome||''}" placeholder="Nome da opção (ex: Ninho)"
        oninput="syncOpcao(${i},'nome',this.value)"
        style="flex:2;border:1.5px solid var(--border);border-radius:9px;padding:9px 12px;font-family:Poppins,sans-serif;font-size:.85rem;outline:none">
      <input type="number" value="${o.preco||0}" placeholder="R$" step="0.50" min="0"
        oninput="syncOpcao(${i},'preco',parseFloat(this.value)||0)"
        style="width:72px;border:1.5px solid var(--border);border-radius:9px;padding:9px 8px;font-family:Poppins,sans-serif;font-size:.85rem;outline:none;text-align:right">
      <button onclick="rmOpcao(${i})" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:1rem;padding:4px;flex-shrink:0">✕</button>
    </div>`).join('');
}


window.syncOpcao = function(i, campo, val) { if (_opcoesTmp[i]) _opcoesTmp[i][campo] = val; };
window.rmOpcao   = function(i) { _opcoesTmp.splice(i,1); renderOpcoesTmp(); };
window.addOpcaoGrupo = function() { _opcoesTmp.push({nome:'',preco:0}); renderOpcoesTmp(); };

function renderProdutosVincular(grupoId) {
  const el = document.getElementById('eger-produtos'); if (!el) return;
  if (!_produtosCache.length) { el.innerHTML = '<div style="color:#aaa;font-size:.8rem">Nenhum produto cadastrado</div>'; return; }
  el.innerHTML = _produtosCache.map(p => {
    const vinculado = p.grupo_adicional_id === grupoId;
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ' + (vinculado?'var(--red)':'#e0dbd5') + ';border-radius:10px;cursor:pointer;transition:all .15s;background:' + (vinculado?'#fff5f5':'#fff') + '">'
      + '<input type="checkbox" id="vp-' + p.id + '" ' + (vinculado?'checked':'') + ' style="accent-color:var(--red);width:18px;height:18px">'
      + '<span style="font-size:.88rem;font-weight:600">' + (p.emoji||'🍽️') + ' ' + p.nome + '</span>'
      + '</label>';
  }).join('');
}

window.salvarGrupoAdicional = async function() {
  const estab = getEstab(); if (!estab) return;
  const nome = document.getElementById('eger-nome')?.value?.trim();
  const min  = parseInt(document.getElementById('eger-min')?.value||'0');
  const max  = parseInt(document.getElementById('eger-max')?.value||'3');
  if (!nome) return showToast('Digite o nome do grupo.', 'error');

  const opcoes = _opcoesTmp.filter(o => o.nome?.trim());
  if (!opcoes.length) return showToast('Adicione pelo menos uma opção.', 'error');

  const btn = document.getElementById('btn-salvar-grupo');
  if (btn) { btn.disabled=true; btn.textContent='Salvando...'; }

  try {
    let grupoId;
    if (_grupoEditando) {
      const { error } = await getSupa().from('grupos_adicionais')
        .update({ nome, min, max, opcoes })
        .eq('id', _grupoEditando.id);
      if (error) throw error;
      grupoId = _grupoEditando.id;
    } else {
      const { data, error } = await getSupa().from('grupos_adicionais')
        .insert({ estabelecimento_id: estab.id, nome, min, max, opcoes })
        .select().single();
      if (error) throw error;
      grupoId = data.id;
    }

    // Atualiza vinculações dos produtos
    const checks = document.querySelectorAll('#eger-produtos input[type=checkbox]');
    for (const cb of checks) {
      const prodId  = cb.id.replace('vp-','');
      const marcado = cb.checked;
      const prod    = _produtosCache.find(p=>p.id===prodId);
      if (!prod) continue;
      const novoGrupo = marcado ? grupoId : (prod.grupo_adicional_id===grupoId ? null : prod.grupo_adicional_id);
      if (novoGrupo !== prod.grupo_adicional_id) {
        await getSupa().from('produtos').update({ grupo_adicional_id: novoGrupo }).eq('id', prodId);
      }
    }

    showToast('Grupo salvo! ✅');
    window.fecharEditarGrupoAdd();
    await carregarGruposAdicionais();
    _cardapioCache = null; // limpa cache para recarregar adicionais

  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Salvar grupo'; }
  }
};

window.deletarGrupoAdicional = async function(id) {
  if (!confirm('Remover este grupo? Os produtos vinculados perderão os adicionais.')) return;
  await getSupa().from('grupos_adicionais').delete().eq('id', id);
  showToast('Grupo removido.');
  await carregarGruposAdicionais();
  _cardapioCache = null;
};


// ── Handler de clique em item do cardápio da comanda ─────────────────────────
window.tcmdItem = function(el) {
  // Na comanda do garçom, sempre adiciona direto sem modal de adicionais
  const item    = el.closest ? el.closest('[data-mesa]') : el;
  if (!item) return;

  const mesaKey = item.dataset.mesa;
  const pid     = item.dataset.pid;
  const nome    = item.dataset.nome;
  const preco   = parseFloat(item.dataset.preco);
  const emoji   = item.dataset.emoji || '🍽️';

  if (!mesaKey || !pid) return;
  addItemComanda(mesaKey, pid, nome, preco, emoji);
};

function abrirAdicionaisGrupo(mesaKey, prodId, nome, preco, emoji, grupo) {
  _adicionalMesaKey = mesaKey;
  _adicionalProduto = { id: prodId, nome, preco, emoji, adicionais: [grupo] };
  _adicionalSel     = {};

  document.getElementById('adicionais-nome').textContent       = nome;
  document.getElementById('adicionais-preco-base').textContent = 'R$ ' + Number(preco).toFixed(2).replace('.',',');

  const el = document.getElementById('adicionais-grupos'); if (!el) return;
  const maxTxt = grupo.max === 1 ? 'Escolha 1' : grupo.min > 0 ? 'Mín. '+grupo.min+', Máx. '+grupo.max : 'Até '+grupo.max;
  el.innerHTML = '<div class="adicional-grupo">'
    + '<div class="adicional-grupo-titulo">' + grupo.nome + (grupo.min > 0 ? ' <span style="color:var(--red);font-size:.65rem">*obrigatório</span>' : '') + '</div>'
    + '<div class="adicional-grupo-desc">' + maxTxt + '</div>'
    + (grupo.opcoes||[]).map((o, oi) =>
        '<div class="adicional-opt" id="aopt-0-' + oi + '" onclick="toggleAdicional(0,' + oi + ',' + grupo.max + ')">'
        + '<div class="adicional-opt-left"><div class="adicional-opt-check">✓</div><span class="adicional-opt-nome">' + o.nome + '</span></div>'
        + '<span class="adicional-opt-preco">' + (Number(o.preco||0)>0 ? '+R$ '+Number(o.preco).toFixed(2).replace('.',',') : 'Grátis') + '</span>'
        + '</div>'
      ).join('')
    + '<div class="adicional-limite-aviso" id="aviso-0">Limite de ' + grupo.max + ' opções</div>'
    + '</div>';

  calcTotalAdicionais();
  document.getElementById('modal-adicionais')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}


window.copiarLinkGarcom = function() {
  const estab = getEstab(); if (!estab) return;
  const url = `${BASE_URL}/comandas/${estab.slug}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copiado! ✅');
  }).catch(() => {
    // fallback
    const el = document.createElement('input');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Link copiado! ✅');
  });
};


// ── Histórico de pedidos das mesas (aba Comandas) ────────────────────────────
// Chamável pelo botão de atualizar no HTML
window.renderHistoricoMesas = async function() {
  const estab = getEstab(); if (!estab) return;
  const lista = document.getElementById('mesas-historico-lista');
  if (!lista) return;

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const { data } = await getSupa().from('pedidos').select('*')
    .eq('estabelecimento_id', estab.id)
    .ilike('endereco', 'No local%')
    .neq('status', 'recusado')
    .gte('created_at', hoje.toISOString())
    .order('created_at', { ascending: false });

  if (!data?.length) {
    lista.innerHTML = '<div style="color:#aaa;font-size:.82rem;text-align:center;padding:32px">Nenhum pedido de mesa hoje</div>';
    return;
  }

  const fmtR = v => 'R$ ' + Number(v||0).toFixed(2).replace('.',',');
  const stCor = { novo:'#f59e0b', preparo:'#3b82f6', pronto:'#22c55e' };
  const stLbl = { novo:'⏳ Aguardando', preparo:'🍳 Preparando', pronto:'✅ Pronto' };

  // Agrupa por mesa
  const porMesa = {};
  data.forEach(p => {
    const parts = (p.endereco||'').split('—');
    const mesa  = parts.length >= 2 ? parts[1].trim() : 'Mesa';
    if (!porMesa[mesa]) porMesa[mesa] = [];
    porMesa[mesa].push(p);
  });

  lista.innerHTML = Object.entries(porMesa).map(([mesa, peds]) => {
    const num       = mesa.replace('Mesa ','');
    const ativos    = peds.filter(p => ['novo','preparo'].includes(p.status));
    const prontos   = peds.filter(p => p.status === 'pronto');
    const temAtivo  = ativos.length > 0;
    // Total = só pedidos ativos (mesa aberta). Histórico tem o total completo separado.
    const totalMesa = ativos.reduce((s,p) => s+Number(p.total||0), 0);
    const mesaId    = 'hmesa-' + mesa.replace(/\s/g,'');

    // Cards de pedidos ativos
    const ativosHtml = ativos.map(p => _cardPedidoMesa(p, mesa, fmtR, stCor, stLbl)).join('');

    // Cards de pedidos histórico (prontos)
    const histHtml = prontos.length ? `
      <div style="margin-top:10px">
        <button onclick="toggleHistMesa('${mesaId}-hist')" style="width:100%;display:flex;align-items:center;justify-content:between;gap:8px;background:#f5f0eb;border:1.5px dashed #d4c4b0;border-radius:8px;padding:8px 12px;font-family:'Poppins',sans-serif;font-size:.75rem;font-weight:700;color:#888;cursor:pointer">
          <span style="flex:1;text-align:left">📋 Histórico de pedidos (${prontos.length})</span>
          <span id="${mesaId}-hist-arrow">▼</span>
        </button>
        <div id="${mesaId}-hist" style="display:none;margin-top:8px">
          ${prontos.map(p => _cardPedidoMesa(p, mesa, fmtR, stCor, stLbl)).join('')}
        </div>
      </div>` : '';

    // Conteúdo expandível
    const conteudo = `
      <div id="${mesaId}" style="display:none;padding:10px 0 4px">
        ${ativosHtml || '<div style="color:#aaa;font-size:.8rem;padding:8px 0">Nenhum pedido ativo</div>'}
        ${histHtml}
      </div>`;

    return `<div style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;padding:13px 16px;background:#fff;border:1.5px solid ${temAtivo?'#16a34a':'#e0dbd5'};border-radius:12px;cursor:pointer" onclick="togglePedidosMesa('${mesaId}')">
        <div style="width:42px;height:42px;border-radius:10px;background:${temAtivo?'#16a34a':'#e0dbd5'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;flex-shrink:0">${num}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.95rem;font-weight:800">${mesa}</div>
          <div style="font-size:.72rem;margin-top:1px">
            <span style="color:#888">${peds.length} pedido${peds.length!==1?'s':''}</span>
            ${temAtivo
              ? `<span style="color:var(--red);font-weight:700;margin-left:6px">● ativa</span>`
              : `<span style="color:#22c55e;font-weight:700;margin-left:6px">✓ encerrada</span>`}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.88rem;font-weight:800;color:var(--red)">${temAtivo ? fmtR(totalMesa) : 'R$ 0,00'}</div>
          <button id="${mesaId}-btn" style="margin-top:4px;background:none;border:1.5px solid var(--border);border-radius:8px;padding:5px 12px;font-family:'Poppins',sans-serif;font-size:.72rem;font-weight:700;color:#555;cursor:pointer;white-space:nowrap">Ver pedidos ▼</button>
        </div>
      </div>
      <div style="padding:0 6px">
        ${conteudo}
      </div>
    </div>`;
  }).join('');
};

// Função auxiliar — card de pedido individual
function _cardPedidoMesa(p, mesa, fmtR, stCor, stLbl) {
  const itens   = Array.isArray(p.itens) ? p.itens : [];
  const dt      = new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const nome    = (p.cliente_nome && p.cliente_nome !== mesa) ? p.cliente_nome : '';
  const enviado = getEnviadosCozinha().has(p.id);

  // Cor da borda: vermelho = não foi pra cozinha, verde = foi pra cozinha, cinza = pronto/outro
  const bordaCor = p.status === 'pronto' ? '#aaa'
    : enviado ? '#16a34a'
    : '#C0392B';

  // Badge de status — destaque visual forte
  const stBadge = {
    novo:    { bg:'#fef3c7', cor:'#92400e', icon:'🔔', txt:'Aguardando' },
    preparo: { bg:'#dbeafe', cor:'#1d4ed8', icon:'🍳', txt:'Preparando' },
    pronto:  { bg:'#dcfce7', cor:'#15803d', icon:'✅', txt:'Pronto'     },
  }[p.status] || { bg:'#f3f4f6', cor:'#555', icon:'', txt: p.status };

  return `<div style="background:#fff;border:1.5px solid #f0e9e0;border-left:5px solid ${bordaCor};border-radius:10px;padding:12px;margin-bottom:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
        ${nome ? `<span style="background:#f0e9e0;padding:3px 10px;border-radius:50px;font-size:.78rem;font-weight:700;color:#555">${nome}</span>` : ''}
        <span style="font-size:.68rem;color:#aaa">#${p.id.slice(-4).toUpperCase()} · ${dt}</span>
      </div>
      <!-- Status badge bem destacado -->
      <span style="display:inline-flex;align-items:center;gap:4px;background:${stBadge.bg};color:${stBadge.cor};padding:5px 12px;border-radius:50px;font-size:.75rem;font-weight:800;flex-shrink:0;white-space:nowrap;letter-spacing:.01em">
        ${stBadge.icon} ${stBadge.txt}
      </span>
    </div>

    <!-- Indicador cozinha inline -->
    ${p.status !== 'pronto' ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:5px 10px;border-radius:8px;background:${enviado?'#f0fdf4':'#fff5f5'};border:1px solid ${enviado?'#bbf7d0':'#fecaca'}">
      <span style="font-size:.75rem">${enviado ? '✅' : '⏳'}</span>
      <span style="font-size:.72rem;font-weight:700;color:${enviado?'#15803d':'#C0392B'}">${enviado ? 'Enviado para a cozinha' : 'Aguardando envio para cozinha'}</span>
    </div>` : ''}

    <!-- Itens -->
    <div style="background:#faf8f5;border-radius:8px;padding:8px 10px;margin-bottom:10px">
      ${itens.map(i=>`<div style="display:flex;justify-content:space-between;font-size:.83rem;padding:2px 0"><span style="font-weight:600">${i.qtd||1}x ${i.nome}</span><span style="color:#888">R$ ${((i.preco||0)*(i.qtd||1)).toFixed(2).replace('.',',')}</span></div>`).join('')}
      <div style="text-align:right;font-size:.9rem;font-weight:800;color:var(--red);margin-top:6px;border-top:1px solid #f0e9e0;padding-top:6px">${fmtR(p.total)}</div>
    </div>

    <!-- Ações -->
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${p.status==='novo' ? `<button class="btn-ped-aceitar" style="padding:7px 12px;font-size:.75rem" onclick="aceitarPedido('${p.id}')">Aceitar</button>
      <button class="btn-ped-recusar" style="padding:7px 10px;font-size:.75rem" onclick="recusarPedido('${p.id}')">Recusar</button>` : ''}
      ${p.status !== 'pronto' ? `<button class="btn-ped-imprimir" style="font-size:.75rem;background:${enviado?'#f0fdf4':'#fff5f5'};border:1.5px solid ${enviado?'#16a34a':'#C0392B'};color:${enviado?'#16a34a':'#C0392B'};font-weight:700" onclick="imprimirCozinha('${p.id}')">
        ${enviado ? '✓ Reenviado' : '🖨️ Enviar cozinha'}
      </button>` : ''}
      <button class="btn-ped-imprimir" style="font-size:.75rem" onclick="verPedido('${p.id}')">Ver mais</button>
    </div>
  </div>`;
}

// Expande/colapsa lista de pedidos de uma mesa
window.togglePedidosMesa = function(id) {
  const el   = document.getElementById(id);
  const btn  = document.getElementById(id + '-btn');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display  = open ? 'none' : 'block';
  if (btn) btn.innerHTML = open ? 'Ver pedidos ▼' : 'Ocultar ▲';
};

// Expande/colapsa histórico (prontos) de uma mesa
window.toggleHistMesa = function(id) {
  const el  = document.getElementById(id);
  const arr = document.getElementById(id + '-arrow');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (arr) arr.textContent = open ? '▼' : '▲';
};





// ── Controle de "enviado para cozinha" ──────────────────────────────────────
const _COZINHA_KEY = 'pw_enviados_cozinha';

function getEnviadosCozinha() {
  try { return new Set(JSON.parse(localStorage.getItem(_COZINHA_KEY)||'[]')); }
  catch(e) { return new Set(); }
}

function marcarEnviadoCozinha(pedidoId) {
  const set = getEnviadosCozinha();
  set.add(pedidoId);
  // Limpa IDs antigos (mais de 24h) — mantém localStorage limpo
  localStorage.setItem(_COZINHA_KEY, JSON.stringify([...set]));
}

// ── Imprimir ticket de cozinha (pedido individual) ────────────────────────────
window.imprimirCozinha = function(pedidoId) {
  getSupa().from('pedidos').select('*').eq('id', pedidoId).maybeSingle().then(({ data: p }) => {
    if (!p) return;
    const itens   = Array.isArray(p.itens) ? p.itens : [];
    const parts   = (p.endereco||'').split('—');
    const mesa    = parts.length >= 2 ? parts[1].trim() : p.endereco || '—';
    const nome    = (p.cliente_nome && p.cliente_nome !== mesa) ? p.cliente_nome : '';
    const dt      = new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const loja    = getEstab()?.nome || 'Estabelecimento';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>🍳 Cozinha</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Arial Black', Arial, sans-serif; font-size:16px; padding:20px 16px; max-width:360px; margin:0 auto; background:#fff; }
        .logo { font-size:22px; font-weight:900; text-align:center; letter-spacing:.05em; margin-bottom:3px; }
        .logo span { color:#C0392B; }
        .empresa { font-size:14px; font-weight:700; text-align:center; color:#333; margin-bottom:3px; }
        .tag { font-size:11px; text-align:center; color:#999; text-transform:uppercase; letter-spacing:.1em; margin-bottom:12px; }
        hr { border:none; border-top:2px dashed #ccc; margin:12px 0; }
        hr.bold { border-top:3px solid #000; }
        .mesa-box { text-align:center; background:#000; color:#fff; border-radius:12px; padding:14px 0 10px; margin:12px 0; }
        .mesa-lbl { font-size:12px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; color:#aaa; margin-bottom:4px; }
        .mesa-num { font-size:52px; font-weight:900; line-height:1; }
        .mesa-nome { font-size:14px; color:#ddd; margin-top:4px; font-weight:600; }
        .hora { font-size:12px; text-align:center; color:#888; margin-bottom:12px; }
        .item { display:flex; align-items:baseline; gap:10px; font-size:18px; font-weight:900; padding:8px 0; border-bottom:1px solid #eee; }
        .item-qtd { font-size:22px; color:#C0392B; min-width:32px; flex-shrink:0; }
        .item-nome { flex:1; line-height:1.3; }
        .footer { text-align:center; font-size:11px; color:#bbb; margin-top:14px; letter-spacing:.05em; }
        @media print { body { padding:10px 8px; } }
      </style></head><body>
      <div class="logo">PEDI<span>WAY</span></div>
      <div class="empresa">${loja}</div>
      <div class="tag">🍳 Ticket de Cozinha</div>
      <hr>
      <div class="mesa-box">
        <div class="mesa-lbl">Mesa</div>
        <div class="mesa-num">${mesa.replace('Mesa ','')}</div>
        ${nome ? `<div class="mesa-nome">${nome}</div>` : ''}
      </div>
      <div class="hora">#${p.id.slice(-4).toUpperCase()} · ${dt}</div>
      <hr class="bold">
      ${itens.map(i=>`<div class="item"><span class="item-qtd">${i.qtd||1}x</span><span class="item-nome">${i.nome}</span></div>`).join('')}
      <hr>
      <div class="footer">PEDIWAY — Sistema de Gestão</div>
    </body></html>`;
    const w = window.open('','_blank','width=380,height=640');
    if (!w) { alert('Permita pop-ups.'); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(()=>w.print(), 350);

    // Marca como enviado para cozinha e atualiza UI imediatamente
    marcarEnviadoCozinha(pedidoId);
    window.renderHistoricoMesas();
  });
};

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

// ── Financeiro do estabelecimento ─────────────────────────
window.setFinPeriodo = setFinPeriodo;
window.exportarCSV   = exportarCSV;
window.exportarPDF   = exportarPDF;

// ═══════════════════════════════════════════════════════════
// SISTEMA DE COMANDAS — MODO GARÇOM
// ═══════════════════════════════════════════════════════════
let _mesaAtual        = null;   // chave da mesa aberta "Mesa 3"
let _pedidosMesas     = {};     // { "Mesa 3": [{...pedido}] }
let _mesasFechadas    = new Set();
let _cardapioCache    = null;   // cache dos produtos para seleção rápida
let _carrinhoComanda  = {};     // { "Mesa 3": [{nome, preco, qtd, emoji}] }
let _nomeComanda      = {};     // { "Mesa 3": "João" }

function getNumMesas() {
  const estab = getEstab();
  // Prioridade: 1) banco (num_mesas no estab) 2) localStorage 3) padrão 10
  const doLocalStorage = localStorage.getItem('pw_num_mesas_' + (estab?.id || ''));
  return parseInt(estab?.num_mesas || doLocalStorage || '10', 10);
}

window.salvarNumMesas = async function(val) {
  const estab = getEstab(); if (!estab) return;
  const n = Math.max(1, Math.min(200, parseInt(val) || 10));

  // Atualiza o estab em memória IMEDIATAMENTE para renderMesas() pegar o valor novo
  estab.num_mesas = n;
  window._estab = { ...window._estab, num_mesas: n };
  const stored = JSON.parse(localStorage.getItem('pw_estab') || '{}');
  localStorage.setItem('pw_estab', JSON.stringify({ ...stored, num_mesas: n }));
  localStorage.setItem('pw_num_mesas_' + estab.id, String(n));

  // Atualiza o input visualmente com o valor normalizado
  const inp = document.getElementById('cfg-num-mesas');
  if (inp) inp.value = n;

  // Re-renderiza imediatamente
  renderMesas();

  // Salva no banco em background (não bloqueia)
  getSupa().from('estabelecimentos').update({ num_mesas: n }).eq('id', estab.id)
    .then(({ error }) => {
      if (error) console.error('[mesas] erro ao salvar:', error);
      else showToast(`${n} mesas configuradas ✅`);
    });
};

async function carregarPedidosMesas() {
  const estab = getEstab(); if (!estab) return;
  const { data } = await getSupa()
    .from('pedidos')
    .select('*')
    .eq('estabelecimento_id', estab.id)
    .ilike('endereco', 'No local%')
    .in('status', ['novo', 'preparo'])   // só pedidos ativos
    .order('created_at', { ascending: true });

  _pedidosMesas = {};
  (data || []).forEach(p => {
    const raw   = (p.endereco || '');
    const parts = raw.split('—');
    if (parts.length < 2) return;
    const mesa  = parts[1].trim();
    if (!_pedidosMesas[mesa]) _pedidosMesas[mesa] = [];
    _pedidosMesas[mesa].push(p);
  });
  renderMesas();
}

function renderMesas() {
  const grid = document.getElementById('mesas-grid'); if (!grid) return;
  const n    = getNumMesas();
  const inp  = document.getElementById('cfg-num-mesas');
  if (inp) inp.value = n;
  const fmt  = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

  // Atualiza cards de resumo
  const allPeds   = Object.values(_pedidosMesas).flat();
  const mOcup     = Object.keys(_pedidosMesas).filter(k => _pedidosMesas[k].length > 0).length;
  const totalAb   = allPeds.reduce((s, p) => s + Number(p.total || 0), 0);
  const elOcup    = document.getElementById('mesas-ocupadas-count');
  const elPeds    = document.getElementById('mesas-pedidos-count');
  const elTotal   = document.getElementById('mesas-total-count');
  if (elOcup)  elOcup.textContent  = mOcup;
  if (elPeds)  elPeds.textContent  = allPeds.length;
  if (elTotal) elTotal.textContent = fmt(totalAb);

  // Pedidos novos aguardando nas mesas (área de destaque)
  const novosM     = allPeds.filter(p => p.status === 'novo');
  const wrapNovos  = document.getElementById('mesas-pedidos-novos-wrap');
  const listaNovos = document.getElementById('mesas-pedidos-novos-lista');
  const badgeNovos = document.getElementById('badge-mesas-novos');
  if (wrapNovos)  wrapNovos.style.display  = novosM.length ? 'block' : 'none';
  if (badgeNovos) badgeNovos.textContent   = novosM.length;
  if (listaNovos && novosM.length) {
    listaNovos.innerHTML = novosM.map(p => {
      const itens = Array.isArray(p.itens) ? p.itens.map(i => `${i.qtd}x ${i.nome}`).join(' · ') : '';
      const parts = (p.endereco||'').split('—');
      const mesa  = parts.length >= 2 ? parts[1].trim() : p.endereco || 'Mesa';
      const nome  = p.cliente_nome && p.cliente_nome !== mesa ? p.cliente_nome : '';
      const numMesa = mesa.replace('Mesa ','');
      return `<div style="background:#fff;border:2px solid var(--red);border-radius:14px;padding:14px 12px;display:flex;flex-direction:column;gap:8px;min-height:160px">
        <!-- Número da mesa destaque -->
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="width:46px;height:46px;background:var(--red);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:#fff">${numMesa}</div>
          <span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:50px;font-size:.65rem;font-weight:800">NOVO</span>
        </div>
        <!-- Nome e itens -->
        <div style="flex:1">
          <div style="font-size:.92rem;font-weight:800;color:#1a1a1a">${mesa}${nome ? ` <span style='font-size:.72rem;color:#888;font-weight:500'>${nome}</span>` : ''}</div>
          <div style="font-size:.72rem;color:#aaa;margin-top:3px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${itens}</div>
        </div>
        <!-- Valor e ações -->
        <div style="border-top:1px solid #f0e9e0;padding-top:8px">
          <div style="font-size:1rem;font-weight:800;color:var(--red);margin-bottom:6px">${fmt(p.total)}</div>
          <div style="display:flex;gap:5px">
            <button class="btn-ped-aceitar" style="flex:1;padding:6px;font-size:.72rem" onclick="aceitarPedido('${p.id}')">✓ Aceitar</button>
            <button class="btn-ped-recusar" style="padding:6px 8px;font-size:.72rem" onclick="recusarPedido('${p.id}')">✕</button>
            <button class="btn-ped-imprimir" style="padding:6px 8px;font-size:.72rem" onclick="imprimirCozinha('${p.id}')">🖨️</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  grid.innerHTML = Array.from({ length: n }, (_, i) => {
    const num    = i + 1;
    const key    = 'Mesa ' + num;
    const peds   = _pedidosMesas[key] || [];
    const ativa  = peds.length > 0;
    const fechada= _mesasFechadas.has(key);
    const total  = peds.reduce((s, p) => s + Number(p.total || 0), 0);
    const qtdIt  = peds.reduce((s, p) => s + (Array.isArray(p.itens) ? p.itens.reduce((a, i) => a + (i.qtd || 1), 0) : 0), 0);

    let cls = 'vazia', dot = 'livre', info = '<span class="mesa-label">Livre</span>';
    if (fechada) {
      cls  = 'fechando'; dot = '';
      info = '<span class="mesa-label" style="color:var(--red)">✗ Fechada</span>';
    } else if (ativa) {
      cls  = 'ocupada'; dot = 'ocup';
      info = '<span class="mesa-total">' + fmt(total) + '</span><span class="mesa-qtd">' + peds.length + ' ped · ' + qtdIt + ' itens</span>';
    }

    return '<div class="mesa-card ' + cls + '" onclick="abrirComanda(' + num + ')">' +
      '<div class="mesa-status-dot ' + dot + '"></div>' +
      '<div class="mesa-num">' + num + '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:3px">' + info + '</div>' +
      '</div>';
  }).join('');
}

// ── Carrega cardápio para seleção no modo garçom ──────────────────────────────
async function carregarCardapioComanda() {
  if (_cardapioCache) return _cardapioCache;
  const estab = getEstab(); if (!estab) return [];
  const { data } = await getSupa()
    .from('produtos').select('id,nome,preco,emoji,categoria,disponivel,grupo_adicional_id')
    .eq('estabelecimento_id', estab.id)
    .eq('disponivel', true)
    .order('categoria');
  
  // Enriquece com dados do grupo de adicionais
  if (data) {
    const grupoIds = [...new Set(data.filter(p=>p.grupo_adicional_id).map(p=>p.grupo_adicional_id))];
    if (grupoIds.length) {
      const { data: grupos } = await getSupa().from('grupos_adicionais').select('*').in('id', grupoIds);
      const grupoMap = {};
      (grupos||[]).forEach(g=>{ grupoMap[g.id]=g; });
      data.forEach(p=>{ if(p.grupo_adicional_id) p.adicionais_grupo = grupoMap[p.grupo_adicional_id]; });
    }
  }
  _cardapioCache = data || [];
  return _cardapioCache;
}

// ── Nome do cliente na mesa ──────────────────────────────────────────────────────
window.salvarNomeComanda = function(val) {
  if (_mesaAtual) _nomeComanda[_mesaAtual] = val.trim();
};

// ── Troca de tab dentro do modal ──────────────────────────────────────────────
window.switchComandaTab = function(tab) {
  document.querySelectorAll('.ctab').forEach(b => b.classList.remove('ativo'));
  document.getElementById('ctab-' + tab)?.classList.add('ativo');
  document.getElementById('cpanel-pedido').style.display = tab === 'pedido' ? 'flex' : 'none';
  document.getElementById('cpanel-hist').style.display   = tab === 'hist'   ? 'flex' : 'none';
};

// ── Adiciona item ao carrinho da mesa ──────────────────────────────────────────
function addItemComanda(mesaKey, id, nome, preco, emoji) {
  if (!_carrinhoComanda[mesaKey]) _carrinhoComanda[mesaKey] = [];
  const ex = _carrinhoComanda[mesaKey].find(x => x.id === id);
  if (ex) { ex.qtd++; } else { _carrinhoComanda[mesaKey].push({ id, nome, preco, emoji, qtd: 1 }); }
  renderCarrinhoComanda(mesaKey);
}
window.addItemComanda = addItemComanda;

function rmItemComanda(mesaKey, id) {
  if (!_carrinhoComanda[mesaKey]) return;
  const ex = _carrinhoComanda[mesaKey].find(x => x.id === id);
  if (!ex) return;
  if (ex.qtd > 1) { ex.qtd--; } else { _carrinhoComanda[mesaKey] = _carrinhoComanda[mesaKey].filter(x=>x.id!==id); }
  renderCarrinhoComanda(mesaKey);
}
window.rmItemComanda = rmItemComanda;

function renderCarrinhoComanda(mesaKey) {
  const carr = _carrinhoComanda[mesaKey] || [];
  const total = carr.reduce((s,i)=>s+i.preco*i.qtd, 0);
  const fmtR  = v=>'R$ '+Number(v).toFixed(2).replace('.',',');
  const el = document.getElementById('comanda-carrinho');
  const elTotal = document.getElementById('comanda-carr-total');
  const btnEnviar = document.getElementById('btn-enviar-comanda');
  if (!el) return;
  if (!carr.length) {
    el.innerHTML = '<div style="text-align:center;padding:12px 0;color:#ccc;font-size:.78rem">Nenhum item</div>';
    if (elTotal)   elTotal.textContent = 'R$ 0,00';
    if (btnEnviar) btnEnviar.disabled = true;
    return;
  }
  el.innerHTML = carr.map(i=>`
    <div class="carr-row">
      <span style="font-size:1.1rem;flex-shrink:0">${i.emoji||'🍽️'}</span>
      <span class="carr-nome">${i.nome}</span>
      <div class="carr-ctrl">
        <button class="carr-btn minus" onclick="rmItemComanda('${mesaKey}','${i.id}')">−</button>
        <span class="carr-qtd">${i.qtd}</span>
        <button class="carr-btn plus" onclick="addItemComanda('${mesaKey}','${i.id}','${i.nome.replace(/'/g,"\'")}',${i.preco},'${i.emoji||''}')">+</button>
      </div>
      <span class="carr-subtot">${fmtR(i.preco*i.qtd)}</span>
    </div>`).join('');
  if (elTotal)   elTotal.textContent = fmtR(total);
  if (btnEnviar) btnEnviar.disabled = false;
}

// ── Envia pedido da comanda para o banco ───────────────────────────────────────
window.enviarPedidoComanda = async function() {
  if (!_mesaAtual) return;
  const carr  = _carrinhoComanda[_mesaAtual] || [];
  if (!carr.length) return;
  const estab = getEstab(); if (!estab) return;
  const total = carr.reduce((s,i)=>s+i.preco*i.qtd, 0);
  const btn   = document.getElementById('btn-enviar-comanda');
  if (btn) { btn.disabled=true; btn.textContent='Enviando...'; }
  try {
    const nomeCliente = _nomeComanda[_mesaAtual] || _mesaAtual;
    const { error } = await getSupa().from('pedidos').insert({
      estabelecimento_id: estab.id,
      cliente_nome:       nomeCliente,
      cliente_whats:      '',
      endereco:           'No local — ' + _mesaAtual,
      itens:              carr.map(i=>({nome:i.nome,preco:i.preco,qtd:i.qtd,emoji:i.emoji})),
      total,
      status:             'novo',
      pagamento:          'No local',
    });
    if (error) throw error;
    _carrinhoComanda[_mesaAtual] = [];
    showToast('Pedido enviado para a cozinha! 🍽️');
    renderCarrinhoComanda(_mesaAtual);
    await carregarPedidosMesas();
    renderPedidosComanda(_mesaAtual);
  } catch(e) {
    showToast('Erro ao enviar: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Enviar para cozinha 🍳'; }
  }
};

// ── Abre painel da mesa (mode garçom) ─────────────────────────────────────────
async function abrirComanda(num) {
  const key  = 'Mesa ' + num;
  _mesaAtual = key;
  if (!_carrinhoComanda[key]) _carrinhoComanda[key] = [];

  const modal = document.getElementById('modal-comanda');
  const title = document.getElementById('comanda-title');
  if (title) title.textContent = key;

  // Número grande da mesa
  const numEl = document.getElementById('comanda-num-mesa');
  if (numEl) numEl.textContent = num;

  // Carrega cardápio
  const prods = await carregarCardapioComanda();
  renderCardapioComanda(key, prods);
  renderPedidosComanda(key);
  renderCarrinhoComanda(key);

  // Preenche nome salvo
  const nomeInput = document.getElementById('comanda-nome-cliente');
  if (nomeInput) nomeInput.value = _nomeComanda[key] || '';

  // Sempre abre na tab "Novo pedido"
  window.switchComandaTab('pedido');

  if (modal) modal.classList.add('open');
}

function renderCardapioComanda(mesaKey, prods) {
  const el = document.getElementById('comanda-cardapio');
  if (!el) return;
  if (!prods.length) {
    el.innerHTML = '<div style="color:#aaa;font-size:.8rem;text-align:center;padding:24px">Nenhum produto disponível</div>';
    return;
  }
  const cats = {};
  prods.forEach(p => {
    const cat = p.categoria || 'Outros';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(p);
  });

  el.innerHTML = Object.entries(cats).map(([cat, items]) => {
    const itemsHtml = items.map(p => {
      const nomeEnc  = p.nome.replace(/"/g, '&quot;');
      const precoFmt = Number(p.preco).toFixed(2).replace('.',',');
      return `<div class="cmd-item" onclick="tcmdItem(this)"
        data-pid="${p.id}"
        data-nome="${nomeEnc}"
        data-preco="${p.preco}"
        data-emoji="${p.emoji||'🍽️'}"
        data-mesa="${mesaKey}">
        <span class="cmd-item-emoji">${p.emoji||'🍽️'}</span>
        <span class="cmd-item-nome">${p.nome}</span>
        <span class="cmd-item-preco">R$ ${precoFmt}</span>
      </div>`;
    }).join('');
    return `<span class="cmd-cat-label">${cat}</span>${itemsHtml}`;
  }).join('');
}


function renderPedidosComanda(mesaKey) {
  const el   = document.getElementById('comanda-historico');
  const peds = _pedidosMesas[mesaKey] || [];
  const fmtR = v => 'R$ ' + Number(v||0).toFixed(2).replace('.',',');
  const stLbl = {novo:'⏳ Aguardando',preparo:'🍳 Preparando',pronto:'✅ Pronto'};
  const stClr = {novo:'#f59e0b',preparo:'#3b82f6',pronto:'#22c55e'};

  const totalMesa = peds.reduce((s,p)=>s+Number(p.total||0),0);
  const elTotal = document.getElementById('comanda-total-geral');
  if (elTotal) elTotal.textContent = fmtR(totalMesa);

  if (!el) return;
  if (!peds.length) { el.innerHTML='<div style="color:#aaa;font-size:.8rem;text-align:center;padding:12px">Nenhum pedido lançado</div>'; return; }

  // Agrupa por nome do cliente
  const grupos = {};
  peds.forEach(p => {
    const nm = p.cliente_nome || 'Cliente';
    if (!grupos[nm]) grupos[nm] = [];
    grupos[nm].push(p);
  });

  el.innerHTML = Object.entries(grupos).map(([nome, gpeds]) => {
    const subtotal = gpeds.reduce((s,p)=>s+Number(p.total||0),0);
    const inicial  = nome.charAt(0).toUpperCase();
    const pedRows  = gpeds.map(p => {
      const itens = Array.isArray(p.itens) ? p.itens : [];
      const dt    = new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      return '<div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed #f0e9e0">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
        +'<span style="font-size:.65rem;color:#aaa">'+dt+'</span>'
        +'<span style="font-size:.65rem;font-weight:700;color:'+stClr[p.status]+'">'+(stLbl[p.status]||p.status)+'</span>'
        +'</div>'
        +itens.map(i=>'<div style="display:flex;justify-content:space-between;font-size:.82rem"><span>'+(i.qtd||1)+'x '+i.nome+'</span><span>R$ '+((i.preco||0)*(i.qtd||1)).toFixed(2).replace('.',',')+'</span></div>').join('')
        +'</div>';
    }).join('');

    return '<div style="border:1.5px solid #f0e9e0;border-radius:10px;padding:10px;margin-bottom:10px;background:#fff">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #f0e9e0">'
      +'<div style="width:32px;height:32px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.9rem;flex-shrink:0">'+inicial+'</div>'
      +'<span style="font-size:.92rem;font-weight:800;flex:1">'+nome+'</span>'
      +'<span style="font-size:.85rem;font-weight:800;color:var(--red)">'+fmtR(subtotal)+'</span>'
      +'</div>'
      +pedRows
      +'</div>';
  }).join('');
}

window.fecharComanda = function() {
  const modal = document.getElementById('modal-comanda');
  if (modal) modal.classList.remove('open');
  _mesaAtual = null;
};

async function confirmarFecharComanda() {
  if (!_mesaAtual) return;
  const peds  = _pedidosMesas[_mesaAtual] || [];
  const fmt   = v => 'R$ ' + Number(v||0).toFixed(2).replace('.',',');
  const carr  = _carrinhoComanda[_mesaAtual] || [];
  const totalMesa = peds.reduce((s,p)=>s+Number(p.total||0),0);
  const mesaFechando = _mesaAtual;

  if (carr.length > 0) {
    if (!confirm('Há itens não enviados no carrinho. Deseja fechar mesmo assim?')) return;
  }

  // 1º — Abre a notinha para imprimir
  window.imprimirComanda();

  // 2º — Após pequeno delay (janela de impressão abre), pede confirmação
  setTimeout(async () => {
    if (!confirm(`Confirmar fechamento da ${mesaFechando}?\n\nTotal: ${fmt(totalMesa)}\nPedidos: ${peds.length}\n\nA mesa será liberada.`)) return;

    const ids = peds.map(p=>p.id);
    if (ids.length) await getSupa().from('pedidos').update({ status:'pronto' }).in('id', ids);

    delete _pedidosMesas[mesaFechando];
    delete _carrinhoComanda[mesaFechando];
    _mesasFechadas.add(mesaFechando);
    setTimeout(()=>{ _mesasFechadas.delete(mesaFechando); renderMesas(); }, 5000);

    window.fecharComanda();
    showToast('Comanda da ' + mesaFechando + ' fechada! ' + fmt(totalMesa));
    renderMesas();
    window.renderHistoricoMesas();
  }, 500);
}

// Exports das comandas — precisam estar em window para o onclick funcionar
window.abrirComanda           = abrirComanda;
window.confirmarFecharComanda = confirmarFecharComanda;
window.renderMesas            = renderMesas;
window.renderHistoricoMesas   = window.renderHistoricoMesas;
window.togglePedidosMesa      = window.togglePedidosMesa;
window.toggleHistMesa         = window.toggleHistMesa;
window.imprimirCozinha        = window.imprimirCozinha;
window.salvarNumMesas         = window.salvarNumMesas;
window.switchComandaTab       = window.switchComandaTab;

window.toggleTaxaEntrega = function(ativo) {
  const w = document.getElementById('taxa-entrega-wrap');
  if (w) w.style.display = ativo ? 'block' : 'none';
};
