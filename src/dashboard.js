// src/dashboard.js
import { getSupa } from './supabase.js';
import { showToast } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://pediway.com.br';

// Limpa domínio antigo do localStorage se existir
(function() {
  try {
    const saved = localStorage.getItem('pw_estab');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Remove campo 'link' que possa ter domínio antigo
      if (parsed.link) {
        delete parsed.link;
        localStorage.setItem('pw_estab', JSON.stringify(parsed));
      }
    }
  } catch(e) {}
})();
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
  const trialAtivo = plano === 'basico' && !(diasTrial > 15);
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
    if (5 >= dias) elvenc.style.color = '#C0392B';
  }
}

export async function initDashboard() {
  // ── Verifica expiração do QUENTE ao abrir o dashboard ────────────────────
  // Se o dia salvo (quente_dia) for diferente do dia atual → desativa promoções automaticamente
  async function verificarExpiracaoQuente(estab) {
    if (!estab?.id) return;
    const diaAtual = new Date().getDay();
    const diaSalvo = estab.quente_dia;
    // Se não tem quente ativo ou está no mesmo dia, não faz nada
    if (diaSalvo === undefined || diaSalvo === null) return;
    if (diaSalvo === diaAtual) return;
    // Dia virou → desativa todas as promoções do estabelecimento
    try {
      // Busca todos os produtos em promoção
      const { data: prodsPromo } = await getSupa().from('produtos')
        .select('id,preco_original')
        .eq('estabelecimento_id', estab.id)
        .eq('em_promocao', true);
      if (prodsPromo?.length) {
        for (const p of prodsPromo) {
          await getSupa().from('produtos').update({
            em_promocao:      false,
            desconto_percent: 0,
            preco:            p.preco_original || undefined,
            preco_original:   null,
          }).eq('id', p.id);
        }
      }
      // Reseta flag da loja
      await getSupa().from('estabelecimentos').update({
        promocao_ativa:   false,
        desconto_percent: 0,
        quente_dia:       null,
        quente_nome:      null,
      }).eq('id', estab.id);
      showToast('🌅 QUENTE expirou — promoções removidas automaticamente');
      console.log('[QUENTE] Expirou. Dia salvo:', diaSalvo, '→ Hoje:', diaAtual);
    } catch(e) { console.warn('[QUENTE] Erro ao expirar:', e); }
  }
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
        if (fresh.num_mesas) {
          localStorage.setItem('pw_num_mesas_' + fresh.id, String(fresh.num_mesas));
        }
        // Verifica se o QUENTE expirou (dia virou)
        await verificarExpiracaoQuente(fresh);
      }
    } catch(e) { console.log('Sync estab:', e); }
  }

  // Textos do header
  const sn = $('dash-store-name'); if (sn) sn.textContent = estab.nome;
  const lu = $('link-url');
  if (lu) lu.textContent = `pediway.com.br/${estab.slug}`;
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
    // Carrega estado do caixa na inicialização (persiste após F5)
    setTimeout(carregarCaixa, 500);
    // Pré-aquece cache do cardápio (1º open da comanda fica instantâneo)
    setTimeout(() => carregarCardapioComanda(), 1200);
  } else {
    renderCardapioDemo();
    renderPedidosDemo();
    renderEmojiGrid();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
function preencherConfig(estab) {
  const set = (id, val) => { const el = $(id); if (el && val != null) el.value = val; };
  set('cfg-nome',      estab.nome);
  set('cfg-slug',      estab.slug);
  set('cfg-whats', fmtFone(estab.whatsapp) || '');
  set('cfg-desc', estab.descricao || '');
  const descCount = document.getElementById('cfg-desc-count');
  if (descCount) descCount.textContent = (estab.descricao||'').length + '/40';
  // Tipo do estabelecimento
  if (document.getElementById('cfg-tipo-estab')) {
    document.getElementById('cfg-tipo-estab').value = estab.tipo_estab || '';
    setTimeout(() => window.renderTipoCfgGrid?.(estab.tipo_estab || ''), 100);
  }
  // Horários de funcionamento
  setTimeout(() => window.renderHorariosCfg?.(estab.horarios || {}), 120);
  if(descCount) descCount.textContent = (estab.descricao||'').length + '/40';
  set('cfg-endereco',  estab.endereco || '');
  set('cfg-tempo',     estab.tempo_entrega || '30-45 min');
  set('cfg-telefone', fmtFone(estab.telefone_contato) || '');
  set('cfg-cnpj',      estab.cnpj || '');
  set('cfg-instagram', estab.instagram || '');
  set('cfg-tiktok',    estab.tiktok || '');
  set('cfg-site',      estab.site || '');
  set('cfg-msg-nota',  estab.msg_nota || '');
  const cfgLink = $('cfg-link-preview');
  if (cfgLink) { cfgLink.textContent = `${BASE_URL}/${estab.slug}`; Object.assign(cfgLink.style,{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block',maxWidth:'100%'}); }
  const cfgLinkGarcom = $('cfg-link-garcom');
  if (cfgLinkGarcom) { cfgLinkGarcom.textContent = `${BASE_URL}/comandas/${estab.slug}`; Object.assign(cfgLinkGarcom.style,{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block',maxWidth:'100%',flex:'1',minWidth:'0'}); }
  const ce = $('cfg-entrega');  if (ce) ce.checked = estab.faz_entrega  !== false;
  const cr = $('cfg-retirada'); if (cr) cr.checked = estab.faz_retirada !== false;
  const ct = $('cfg-taxa');     if (ct) ct.value   = estab.taxa_entrega || '';
  const cp = $('cfg-pix');      if (cp) cp.checked = estab.aceita_pix      !== false;
  const cc = $('cfg-cartao');   if (cc) cc.checked = estab.aceita_cartao   !== false;
  const cd = $('cfg-dinheiro'); if (cd) cd.checked = estab.aceita_dinheiro !== false;
  // Taxa de serviço
  const ctsToggle = $('cfg-taxa-servico');
  const ctsWrap   = document.getElementById('cfg-taxa-servico-wrap');
  const ctsPerc   = $('cfg-perc-servico');
  if (ctsToggle) ctsToggle.checked = estab.taxa_servico === true;
  if (ctsWrap)   ctsWrap.style.display = estab.taxa_servico ? 'block' : 'none';
  if (ctsPerc)   ctsPerc.value = estab.perc_servico || 10;
  // Carrega estados e restaura estado + cidade salvos
  if (typeof window.carregarEstadosDash === 'function') {
    window.carregarEstadosDash({ estado: estab.estado || null, cidade: estab.cidade || null });
  }
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

// ── Sistema de crop com canvas + safe area ──────────────────────────────────
let _CRP = { img:null, scale:1, offX:0, offY:0, minScale:0.5, canvasId:'', stageId:'', safePrefix:'' };

function crpDraw() {
  const cvs = document.getElementById(_CRP.canvasId);
  if (!cvs || !_CRP.img) return;
  const stage = document.getElementById(_CRP.stageId);
  const W = (stage ? stage.offsetWidth : 0) || cvs.offsetWidth || 340;
  if (10 > W) { setTimeout(crpDraw, 30); return; }
  const H = W;
  cvs.width = W; cvs.height = H; cvs.style.height = H + 'px';
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
  const iw = _CRP.img.naturalWidth, ih = _CRP.img.naturalHeight;
  const dw = iw * _CRP.scale, dh = ih * _CRP.scale;
  const dx = W/2 - dw/2 + _CRP.offX, dy = H/2 - dh/2 + _CRP.offY;
  ctx.drawImage(_CRP.img, dx, dy, dw, dh);
  const safe = Math.min(W,H) * 0.82;
  const sx = (W - safe) / 2, sy = (H - safe) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 0, W, sy);
  ctx.fillRect(0, sy + safe, W, H - sy - safe);
  ctx.fillRect(0, sy, sx, safe);
  ctx.fillRect(sx + safe, sy, W - sx - safe, safe);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
  if (_CRP.safePrefix === 'cso') {
    ctx.beginPath(); ctx.arc(W/2, H/2, safe/2, 0, Math.PI*2); ctx.stroke();
  } else {
    ctx.strokeRect(sx, sy, safe, safe);
  }
  const cc = '#C0392B', cl = 18;
  ctx.strokeStyle = cc; ctx.lineWidth = 3; ctx.lineCap = 'round';
  [[sx,sy],[sx+safe,sy],[sx,sy+safe],[sx+safe,sy+safe]].forEach(([cx,cy],i) => {
    ctx.beginPath();
    ctx.moveTo(cx + (i%2===0?cl:0),cy); ctx.lineTo(cx + (i%2===0?0:-cl),cy);
    ctx.moveTo(cx,cy + (i<2?cl:0)); ctx.lineTo(cx,cy + (i<2?0:-cl));
    ctx.stroke();
  });
}

function crpApplyMinScale() {
  const stage = document.getElementById(_CRP.stageId);
  if (!stage || !_CRP.img) return;
  const W = stage.offsetWidth || 340;
  const safe = W * 0.82;
  const ms = Math.max(safe / _CRP.img.naturalWidth, safe / _CRP.img.naturalHeight);
  _CRP.minScale = ms;
  if (_CRP.minScale !== ms && ms > _CRP.scale) _CRP.scale = ms;
}

function crpClampOffset() {
  if (!_CRP.img) return;
  const stage = document.getElementById(_CRP.stageId);
  const W = stage ? stage.offsetWidth || 340 : 340;
  const safe = W * 0.82;
  const dw = _CRP.img.naturalWidth * _CRP.scale, dh = _CRP.img.naturalHeight * _CRP.scale;
  const maxX = Math.max(0, (dw - safe) / 2), maxY = Math.max(0, (dh - safe) / 2);
  _CRP.offX = Math.max(-maxX, Math.min(maxX, _CRP.offX));
  _CRP.offY = Math.max(-maxY, Math.min(maxY, _CRP.offY));
}

function crpInitDrag(stageId) {
  const el = document.getElementById(stageId); if (!el) return;
  // Remove listeners antigos do elemento
  if (el._crpDown)  { el.removeEventListener('mousedown', el._crpDown); el.removeEventListener('touchstart', el._crpDown); }
  if (el._crpWheel) el.removeEventListener('wheel', el._crpWheel);
  // Remove listeners antigos do document (evita acumulação)
  if (window._crpMoveHandler)  { document.removeEventListener('mousemove', window._crpMoveHandler); document.removeEventListener('touchmove', window._crpMoveHandler); }
  if (window._crpUpHandler)    { document.removeEventListener('mouseup', window._crpUpHandler); document.removeEventListener('touchend', window._crpUpHandler); }

  let dragging = false, lx = 0, ly = 0, pinchDist0 = 0, pinchScale0 = 1;
  const onDown = e => {
    e.preventDefault();
    if (e.touches && e.touches.length === 2) {
      pinchDist0 = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      pinchScale0 = _CRP.scale; dragging = false; return;
    }
    dragging = true;
    const t = e.touches ? e.touches[0] : e; lx = t.clientX; ly = t.clientY;
  };
  const onMove = e => {
    if (!dragging && !(e.touches && e.touches.length === 2)) return; // não bloqueia se não está arrastando
    e.preventDefault();
    if (e.touches && e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      _CRP.scale = Math.max(_CRP.minScale, Math.min(8, pinchScale0 * d / pinchDist0));
      crpClampOffset(); crpDraw(); return;
    }
    const t = e.touches ? e.touches[0] : e;
    _CRP.offX += t.clientX - lx; _CRP.offY += t.clientY - ly;
    lx = t.clientX; ly = t.clientY;
    crpClampOffset(); crpDraw();
  };
  const onUp = () => { dragging = false; };
  const onWheel = e => {
    e.preventDefault();
    _CRP.scale = Math.max(_CRP.minScale, Math.min(8, _CRP.scale * (1 - e.deltaY * 0.001)));
    crpClampOffset(); crpDraw();
  };
  el._crpDown = onDown; el._crpWheel = onWheel;
  el.addEventListener('mousedown', onDown, { passive:false });
  el.addEventListener('touchstart', onDown, { passive:false });
  el.addEventListener('wheel', onWheel, { passive:false });
  // Salva globalmente para poder remover depois
  window._crpMoveHandler = onMove;
  window._crpUpHandler   = onUp;
  document.addEventListener('mousemove', onMove); // SEM passive:false — não bloqueia scroll do doc
  document.addEventListener('touchmove', onMove); // SEM passive:false
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);
}

// Remove todos os listeners do crop ao fechar o modal
function crpCleanup() {
  if (window._crpMoveHandler) {
    document.removeEventListener('mousemove', window._crpMoveHandler);
    document.removeEventListener('touchmove', window._crpMoveHandler);
    window._crpMoveHandler = null;
  }
  if (window._crpUpHandler) {
    document.removeEventListener('mouseup', window._crpUpHandler);
    document.removeEventListener('touchend', window._crpUpHandler);
    window._crpUpHandler = null;
  }
  _CRP.img = null;
}

function crpGetBlob(canvasId, stageId, safePrefix, isCircle, callback) {
  const cvs = document.getElementById(canvasId); if (!cvs || !_CRP.img) { callback(null); return; }
  const W = cvs.width, safe = Math.floor(W * 0.82), sx = Math.floor((W - safe) / 2);
  const out = document.createElement('canvas');
  out.width = safe; out.height = safe;
  const ctx = out.getContext('2d');
  if (isCircle) { ctx.beginPath(); ctx.arc(safe/2, safe/2, safe/2, 0, Math.PI*2); ctx.clip(); }
  ctx.drawImage(cvs, sx, sx, safe, safe, 0, 0, safe, safe);
  out.toBlob(callback, 'image/jpeg', 0.92);
}
// ── Fim sistema crop ─────────────────────────────────────────────────────────

window.abrirCropLogo = function(event) {
  const file = event.target.files[0]; if (!file) return;
  logoFile = file;
  event.target.value = '';
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    _CRP.img = img; _CRP.offX = 0; _CRP.offY = 0;
    _CRP.canvasId = 'crop-canvas'; _CRP.stageId = 'crop-stage'; _CRP.safePrefix = 'cso';
    crpApplyMinScale(); _CRP.scale = _CRP.minScale;
    crpInitDrag('crop-stage');
    $('crop-overlay')?.classList.add('open');
    // Delay para garantir que o overlay está visível antes de desenhar
    setTimeout(() => { crpApplyMinScale(); crpDraw(); }, 50);
  };
  img.src = url;
};

window.aplicarCrop = function() {
  // Legacy: chamado pelo slider (mantemos por compatibilidade)
  crpDraw();
};
window.fecharCrop = function() {
  $('crop-overlay')?.classList.remove('open');
  logoFile = null;
  crpCleanup();
};
window.confirmarCrop = function() {
  crpGetBlob('crop-canvas', 'crop-stage', 'cso', true, blob => {
    if (!blob) return;
    logoFile = new File([blob], 'logo.jpg', { type: 'image/jpeg' });
    mostrarLogoPreview(URL.createObjectURL(blob));
    $('crop-overlay')?.classList.remove('open');
  });
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
  const estab = getEstab(); if (!estab) return;

  const nome     = $('cfg-nome')?.value.trim();
  const slug     = $('cfg-slug')?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-');
  const whats    = ($('cfg-whats')?.value || '').replace(/\D/g,''); // salva só dígitos → evita bug na recuperação de senha
  const desc     = $('cfg-desc')?.value.trim();
  const estado   = $('cfg-estado')?.value || null;
  const cidade   = $('cfg-cidade')?.value.trim() || null;
  const endereco = $('cfg-endereco')?.value.trim();
  const tempo    = $('cfg-tempo')?.value;
  const aberto   = $('cfg-aberto')?.checked;
  const entrega  = $('cfg-entrega')?.checked;
  const retirada = $('cfg-retirada')?.checked;
  // Novos campos
  const telefone_contato = $('cfg-telefone')?.value.trim() || null;
  const cnpj             = ($('cfg-cnpj')?.value || '').replace(/\D/g,'') || null;
  const instagram        = ($('cfg-instagram')?.value || '').trim().replace('@','') || null;
  const tiktok           = ($('cfg-tiktok')?.value || '').trim().replace('@','') || null;
  const site             = $('cfg-site')?.value.trim() || null;
  const msg_nota         = $('cfg-msg-nota')?.value.trim() || null;
  const tipo_estab       = $('cfg-tipo-estab')?.value || null;

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
    const taxa_servico   = $('cfg-taxa-servico')?.checked === true;
    const perc_servico   = parseInt($('cfg-perc-servico')?.value) || 10;

    const updates = {
      nome, slug, whatsapp: whats, descricao: desc, estado, cidade, endereco,
      tempo_entrega: tempo, aberto, faz_entrega: entrega, faz_retirada: retirada,
      cor_primaria, logo_url,
      capa_url: null, capa_tipo: 'cor',
      taxa_entrega, aceita_pix, aceita_cartao, aceita_dinheiro,
      taxa_servico, perc_servico,
      telefone_contato, cnpj, instagram, tiktok, site, msg_nota,
      tipo_estab,
      horarios: window.getHorariosFromForm?.() || null,
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
    const cl  = $('cfg-link-preview');
  if (cl) { cl.textContent = `${BASE_URL}/${slug}`; Object.assign(cl.style,{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block',maxWidth:'100%'}); }
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

  // Filtra por sub-aba
  // QUENTE: só produtos com promoção ativa
  // TODOS: todos os produtos EXCETO os que estão no QUENTE
  const filtrado = (_dashSubTab === 'quente')
    ? (data||[]).filter(p => p.em_promocao && parseInt(p.desconto_percent||0) > 0)
    : (data||[]).filter(p => !(p.em_promocao && parseInt(p.desconto_percent||0) > 0));

  // Atualiza foguinho
  atualizarFireDash();

  if (!filtrado?.length) {
    grid.innerHTML = _dashSubTab === 'quente'
      ? `<div class="empty-state-light" style="grid-column:1/-1"><span>🔥</span><p>Nenhum produto QUENTE ainda.<br><small>Use o botão 🔥 QUENTE para criar uma promoção</small></p></div>`
      : `<div class="empty-state-light" style="grid-column:1/-1"><span>🍽️</span><p>Nenhum item ainda. Adicione seu primeiro produto!</p></div>`;
    return;
  }

  grid.innerHTML = filtrado.map(p => `
    <div class="item-card">
      <div class="item-card-img">
        ${p.foto_url
          ? `<img class="item-img" src="${p.foto_url}" alt="${p.nome}">`
          : `<div class="item-emoji-bg">${p.emoji || '🍔'}</div>`}
        <span class="item-disponivel">${p.disponivel ? 'Disponível' : 'Indisponível'}</span>
        ${p.promocao ? `<span class="item-promo-badge">🏷️ Promoção</span>` : ''}
        ${p.em_promocao && p.desconto_percent > 0 ? `<span class="item-promo-badge" style="background:linear-gradient(135deg,#e65e32,#c94e24);">🔥 ${p.desconto_percent}% OFF</span>` : ''}

      </div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria || 'SEM CATEGORIA'}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-desc-text">${p.descricao || ''}</div>
        <div class="item-footer">
          <div>
            ${p.em_promocao && p.desconto_percent > 0
              ? `<div>
                  <div style="font-size:.75rem;color:#aaa;text-decoration:line-through;margin-bottom:1px">R$ ${Number(p.preco_original||p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                  <div class="item-preco" style="color:var(--red);">R$ ${Number(p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                </div>`
              : p.promocao && p.preco_original
                ? `<div class="item-preco-original">R$ ${Number(p.preco_original).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                   <div class="item-preco">R$ ${Number(p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>`
                : `<div class="item-preco">R$ ${Number(p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>`}
          </div>
          <div class="item-acoes">
            <button class="btn-icon" onclick="editarItem('${p.id}')">✏️</button>
            <button class="btn-icon danger" onclick="deletarItem('${p.id}')">🗑️</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderPedidosDemo() {
  // Visão geral zerada — demo mostruário
  const sp = $('stat-pedidos');     if (sp) sp.textContent = '0';
  const sf = $('stat-faturamento'); if (sf) sf.textContent = 'R$ 0,00';

  // Sem pedidos na lista
  const lista = $('pedidos-novos-lista');
  if (lista) {
    lista.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#aaa">
      <div style="font-size:2.5rem;margin-bottom:10px">🎉</div>
      <div style="font-size:.88rem;font-weight:700;color:#555;margin-bottom:6px">Nenhum pedido ainda</div>
      <div style="font-size:.76rem">Crie sua conta e receba pedidos reais!</div>
    </div>`;
  }

  // Badge sem notificação
  const badgeW = $('badge-pedidos-wrap'); if (badgeW) badgeW.style.display = 'none';
}


function renderCardapioDemo() {
  const grid = $('cardapio-grid'); const stat = $('stat-itens');
  const demo = [
    { nome:'X-Burguer Especial', categoria:'LANCHES', preco:28.90, emoji:'🍔' },
    { nome:'X-Tudo',             categoria:'LANCHES', preco:34.90, emoji:'🍔' },
    { nome:'Batata Frita Grande', categoria:'ACOMPANHAMENTOS', preco:14.90, emoji:'🍟' },
    { nome:'Onion Rings',        categoria:'ACOMPANHAMENTOS', preco:12.90, emoji:'🧅' },
    { nome:'Refrigerante 350ml', categoria:'BEBIDAS', preco:7.90, emoji:'🥤' },
    { nome:'Suco Natural 400ml', categoria:'BEBIDAS', preco:11.90, emoji:'🥤' },
    { nome:'Sorvete Caseiro',    categoria:'SOBREMESAS', preco:9.90, emoji:'🍦' },
    { nome:'Combo Família',      categoria:'COMBOS', preco:89.90, emoji:'🎁' },
  ];
  if (stat) stat.textContent = String(demo.length);
  if (!grid) return;
  grid.innerHTML = demo.map(p => `
    <div class="item-card">
      <div class="item-card-img"><div class="item-emoji-bg">${p.emoji}</div></div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-footer">
          <div class="item-preco">R$ ${p.preco.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
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
  $('modal-item').classList.add('open');
  ['item-nome','item-desc','item-cat','item-preco','item-preco-orig'].forEach(id => { const el=$(id); if(el) el.value=''; });
  const dd=$('item-desconto-percent'); if(dd) dd.value='0';
  const dg=$('desconto-group'); if(dg) dg.style.display='none';
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
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    _CRP.img = img; _CRP.offX = 0; _CRP.offY = 0;
    _CRP.canvasId = 'crop-foto-canvas'; _CRP.stageId = 'crop-foto-stage'; _CRP.safePrefix = 'cfso';
    crpApplyMinScale(); _CRP.scale = _CRP.minScale;
    crpInitDrag('crop-foto-stage');
    const modal = $('modal-crop-foto');
    if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
    setTimeout(() => { crpApplyMinScale(); crpDraw(); }, 50);
  };
  img.src = url;
  _cropFotoUrl = url;
};

window.confirmarCropFoto = function() {
  if (!_CRP.img) { console.warn('[crop] sem imagem'); return; }

  // Crop via canvas da imagem original (mais confiável que drawImage canvas->canvas)
  const stage  = $('crop-foto-stage');
  const W      = stage ? stage.offsetWidth : 340;
  const safe   = Math.floor(W * 0.82);
  const sx     = Math.floor((W - safe) / 2);

  const out    = document.createElement('canvas');
  out.width    = safe; out.height = safe;
  const ctx    = out.getContext('2d');

  // Calcula onde a imagem está posicionada no stage
  const iw = _CRP.img.naturalWidth, ih = _CRP.img.naturalHeight;
  const dw = iw * _CRP.scale, dh = ih * _CRP.scale;
  const dx = W/2 - dw/2 + _CRP.offX;
  const dy = W/2 - dh/2 + _CRP.offY;

  // Desenha a porção da imagem que está dentro da safe area
  ctx.drawImage(_CRP.img, dx - sx, dy - sx, dw, dh);

  out.toBlob(blob => {
    if (!blob || blob.size < 100) {
      // Fallback: salva sem crop
      const fallbackFile = _cropFotoFile;
      if (fallbackFile) {
        fallbackFile._urlExistente = null;
        fotosFiles.push(fallbackFile); fotosPosX.push(50); fotosPosY.push(50);
      }
    } else {
      const file = new File([blob], _cropFotoFile?.name || 'foto.jpg', { type:'image/jpeg' });
      file._urlExistente = null;
      const editIdx = window._cropFotoEditIdx;
      if (editIdx != null && editIdx >= 0 && editIdx < fotosFiles.length) {
        fotosFiles[editIdx] = file; fotosPosX[editIdx] = 50; fotosPosY[editIdx] = 50;
        window._cropFotoEditIdx = null;
      } else {
        fotosFiles.push(file); fotosPosX.push(50); fotosPosY.push(50);
      }
    }

    renderFotosGrid();
    const modal = $('modal-crop-foto');
    if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
    _CRP.img = null;

    if (_fotoQueue && _fotoQueue.length > 0) {
      const next = _fotoQueue.shift(); _cropFotoFile = next;
      setTimeout(() => window.abrirCropFoto(next), 200);
    }
  }, 'image/jpeg', 0.92);
};

// Função chamada pelo foto-input (modal de item)
window.adicionarFotos = function(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  event.target.value = '';
  // Processa um arquivo de cada vez via fila
  let idx = 0;
  const next = () => {
    if (idx >= files.length) return;
    _cropFotoFile = files[idx++];
    window.abrirCropFoto(_cropFotoFile);
    // Após confirmar, se houver mais arquivos, o próximo será aberto
    // via _fotoQueue que guardamos aqui
    _fotoQueue = files.slice(idx);
  };
  _fotoQueue = files.slice(1);
  window.abrirCropFoto(files[0]);
  _cropFotoFile = files[0];
};

let _fotoQueue = [];

window.fecharCropFoto = function() {
  const m = $('modal-crop-foto'); if (m) m.classList.remove('open');
  document.body.style.overflow = '';
  _cropFotoFile = null;
  crpCleanup();
};

// Drag no modal de crop


function renderFotosGrid() {
  const grid = $('fotos-grid'); if (!grid) return;

  if (!fotosFiles.length) {
    grid.innerHTML = `<div class="foto-add-btn" onclick="document.getElementById('foto-input').click()">
      <span style="font-size:1.5rem">📷</span>
      <span style="font-size:0.72rem;color:#aaa">Adicionar foto</span>
    </div>`;
    return;
  }

  let html = fotosFiles.map((f, i) => {
    const url = f._urlExistente || URL.createObjectURL(f);
    const px  = fotosPosX[i] ?? 50;
    const py  = fotosPosY[i] ?? 50;
    const isExist = !!f._urlExistente;
    return `<div class="foto-thumb-wrap" id="foto-wrap-${i}">
      <div style="position:relative;width:100%;aspect-ratio:1/1;max-height:280px;border-radius:14px;overflow:hidden;background:#f0ebe4;border:2px solid var(--border);margin-bottom:8px;cursor:grab;touch-action:none" id="foto-drag-${i}">
        <img src="${url}" id="foto-img-${i}" draggable="false"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${px}% ${py}%;pointer-events:none;user-select:none">
        ${i===0 ? '<div style="position:absolute;top:8px;left:8px;background:var(--red);color:#fff;font-size:.62rem;font-weight:800;padding:3px 10px;border-radius:50px;z-index:3;letter-spacing:.04em">PRINCIPAL</div>' : ''}
        <div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;pointer-events:none;z-index:2">
          <div style="background:rgba(0,0,0,.55);color:#fff;font-size:.62rem;font-weight:600;padding:4px 12px;border-radius:50px;backdrop-filter:blur(6px)">
            ✋ Arraste para reposicionar
          </div>
        </div>
        <div style="position:absolute;bottom:10px;right:10px;width:44px;height:44px;border-radius:8px;overflow:hidden;background:rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.35);z-index:3">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover;opacity:.7">
          <div id="foto-pin-${i}" style="position:absolute;width:8px;height:8px;background:#fff;border-radius:50%;border:1.5px solid var(--red);transform:translate(-50%,-50%);left:${px}%;top:${py}%;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:.65rem;color:#aaa">${isExist ? '📎 Existente' : '✨ Nova'}</span>
        <button onclick="removerFotoItem(${i})" style="background:none;border:1px solid #e0dbd5;color:#aaa;padding:4px 12px;border-radius:8px;font-size:.7rem;font-weight:600;cursor:pointer" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'" onmouseout="this.style.borderColor='#e0dbd5';this.style.color='#aaa'">🗑 Remover</button>
      </div>
    </div>`;
  }).join('');

  html += `<div class="foto-add-btn" onclick="document.getElementById('foto-input').click()">
    <span style="font-size:1.5rem">📷</span>
    <span style="font-size:0.72rem;color:#aaa">Adicionar foto</span>
  </div>`;

  grid.innerHTML = html;
  fotosFiles.forEach((_, i) => iniciarDragFoto(null, i, true));
}

window.adicionarFotos = function(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  event.target.value = '';
  // Processa um arquivo de cada vez via fila
  let idx = 0;
  const next = () => {
    if (idx >= files.length) return;
    _cropFotoFile = files[idx++];
    window.abrirCropFoto(_cropFotoFile);
    // Após confirmar, se houver mais arquivos, o próximo será aberto
    // via _fotoQueue que guardamos aqui
    _fotoQueue = files.slice(idx);
  };
  _fotoQueue = files.slice(1);
  window.abrirCropFoto(files[0]);
  _cropFotoFile = files[0];
};

window.fecharCropFoto = function() {
  const m = $('modal-crop-foto'); if (m) m.classList.remove('open');
  document.body.style.overflow = '';
  _cropFotoFile = null;
  crpCleanup();
};

// Drag no modal de crop




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

// Listeners do drag de foto — passivos para não bloquear scroll
document.addEventListener('mousemove', _moveDragFoto, { passive: true });
document.addEventListener('touchmove', _moveDragFoto, { passive: true });
document.addEventListener('mouseup',   () => { _fotoDrag.ativo = false; });
document.addEventListener('touchend',  () => { _fotoDrag.ativo = false; });
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
}
window.removerFotoExistente = function(btn) {
  btn.closest('.foto-thumb-item').remove();
};

window.removerFotoItem = function(i) {
  fotosFiles.splice(i,1); fotosPosX.splice(i,1); fotosPosY.splice(i,1);
  renderFotosGrid();
};

window.reabrirCropFoto = function(i) {
  const f = fotosFiles[i]; if (!f) return;
  const url = f._urlExistente || URL.createObjectURL(f);
  _cropFotoFile = f;
  const img = new Image();
  img.onload = () => {
    _CRP.img = img; _CRP.offX = 0; _CRP.offY = 0;
    _CRP.canvasId = 'crop-foto-canvas'; _CRP.stageId = 'crop-foto-stage'; _CRP.safePrefix = 'cfso';
    crpApplyMinScale(); _CRP.scale = _CRP.minScale;
    crpInitDrag('crop-foto-stage');
    const modal = $('modal-crop-foto');
    if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
    setTimeout(() => { crpApplyMinScale(); crpDraw(); }, 50);
    // Ao confirmar esta edição, substituir no índice i
    window._cropFotoEditIdx = i;
  };
  img.src = url;
};

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
    set('item-cat', p.categoria||'');
    // Se tem desconto %, o campo mostra o preço ORIGINAL (o que o dono digitou)
    set('item-preco', p.em_promocao && p.preco_original ? p.preco_original : p.preco);
    set('item-preco-orig', p.preco_original||'');
    const pr = $('item-promocao'); if (pr) {
      pr.checked = !!p.promocao;
      const g=$('preco-orig-group'); if(g) g.style.display=p.promocao?'flex':'none';
      const dd=$('item-desconto-percent'); if(dd) dd.value=p.desconto_percent||'0';
      const dg=$('desconto-group'); if(dg) dg.style.display=p.promocao?'flex':'none';
    }
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
          const desconto_pct_u = parseInt($('item-desconto-percent')?.value||'0');
          const precoBase = parseFloat($('item-preco')?.value);
          let precoFinalU = precoBase;
          let precoOrigU = promocao ? preco_orig : null;
          if (promocao && desconto_pct_u > 0) {
            precoOrigU = precoBase;
            precoFinalU = parseFloat((precoBase * (1 - desconto_pct_u / 100)).toFixed(2));
          }
          const { error } = await getSupa().from('produtos').update({
            nome:         $('item-nome')?.value.trim(),
            descricao:    $('item-desc')?.value.trim(),
            categoria:    $('item-cat')?.value.trim().toUpperCase(),
            preco:        precoFinalU,
            preco_original: precoOrigU,
            foto_url, fotos_urls, emoji: emojiSel, promocao,
            em_promocao: promocao && desconto_pct_u > 0,
            desconto_percent: promocao ? desconto_pct_u : 0,
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
      v.onloadedmetadata = () => resolve(30 >= v.duration);
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
async function renderPedidosFiltrados(peds, label) {
  const container = document.getElementById('todos-pedidos');
  if (!container) return;

  let aviso = document.getElementById('ped-filtro-aviso');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'ped-filtro-aviso';
    aviso.style.cssText = 'font-size:.78rem;color:var(--red);font-weight:700;padding:8px 0;text-align:center';
    container.prepend(aviso);
  }
  aviso.textContent = `${peds.length} pedido(s) encontrado(s) — ${label}`;

  // Renderiza os cards filtrados
  const cards = document.querySelectorAll('#todos-pedidos .pedido-card');
  cards.forEach(c => c.style.display = 'none');

  if (!peds.length) {
    aviso.textContent = `Nenhum pedido encontrado no período: ${label}`;
    return;
  }

  // Injeta os cards do resultado do banco
  peds.forEach(p => {
    const existing = container.querySelector(`[data-id="${p.id}"]`);
    if (existing) {
      existing.style.display = '';
    }
  });
}

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
  const sf = $('stat-faturamento'); if (sf) sf.textContent = `R$ ${fatHoje.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

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
    const totalFmt = 'R$ ' + Number(p.total||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const endStr   = p.endereco === 'Retirada no local' ? '🏃 Retirada' : p.endereco ? `🛵 ${p.endereco.split(',')[0]}` : '🏃 Retirada';
    const pgto     = p.pagamento ? p.pagamento.toUpperCase() : '';
    return `<div class="pedido-card ped-status-${p.status||'novo'}" data-id="${p.id}" data-criado="${p.created_at||''}" data-pagamento="${(p.pagamento||'pix').toLowerCase()}">
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
          ${p.status==='novo'?`<button class="btn-ped-aceitar" onclick="aceitarPedido('${p.id}')">✓ Aceitar</button><button class="btn-ped-recusar" onclick="recusarPedido('${p.id}')">✕ Recusar</button>`:''}
          ${p.status==='preparo'?`<button class="btn-ped-aceitar" onclick="marcarPronto('${p.id}')">✅ Pronto</button>`:''}
          <button class="btn-ped-imprimir" onclick="verPedido('${p.id}')">🖨️ Ver</button>
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
    <div class="pnc-total">R$ ${Number(p.total||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
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
  // Busca o pedido para saber o tipo antes de aceitar
  const { data: ped } = await getSupa().from('pedidos').select('endereco').eq('id', id).maybeSingle();
  const isMesa = ped && (ped.endereco||'').startsWith('No local');

  const { error } = await getSupa().from('pedidos').update({ status:'preparo' }).eq('id', id);
  if (error) return showToast('Erro ao aceitar.','error');
  removerCardNovo(id);

  if (isMesa) {
    // Pedido de mesa → imprime ticket de cozinha direto
    showToast('✅ Aceito! Enviando para cozinha...');
    marcarEnviadoCozinha(id);
    window.imprimirCozinha(id);
    await carregarPedidosMesas(); renderMesas();
    window.renderHistoricoMesas();
  } else {
    // Pedido de delivery/retirada → imprime nota do cliente
    showToast('✅ Pedido aceito! Imprimindo nota do cliente...');
    window.imprimirPedido(id);
  }
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
      ${itens.map(i=>`<div style="display:flex;justify-content:space-between"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(i.preco*i.qtd).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>`).join('')}
      <hr style="border:none;border-top:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;font-weight:800"><span>Total</span><span>R$ ${Number(p.total||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        ${p.status==='novo'?`<button class="btn-ped-aceitar" onclick="aceitarPedido('${p.id}');fecharModalPedido()">Aceitar</button><button class="btn-ped-recusar" onclick="recusarPedido('${p.id}');fecharModalPedido()">Recusar</button>`:''}
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
  const fmtR  = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const subtotal  = itens.reduce((s,i) => s + (i.preco||0)*(i.qtd||1), 0);
  const taxa      = Number(p.taxa_entrega||0);
  const total     = Number(p.total||0);
  const agora     = new Date(p.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const isEntrega = p.endereco && p.endereco !== 'Retirada no local' && !p.endereco.startsWith('No local');
  const cnpjRaw   = (estab?.cnpj || '').replace(/\D/g,'');
  const cnpjFmt   = cnpjRaw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  const insta     = estab?.instagram ? '@' + estab.instagram : '';
  const ttok      = estab?.tiktok   ? '@' + estab.tiktok   : '';
  const msgFim    = estab?.msg_nota || 'Obrigado pela preferencia!';
  const pgto      = (p.pagamento || 'Nao informado').toUpperCase();
  const numPed    = '#' + p.id.slice(-6).toUpperCase();

  const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Nota ${numPed}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Poppins', Arial, sans-serif;
    font-size: 13px;
    font-weight: 400;
    color: #000;
    background: #fff;
    width: 300px;
    max-width: 300px;
    margin: 0 auto;
    padding: 12px 10px;
  }
  /* Garantia que tudo fica dentro da largura do papel */
  * { max-width: 100%; word-break: break-word; }

  /* Títulos — Poppins Bold */
  .bold  { font-weight: 700; }
  .black { font-weight: 900; }

  /* Alinhamentos */
  .center { text-align: center; }
  .right  { text-align: right; }

  /* Logo */
  .logo { font-size: 20px; font-weight: 900; letter-spacing: .06em; line-height: 1.2; }
  .logo-red { color: #C0392B; }

  /* Nome da empresa */
  .empresa { font-size: 14px; font-weight: 700; margin-top: 2px; }

  /* Informações menores */
  .info-sm { font-size: 11px; font-weight: 400; color: #333; line-height: 1.7; margin-top: 3px; }

  /* Separadores */
  .sep-dash  { border: none; border-top: 1px dashed #888; margin: 8px 0; }
  .sep-solid { border: none; border-top: 2px solid #000; margin: 8px 0; }
  .sep-thick { border: none; border-top: 3px solid #000; margin: 8px 0; }

  /* Número do pedido destaque */
  .num-ped { font-size: 22px; font-weight: 900; letter-spacing: .1em; line-height: 1.1; }
  .badge {
    display: inline-block;
    background: #000;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 3px;
    letter-spacing: .06em;
    margin-top: 3px;
  }

  /* Seção título */
  .sec {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: #555;
    border-bottom: 1px solid #ccc;
    padding-bottom: 3px;
    margin: 8px 0 5px;
  }

  /* Linhas de dados */
  .linha {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: 12px;
    font-weight: 400;
    padding: 1px 0;
    gap: 6px;
  }
  .linha .label { font-weight: 700; flex-shrink: 0; }
  .linha .val   { text-align: right; }

  /* Itens do pedido */
  .item {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 400;
    padding: 3px 0;
    gap: 6px;
    border-bottom: 1px dotted #ddd;
  }
  .item:last-child { border-bottom: none; }
  .item-nome { flex: 1; font-weight: 700; }
  .item-qtd  { font-weight: 900; color: #C0392B; flex-shrink: 0; }
  .item-val  { flex-shrink: 0; }

  .adicional {
    font-size: 11px;
    font-weight: 400;
    color: #555;
    padding: 1px 0 1px 12px;
  }

  /* Observação */
  .obs {
    border: 1.5px solid #000;
    border-radius: 3px;
    padding: 5px 8px;
    font-size: 12px;
    font-weight: 400;
    margin: 6px 0;
  }
  .obs-titulo { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }

  /* Subtotais */
  .subtotal-linha {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 400;
    padding: 2px 0;
  }

  /* Total final */
  .total-bloco {
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 5px 0;
    margin: 4px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .total-label { font-size: 15px; font-weight: 900; }
  .total-val   { font-size: 17px; font-weight: 900; color: #C0392B; }

  /* Pagamento */
  .pgto-linha {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 700;
    padding: 4px 0;
    border-bottom: 1px dashed #bbb;
  }

  /* Redes sociais */
  .social { font-size: 11px; font-weight: 400; text-align: center; line-height: 1.8; color: #333; }
  .social b { font-weight: 700; }

  /* Mensagem final */
  .msg-final { font-size: 12px; font-weight: 700; text-align: center; margin: 6px 0 2px; }

  /* Rodapé */
  .rodape { font-size: 10px; font-weight: 400; text-align: center; color: #888; letter-spacing: .04em; }

  .sep { color:#999;font-size:10px;text-align:center;letter-spacing:.05em;margin:5px 0; }
  .row-between { display:flex;justify-content:space-between;align-items:center;padding:3px 0; }
  @media print {
    body { padding: 4px 6px; }
    @page { margin: 0; size: 80mm auto; }
  }
</style></head><body>

<!-- iFood-style receipt -->
<div class="center">
  <div class="logo">🍔 ${estab?.nome || 'Estabelecimento'}</div>
  <div class="info-sm">
    ${estab?.endereco || ''}${estab?.telefone_contato ? '&nbsp;&nbsp;📞 '+estab.telefone_contato : ''}
  </div>
</div>
<div class="sep">━━━━━━━━━━━━━━━━━━━━━━━</div>
<div class="row-between" style="font-size:13px">
  <span>🧾 PEDIDO <b>${numPed}</b></span>
  <span>📅 ${agora}</span>
</div>
<div style="text-align:center;margin:4px 0">
  <span class="badge" style="background:${isEntrega?'#2980B9':'#27AE60'};color:#fff;font-size:12px;padding:4px 16px;border-radius:20px;font-weight:700;letter-spacing:.06em">
    ${isEntrega ? '🛵 ENTREGA' : '🔴 RETIRADA'}
  </span>
</div>
<div class="sep">━━━━━━━━━━━━━━━━━━━━━━━</div>
<div style="font-size:12px;line-height:1.8">
  <div>👤 <b>${p.cliente_nome || '—'}</b>${p.cliente_whats ? '&nbsp;&nbsp;📱 '+p.cliente_whats : ''}</div>
  ${isEntrega ? '<div>📍 '+p.endereco+'</div>' : ''}
  ${p.observacao ? '<div>📝 <i>'+p.observacao+'</i></div>' : ''}
</div>
<div class="sep">━━━━━━━━━━━━━━━━━━━━━━━</div>
<div class="sec">🛒 ITENS DO PEDIDO</div>
${itens.map(i => {
  const sub = ((i.preco||0)*(i.qtd||1)).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const adds = Array.isArray(i.adicionais) && i.adicionais.length
    ? i.adicionais.map(a => '<div class="adicional">+ '+a.nome+' (R$ '+Number(a.preco||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+')</div>').join('')
    : '';
  return '<div class="item"><span class="item-qtd">'+((i.qtd||1))+'x</span><span class="item-nome">'+i.nome+'</span><span class="item-val">R$ '+sub+'</span></div>'+adds;
}).join('')}
<div class="sep">━━━━━━━━━━━━━━━━━━━━━━━</div>
${subtotal !== total - taxa ? '<div class="subtotal-linha"><span>Subtotal</span><span>'+fmtR(subtotal)+'</span></div>' : ''}
${taxa > 0 ? '<div class="subtotal-linha"><span>🛵 Taxa de entrega</span><span>'+fmtR(taxa)+'</span></div>' : ''}
<div class="total-bloco">
  <span class="total-label">💰 TOTAL</span>
  <span class="total-val">${fmtR(total)}</span>
</div>
<div class="sep">━━━━━━━━━━━━━━━━━━━━━━━</div>
<div class="pgto-linha">
  <span>💳 PAGAMENTO</span>
  <span>${pgto}</span>
</div>
<div class="sep">━━━━━━━━━━━━━━━━━━━━━━━</div>
${(insta || ttok) ? '<div class="social">'+(insta ? '📲 Instagram: <b>'+insta+'</b>  ' : '')+(ttok ? '🎵 TikTok: <b>'+ttok+'</b>' : '')+'</div>' : ''}
<div class="msg-final">🙏 ${msgFim}</div>
<div class="rodape">pediway.com.br · ${agora}</div>

</body></html>`;

  const win = window.open('', '_blank', 'width=380,height=700');
  if (!win) { showToast('⚠️ Permita pop-ups para imprimir'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comprovante de Caixa</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;color:#000;max-width:320px;margin:0 auto}h2{font-size:14px;text-align:center;margin-bottom:2px}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:3px 0}.bold{font-weight:bold}.status{text-align:center;font-size:13px;font-weight:bold;margin:6px 0}</style>
</head><body>
<h2>PEDIWAY</h2>
<p class="center" style="font-size:10px">${estab?.nome||''}</p>
<p class="center" style="font-size:10px">${estab?.cidade||''}</p>
<div class="line"></div>
<p class="center bold" style="font-size:13px">COMPROVANTE DE FECHAMENTO DE CAIXA</p>
<div class="line"></div>
<div class="row"><span>Abertura:</span><span>${horaAb}</span></div>
<div class="row"><span>Fechamento:</span><span>${agora}</span></div>
${operador?('<div class="row"><span>Operador:</span><span>'+operador+'</span></div>'):''}
<div class="line"></div>
<p class="bold center">VENDAS POR FORMA DE PAGAMENTO</p>
<div class="line"></div>
<div class="row"><span>📱 PIX</span><span>${fmtR(t.totPix||0)}</span></div>
<div class="row"><span>💳 Cartão Crédito</span><span>${fmtR(t.totCred||0)}</span></div>
<div class="row"><span>💳 Cartão Débito</span><span>${fmtR(t.totDeb||0)}</span></div>
<div class="row"><span>💵 Dinheiro</span><span>${fmtR(t.totDin||0)}</span></div>
<div class="row"><span>🍽️ Comandas</span><span>${fmtR(t.totMesa||0)}</span></div>
<div class="line"></div>
<div class="row bold"><span>TOTAL VENDAS</span><span>${fmtR(t.totVendas||0)}</span></div>
<div class="row"><span>+ Fundo inicial</span><span>${fmtR(t.fundo||0)}</span></div>
<div class="row bold"><span>TOTAL ESPERADO</span><span>${fmtR(esperado)}</span></div>
${vFech>0?'<div class="row bold"><span>VALOR CONTADO</span><span>'+fmtR(vFech)+'</span></div>':''}
<div class="line"></div>
<div class="status">${difTxt}</div>
<div class="line"></div>
${obs?'<p style="font-size:10px;text-align:center">Obs: '+obs+'</p>':''}
<p class="center" style="margin-top:8px;font-size:10px">Gerado em ${agora}</p>
<p class="center" style="font-size:10px">PEDIWAY — Sistema de Delivery</p>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

async function carregarHistoricoCaixa() {
  const estab = getEstab(); if (!estab?.id) return;
  const { data } = await getSupa().from('controle_caixa')
    .select('*').eq('estabelecimento_id', estab.id)
    .order('created_at', { ascending: false }).limit(20);
  const el = document.getElementById('caixa-historico');
  if (!el) return;
  const fmtR = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  if (!data?.length) {
    el.innerHTML = '<div style="text-align:center;color:#aaa;font-size:.82rem;padding:24px">Nenhum registro ainda</div>';
    return;
  }
  el.innerHTML = data.map(c => {
    const dtAb  = new Date(c.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
    const dtFch = c.fechado_em ? new Date(c.fechado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
    const dif   = c.diferenca || 0;
    const difColor = dif < -0.01 ? '#ef4444' : dif > 0.01 ? '#f59e0b' : '#22c55e';
    const totais = c.totais_pagamento || {};
    return `<div style="background:#faf8f5;border-radius:12px;padding:12px 14px;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:.7rem;font-weight:700;padding:2px 10px;border-radius:50px;background:${c.status==='aberto'?'#dcfce7':'#f0ebe4'};color:${c.status==='aberto'?'#166534':'#888'}">${c.status==='aberto'?'🔓 Aberto':'🔒 Fechado'}</span>
          <span style="font-size:.7rem;color:#aaa">${dtAb}${dtFch?' → '+dtFch:''}</span>
        </div>
        ${c.status==='fechado'?'<button onclick="reimprimirCaixa(\''+c.id+'\')">🖨️</button>':''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:.72rem">
        <span style="color:#888">Fundo: <b>${fmtR(c.valor_abertura)}</b></span>
        ${c.valor_fechamento!=null?'<span style="color:#888">Fechado: <b>'+fmtR(c.valor_fechamento)+'</b></span>':'<span></span>'}
        ${totais.totVendas!=null?'<span style="color:#888">Vendas: <b style="color:var(--red)">'+fmtR(totais.totVendas)+'</b></span>':'<span></span>'}
        ${c.diferenca!=null?'<span style="color:#888">Diferença: <b style="color:'+difColor+'">'+(dif>=0?'+':'')+fmtR(dif)+'</b></span>':'<span></span>'}
      </div>
      ${c.operador?'<div style="font-size:.68rem;color:#aaa;margin-top:4px">👤 '+c.operador+'</div>':''}
    </div>`;
  }).join('');
}

window.reimprimirCaixa = async function(caixaId) {
  const { data } = await getSupa().from('controle_caixa').select('*').eq('id', caixaId).single();
  if (!data) return;
  const estab = getEstab();
  const t = data.totais_pagamento || {};
  const fmtR = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const horaAb = new Date(data.created_at).toLocaleString('pt-BR');
  const horaFch = data.fechado_em ? new Date(data.fechado_em).toLocaleString('pt-BR') : '—';
  const esperado = (data.valor_abertura||0) + (t.totVendas||0);
  const dif = (data.valor_fechamento||0) - esperado;
  const difTxt = Math.abs(dif) < 0.01 ? '✅ Conferido' :
    dif < 0 ? '❌ Falta '+fmtR(Math.abs(dif)) : '⚠️ Sobra '+fmtR(dif);
  const win = window.open('','_blank','width=380,height=700');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comprovante</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;max-width:320px;margin:0 auto}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:3px 0}.bold{font-weight:bold}</style>
</head><body>
<h2 class="center">PEDIWAY</h2>
<p class="center" style="font-size:10px">${estab?.nome||''} — ${estab?.cidade||''}</p>
<div class="line"></div>
<p class="center bold">2ª VIA — FECHAMENTO DE CAIXA</p>
<div class="line"></div>
<div class="row"><span>Abertura:</span><span>${horaAb}</span></div>
<div class="row"><span>Fechamento:</span><span>${horaFch}</span></div>
${data.operador?'<div class="row"><span>Operador:</span><span>'+data.operador+'</span></div>':''}
<div class="line"></div>
<div class="row"><span>📱 PIX</span><span>${fmtR(t.totPix||0)}</span></div>
<div class="row"><span>💳 Crédito</span><span>${fmtR(t.totCred||0)}</span></div>
<div class="row"><span>💳 Débito</span><span>${fmtR(t.totDeb||0)}</span></div>
<div class="row"><span>💵 Dinheiro</span><span>${fmtR(t.totDin||0)}</span></div>
<div class="row"><span>🍽️ Comandas</span><span>${fmtR(t.totMesa||0)}</span></div>
<div class="line"></div>
<div class="row bold"><span>TOTAL VENDAS</span><span>${fmtR(t.totVendas||0)}</span></div>
<div class="row bold"><span>TOTAL ESPERADO</span><span>${fmtR(esperado)}</span></div>
${data.valor_fechamento!=null?'<div class="row bold"><span>VALOR CONTADO</span><span>'+fmtR(data.valor_fechamento)+'</span></div>':''}
<p class="center bold" style="margin:8px 0">${difTxt}</p>
<div class="line"></div>
<p class="center" style="font-size:10px">PEDIWAY — ${new Date().toLocaleString('pt-BR')}</p>
</body></html>`);
  win.document.close(); win.print();
};

window.abrirCaixa          = window.abrirCaixa;
window.fecharCaixa         = window.fecharCaixa;
window.calcularDiferenca   = window.calcularDiferenca;
window.imprimirComprovanteCaixa = window.imprimirComprovanteCaixa;
window.reimprimirCaixa     = window.reimprimirCaixa;
window.filtrarPedidosData  = window.filtrarPedidosData;
window.toggleCartaoSubMenu = window.toggleCartaoSubMenu;

// Formata número de telefone → (88) 98888-8888
function fmtFone(num) {
  if (!num) return '';
  const d = String(num).replace(/\D/g,'');
  if (d.length === 11) return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
  if (d.length === 13) return '+' + d.slice(0,2) + ' (' + d.slice(2,4) + ') ' + d.slice(4,9) + '-' + d.slice(9);
  return d;
}
function wppLink(num) {
  const d = String(num||'').replace(/\D/g,'');
  const n = d.length <= 11 ? '55' + d : d;
  return 'https://wa.me/' + n;
}
window.fmtFone = fmtFone;
window.wppLink = wppLink;
