// src/dashboard.js
import { showToast } from './utils.js';
import { getSupa } from './supabase.js';

const BASE = 'https://pediway.vercel.app';
const CORES = ['#C0392B','#E74C3C','#E67E22','#F39C12','#27AE60','#16A085','#2980B9','#8E44AD','#2C3E50','#7F8C8D'];
const EMOJIS = ['🍔','🍕','🌮','🥪','🍜','🥗','🍗','🥩','🫕','🥘','🍱','🧆','🍣','🍦','🧁','🎂','🥤','🧃','☕','🧋'];

let emojiSel = '🍔';
let fotosFiles = [];
let logoFile = null;
let cropObjectUrl = null;
let cropOffsetX = 0, cropOffsetY = 0, cropZoom = 100;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let realtimeSub = null;

function getEstab() { return window._estab || JSON.parse(localStorage.getItem('pw_estab') || 'null'); }

// ── INIT ──────────────────────────────────────────────────
export async function initDashboard() {
  const estab = getEstab();
  if (!estab) return;

  // Preenche header
  const sn = document.getElementById('dash-store-name');
  if (sn) sn.textContent = estab.nome;
  const lu = document.getElementById('link-url');
  if (lu) lu.textContent = `${BASE}/${estab.slug}`;

  // Preenche configs
  preencherConfig(estab);

  // Logo
  if (estab.logo_url) {
    const img = document.getElementById('logo-preview-img');
    const txt = document.getElementById('logo-placeholder-text');
    if (img) { img.src = estab.logo_url; img.style.display = 'block'; }
    if (txt) txt.style.display = 'none';
  }

  // Status loja
  atualizarBadgeLoja(estab.aberto !== false);
  const cb = document.getElementById('cfg-aberto');
  if (cb) cb.checked = estab.aberto !== false;

  // Cores
  renderCores(estab.cor_primaria || '#C0392B');

  // Restaura aba salva
  const abasSalva = localStorage.getItem('pw_aba_ativa');
  if (abasSalva) {
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('data-tab') === abasSalva);
    if (btn) { setTimeout(() => showTab(abasSalva, btn), 100); }
  }

  // Dados
  if (!window._isDemo) {
    await renderCardapio();
    await renderFresquinho();
    await renderPedidos();
    iniciarRealtime();
  } else {
    renderCardapioDemo();
  }
  renderEmojiGrid();
}

function preencherConfig(estab) {
  const f = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  f('cfg-nome', estab.nome);
  f('cfg-slug', estab.slug);
  f('cfg-whats', estab.whatsapp || '');
  f('cfg-desc', estab.descricao || '');
  f('cfg-endereco', estab.endereco || '');
  // Tempo de entrega — select
  const tempoEl = document.getElementById('cfg-tempo');
  if (tempoEl && estab.tempo_entrega) {
    const opts = Array.from(tempoEl.options);
    const match = opts.find(o => o.value === estab.tempo_entrega);
    if (match) tempoEl.value = estab.tempo_entrega;
    else tempoEl.value = '30-45 min';
  }
  const cl = document.getElementById('cfg-link-preview');
  if (cl) cl.textContent = `${BASE}/${estab.slug}`;
  const ce = document.getElementById('cfg-entrega');
  if (ce) ce.checked = estab.faz_entrega !== false;
  const cr = document.getElementById('cfg-retirada');
  if (cr) cr.checked = estab.faz_retirada !== false;
}

function atualizarBadgeLoja(aberto) {
  const b = document.getElementById('loja-status-badge');
  if (!b) return;
  b.className = 'loja-status-badge ' + (aberto ? 'loja-aberta' : 'loja-fecháda');
  b.textContent = aberto ? 'Aberta' : 'Fecháda';
}

window.atualizarStatusLoja = function(aberto) {
  atualizarBadgeLoja(aberto);
};

// ── REALTIME ──────────────────────────────────────────────
let _ultimosPedidosIds = new Set();
let _pollingDashId = null;

function iniciarRealtime() {
  const estab = getEstab(); if (!estab || estab.id === 'demo') return;

  // Remove canal anterior
  if (realtimeSub) { try { getSupa().removeChannel(realtimeSub); } catch(e){} }

  // Tenta Realtime
  try {
    realtimeSub = getSupa()
      .channel('pedidos-dash-' + estab.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'pedidos',
        filter: `estabelecimento_id=eq.${estab.id}`,
      }, payload => {
        const p = payload.new;
        if (!_ultimosPedidosIds.has(p.id)) {
          _ultimosPedidosIds.add(p.id);
          // Espera 1s para evitar conflito com renderPedidos inicial
          setTimeout(() => {
            if (document.getElementById('pnc-' + p.id)) return; // já existe
            adicionarPedidoNovo(p);
            tocarSomNovoPedido(p.id);
            atualizarBadgePedidos();
          }, 1000);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'pedidos',
        filter: `estabelecimento_id=eq.${estab.id}`,
      }, () => { renderPedidos(); })
      .subscribe();
  } catch(e) { console.log('Realtime erro:', e); }

  // Polling de segurança a cada 8s (garante chegada mesmo sem Realtime)
  clearInterval(_pollingDashId);
  _pollingDashId = setInterval(async () => {
    const est = getEstab(); if (!est || est.id === 'demo') return;
    try {
      const { data } = await getSupa().from('pedidos')
        .select('id,cliente_nome,itens,total,status,created_at,endereco')
        .eq('estabelecimento_id', est.id)
        .eq('status', 'novo')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!data) return;
      data.forEach(p => {
        if (!_ultimosPedidosIds.has(p.id)) {
          _ultimosPedidosIds.add(p.id);
          adicionarPedidoNovo(p);
          tocarSomNovoPedido(p.id);
          atualizarBadgePedidos();
        }
      });
    } catch(e) {}
  }, 8000);
}

let notifLoop = null;
let notifPedidoId = null;

function tocarSomNovoPedido(pedidoId) {
  notifPedidoId = pedidoId;
  tocarNotifUmaVez();
}

function tocarNotifUmaVez() {
  try {
    const audio = new Audio('/notificacao.mp3');
    audio.volume = 0.8;
    audio.play().catch(() => {});
    // Agenda nova tocada em 5s se pedido ainda não resolvido
    clearTimeout(notifLoop);
    notifLoop = setTimeout(() => {
      // Verifica se ainda tem card de pedido novo na tela
      const lista = document.getElementById('pedidos-novos-lista');
      if (lista && lista.querySelector('.pedido-novo-card')) {
        tocarNotifUmaVez();
      }
    }, 5000);
  } catch(e) {}
}

function pararNotif() {
  clearTimeout(notifLoop);
  notifLoop = null;
}

function adicionarPedidoNovo(p) {
  const lista = document.getElementById('pedidos-novos-lista');
  if (!lista) return;
  // Remove placeholder
  const placeholder = lista.querySelector('div[style]');
  if (placeholder) placeholder.remove();

  const card = document.createElement('div');
  card.className = 'pedido-novo-card';
  card.id = `pnc-${p.id}`;
  const itens = Array.isArray(p.itens) ? p.itens.map(i=>`${i.qtd}x ${i.nome}`).join(', ') : '';
  card.innerHTML = `
    <div class="pnc-id">#${p.id.slice(-4).toUpperCase()}</div>
    <div class="pnc-cliente">${p.cliente_nome || 'Cliente'}</div>
    <div class="pnc-total">R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</div>
    <div style="font-size:0.72rem;color:#888;margin-bottom:8px">${itens}</div>
    <div class="pnc-actions">
      <button class="btn-aceitar" onclick="aceitarPedido('${p.id}')">Aceitar</button>
      <button class="btn-recusar" onclick="recusarPedido('${p.id}')">Recusar</button>
    </div>
    <button class="btn-ver-ped" onclick="verPedido('${p.id}')">Ver detalhes</button>`;
  lista.prepend(card);
  atualizarBadgePedidos();
}

function atualizarBadgePedidos() {
  const lista = document.getElementById('pedidos-novos-lista');
  const qtd = lista ? lista.querySelectorAll('.pedido-novo-card').length : 0;
  const badge = document.getElementById('badge-pedidos');
  const novosCount = document.getElementById('novos-count');
  if (badge) { badge.textContent = qtd; badge.classList.toggle('show', qtd > 0); }
  if (novosCount) novosCount.textContent = qtd;
}

window.aceitarPedido = async function(id) {
  const btn = document.querySelector(`#pnc-${id} .btn-aceitar`);
  if (btn) { btn.disabled=true; btn.textContent='Aceitando...'; }
  pararNotif();
  const { error } = await getSupa().from('pedidos').update({ status:'preparo' }).eq('id', id);
  if (error) { showToast('Erro ao aceitar pedido.','error'); if(btn){btn.disabled=false;btn.textContent='Aceitar';} return; }
  // Remove da area de novos
  const card = document.getElementById(`pnc-${id}`);
  if (card) {
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.8)';
    setTimeout(() => {
      card.remove();
      atualizarBadgePedidos();
      // Se nao tem mais novos, mostra placeholder
      const lista = document.getElementById('pedidos-novos-lista');
      if (lista && !lista.querySelector('.pedido-novo-card')) {
        lista.innerHTML = '<div style="color:#bbb;font-size:0.82rem;margin:auto">Nenhum pedido novo no momento</div>';
      }
    }, 300);
  }
  showToast('Pedido aceito! Cliente será notificado.');
  await renderPedidos();
};

window.recusarPedido = async function(id) {
  if (!confirm('Recusar este pedido?')) return;
  pararNotif();
  const { error } = await getSupa().from('pedidos').update({ status:'recusado' }).eq('id', id);
  if (error) return showToast('Erro ao recusar pedido.','error');
  const card = document.getElementById(`pnc-${id}`);
  if (card) {
    card.style.transition = 'opacity 0.3s';
    card.style.opacity = '0';
    setTimeout(() => {
      card.remove();
      atualizarBadgePedidos();
      const lista = document.getElementById('pedidos-novos-lista');
      if (lista && !lista.querySelector('.pedido-novo-card')) {
        lista.innerHTML = '<div style="color:#bbb;font-size:0.82rem;margin:auto">Nenhum pedido novo no momento</div>';
      }
    }, 300);
  }
  showToast('Pedido recusado.');
  await renderPedidos();
};

window.verPedido = async function(id) {
  const { data: p } = await getSupa().from('pedidos').select('*').eq('id', id).maybeSingle();
  if (!p) return;
  const body = document.getElementById('modal-pedido-body');
  if (!body) return;
  const itens = Array.isArray(p.itens) ? p.itens : [];
  const total = Number(p.total || 0);
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between">
        <strong>#${p.id.slice(-4).toUpperCase()}</strong>
        <span class="pedido-status status-${p.status||'novo'}">${{novo:'NOVO',preparo:'PREPARO',pronto:'PRONTO',recusado:'RECUSADO'}[p.status]||'NOVO'}</span>
      </div>
      <div><b>Cliente:</b> ${p.cliente_nome || '-'}</div>
      <div><b>WhatsApp:</b> ${p.cliente_whats || '-'}</div>
      <div><b>Tipo:</b> ${p.endereco || 'Retirada'}</div>
      ${p.observacao ? `<div><b>Obs:</b> ${p.observacao}</div>` : ''}
      <hr style="border:none;border-top:1px solid var(--border)">
      ${itens.map(i=>`<div style="display:flex;justify-content:space-between"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(i.preco*i.qtd).toFixed(2).replace('.',',')}</span></div>`).join('')}
      <hr style="border:none;border-top:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;font-weight:800"><span>Total</span><span>R$ ${total.toFixed(2).replace('.',',')}</span></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        ${p.status==='novo'?`<button class="btn-ped-aceitar" onclick="aceitarPedido('${p.id}');fecharModalPedido()">Aceitar</button><button class="btn-ped-recusar" onclick="recusarPedido('${p.id}');fecharModalPedido()">Recusar</button>`:''}
        ${p.status==='preparo'?`<button class="btn-ped-aceitar" onclick="marcarPronto('${p.id}')">Marcar como pronto</button>`:''}
        <button class="btn-ped-imprimir" onclick="imprimirPedido('${p.id}')">🖨️ Imprimir</button>
      </div>
    </div>`;
  document.getElementById('modal-pedido').classList.add('open');
};

window.fecharModalPedido = () => document.getElementById('modal-pedido')?.classList.remove('open');

window.marcarPronto = async function(id) {
  const { error } = await getSupa().from('pedidos').update({ status:'pronto' }).eq('id', id);
  if (error) return showToast('Erro ao atualizar pedido.','error');
  fecharModalPedido();
  showToast('Pedido marcado como pronto! Cliente será notificado.');
  await renderPedidos();
};

window.imprimirPedido = async function(id) {
  const { data: p } = await getSupa().from('pedidos').select('*').eq('id', id).maybeSingle();
  if (!p) return;
  const estab = getEstab();
  const itens = Array.isArray(p.itens) ? p.itens : [];
  const total = Number(p.total || 0);
  const area = document.getElementById('print-area');
  if (!area) return;
  area.innerHTML = `
    <div class="notinhá">
      <div class="notinhá-header">
        <div class="notinhá-logo">PEDIWAY</div>
        <div class="notinhá-sub">${estab?.nome || ''}</div>
      </div>
      <div class="notinhá-linhá"><span>Pedido</span><strong>#${p.id.slice(-4).toUpperCase()}</strong></div>
      <div class="notinhá-linhá"><span>Cliente</span><span>${p.cliente_nome || '-'}</span></div>
      <div class="notinhá-linhá"><span>WhatsApp</span><span>${p.cliente_whats || '-'}</span></div>
      <div class="notinhá-linhá"><span>Entrega</span><span>${p.endereco || 'Retirada'}</span></div>
      ${p.observacao ? `<div class="notinhá-linhá"><span>Obs</span><span>${p.observacao}</span></div>` : ''}
      <hr class="notinhá-divider">
      ${itens.map(i=>`<div class="notinhá-linhá"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(i.preco*i.qtd).toFixed(2).replace('.',',')}</span></div>`).join('')}
      <hr class="notinhá-divider">
      <div class="notinhá-total"><span>TOTAL</span><span>R$ ${total.toFixed(2).replace('.',',')}</span></div>
      <div style="text-align:center;margin-top:12px;font-size:0.65rem;color:#aaa">Obrigado! Feito com PEDIWAY</div>
    </div>`;
  area.style.display = 'block';
  window.print();
  setTimeout(() => { area.style.display = 'none'; area.innerHTML = ''; }, 1000);
};

// ── PEDIDOS ───────────────────────────────────────────────
// Busca de pedidos
window.buscarPedidos = function(termo) {
  const cards = document.querySelectorAll('#todos-pedidos .pedido-card');
  const t = (termo||'').toLowerCase().trim();
  cards.forEach(card => {
    const txt = card.textContent.toLowerCase();
    card.style.display = (!t || txt.includes(t)) ? '' : 'none';
  });
};

async function renderPedidos() {
  const estab = getEstab(); if (!estab) return;
  const { data } = await getSupa().from('pedidos').select('*')
    .eq('estabelecimento_id', estab.id)
    .order('created_at', { ascending: false }).limit(50);

  const hoje = new Date().toDateString();
  const pedHoje = (data || []).filter(p => new Date(p.created_at).toDateString() === hoje);
  const fatHoje = pedHoje.reduce((s, p) => s + Number(p.total || 0), 0);

  const sp = document.getElementById('stat-pedidos');
  const sf = document.getElementById('stat-faturamento');
  if (sp) sp.textContent = pedHoje.length;
  if (sf) sf.textContent = `R$ ${fatHoje.toFixed(2).replace('.', ',')}`;

  const card = p => {
    const cls = { novo:'status-novo', preparo:'status-preparo', pronto:'status-pronto', recusado:'status-recusado' }[p.status] || 'status-novo';
    const lbl = { novo:'NOVO', preparo:'PREPARO', pronto:'PRONTO', recusado:'RECUSADO' }[p.status] || 'NOVO';
    const min = Math.floor((Date.now() - new Date(p.created_at)) / 60000);
    return `<div class="pedido-card">
      <div class="pedido-top">
        <div><div class="pedido-id">#${p.id.slice(-4).toUpperCase()} - ${p.cliente_nome||'Cliente'}</div>
        <div class="pedido-tempo">há ${min<1?'menos de 1':min} min</div></div>
        <span class="pedido-status ${cls}">${lbl}</span>
      </div>
      <div class="pedido-itens">${Array.isArray(p.itens)?p.itens.map(i=>`${i.qtd}x ${i.nome}`).join(' - '):''}</div>
      <div class="pedido-total">R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</div>
      <div class="pedido-actions">
        ${p.status==='novo'?`<button class="btn-ped-aceitar" onclick="aceitarPedido('${p.id}')">Aceitar</button><button class="btn-ped-recusar" onclick="recusarPedido('${p.id}')">Recusar</button>`:''}
        ${p.status==='preparo'?`<button class="btn-ped-aceitar" onclick="marcarPronto('${p.id}')">Marcar pronto</button>`:''}
        <button class="btn-ped-imprimir" onclick="verPedido('${p.id}')">Ver mais</button>
        <button class="btn-ped-imprimir" onclick="imprimirPedido('${p.id}')">Imprimir</button>
      </div>
    </div>`;
  };

  const lu = document.getElementById('ultimos-pedidos');
  const td = document.getElementById('todos-pedidos');

  // Carrega novos pedidos na area de destaque
  const novos = (data || []).filter(p => p.status === 'novo');
  const lista = document.getElementById('pedidos-novos-lista');
  if (lista) {
    if (novos.length) {
      // Marca todos os novos já carregados como conhecidos
      novos.forEach(p => _ultimosPedidosIds.add(p.id));
      lista.innerHTML = novos.map(p => {
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
      }).join('');
    } else {
      lista.innerHTML = '<div style="color:#bbb;font-size:0.82rem;margin:auto">Nenhum pedido novo no momento</div>';
    }
    atualizarBadgePedidos();
  }

  if (lu && pedHoje.length) lu.innerHTML = pedHoje.slice(0,3).map(card).join('');
  if (td) td.innerHTML = data?.length ? data.map(card).join('') : '<div class="empty-state-light"><span>📋</span><p>Nenhum pedido ainda.</p></div>';
}

// ── CARDÁPIO ──────────────────────────────────────────────
async function renderCardapio() {
  const estab = getEstab();
  const grid  = document.getElementById('cardapio-grid');
  const stat  = document.getElementById('stat-itens');
  if (!grid || !estab) return;
  const { data } = await getSupa().from('produtos').select('*')
    .eq('estabelecimento_id', estab.id).order('created_at', { ascending:false });
  if (stat) stat.textContent = data?.length || 0;
  if (!data?.length) { grid.innerHTML = '<div class="empty-state-light" style="grid-column:1/-1"><span>🍽️</span><p>Nenhum item ainda.</p></div>'; return; }
  grid.innerHTML = data.map(p => `
    <div class="item-card">
      <div class="item-card-img">
        ${p.foto_url?`<img class="item-img" src="${p.foto_url}" alt="${p.nome}">`:`<div class="item-emoji-bg">${p.emoji||'🍔'}</div>`}
        <span class="item-disponivel">${p.disponivel?'Disponível':'Indisponível'}</span>
        ${p.promocao?`<span class="item-promo-badge">Promoção</span>`:''}
      </div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria||'SEM CATEGORIA'}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-desc-text">${p.descricao||''}</div>
        <div class="item-footer">
          <div>${p.promocao&&p.preco_original?`<div class="item-preco-original">R$ ${Number(p.preco_original).toFixed(2).replace('.',',')}</div>`:''}<div class="item-preco">R$ ${Number(p.preco).toFixed(2).replace('.',',')}</div></div>
          <div class="item-acoes">
            <button class="btn-icon" onclick="editarItem('${p.id}')" title="Editar">✏️</button>
            <button class="btn-icon danger" onclick="deletarItem('${p.id}')" title="Remover">🗑️</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderCardapioDemo() {
  const grid = document.getElementById('cardapio-grid');
  const stat = document.getElementById('stat-itens');
  if (stat) stat.textContent = '3';
  if (!grid) return;
  const demo = [
    {nome:'X-Burguer Especial',categoria:'LANCHES',preco:28.90,emoji:'🍔',promocao:false},
    {nome:'Batata Frita Grande',categoria:'ACOMPANHAMENTOS',preco:14.90,emoji:'🍟',promocao:false},
    {nome:'Refrigerante 350ml',categoria:'BEBIDAS',preco:7.90,emoji:'🥤',promocao:true,preco_original:9.90},
  ];
  grid.innerHTML = demo.map(p=>`
    <div class="item-card">
      <div class="item-card-img"><div class="item-emoji-bg">${p.emoji}</div><span class="item-disponivel">Disponível</span></div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-footer"><div><div class="item-preco">R$ ${p.preco.toFixed(2).replace('.',',')}</div></div></div>
      </div>
    </div>`).join('');
}

function renderEmojiGrid() {
  const grid = document.getElementById('emoji-grid'); if (!grid) return;
  grid.innerHTML = EMOJIS.map(e=>`<button class="emoji-btn ${e===emojiSel?'selected':''}" onclick="selecionarEmoji('${e}',this)">${e}</button>`).join('');
}

function renderCores(corAtiva) {
  const grid = document.getElementById('cores-grid'); if (!grid) return;
  grid.innerHTML = CORES.map(cor=>`
    <div class="cor-opcao ${cor===corAtiva?'ativa':''}" style="background:${cor}" onclick="selecionarCor('${cor}',this)" title="${cor}"></div>`).join('');
  aplicarCorDash(corAtiva);
}

function aplicarCorDash(cor) {
  // Aplica apenas no dashboard — não na landing page
  const dash = document.querySelector('[data-screen="s-dash"]');
  if (dash) {
    dash.style.setProperty('--red', cor);
    dash.style.setProperty('--red-dark', cor);
    dash.style.setProperty('--red-light', hexToRgba(cor, 0.1));
  }
  // Também nas abas/nav
  document.querySelectorAll('.dash-nav,.tab-content,.config-card,.dash-container,.header-light').forEach(el=>{
    el.style.setProperty('--red', cor);
  });
}

function hexToRgba(hex, alphá) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alphá})`;
}

window.selecionarCor = function(cor, el) {
  document.querySelectorAll('.cor-opcao').forEach(e=>e.classList.remove('ativa'));
  el.classList.add('ativa');
  aplicarCorDash(cor);
};

// ── MODAL ITEM ────────────────────────────────────────────
export function abrirModalItem() {
  if (window._isDemo) return showToast('No demo não é possível salvar. Crie sua conta!');
  document.getElementById('modal-item').classList.add('open');
  ['item-nome','item-desc','item-cat','item-preco','item-preco-orig'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const promo=document.getElementById('item-promocao'); if(promo)promo.checked=false;
  const grp=document.getElementById('preco-orig-group'); if(grp)grp.style.display='none';
  fotosFiles=[]; renderFotosGrid();
  emojiSel='🍔'; renderEmojiGrid();
}
export function fecharModal() { document.getElementById('modal-item').classList.remove('open'); }
export function fecharModalFora(e) { if(e.target.id==='modal-item')fecharModal(); }
export function selecionarEmoji(emoji,btn) {
  emojiSel=emoji;
  document.querySelectorAll('.emoji-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

// ── FOTOS MULTIPLAS ───────────────────────────────────────
export function previewFotos(event) {
  const files = Array.from(event.target.files).slice(0, 5-fotosFiles.length);
  files.forEach(f=>{ if(fotosFiles.length<5) fotosFiles.push(f); });
  renderFotosGrid();
  event.target.value='';
}

function renderFotosGrid() {
  const grid=document.getElementById('fotos-grid'); if(!grid) return;
  let html=fotosFiles.map((f,i)=>`
    <div class="foto-thumb-item">
      <img src="${URL.createObjectURL(f)}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;display:block">
      ${i===0?`<div style="position:absolute;top:3px;left:3px;background:var(--red);color:#fff;font-size:0.55rem;font-weight:700;padding:2px 5px;border-radius:4px">PRINCIPAL</div>`:''}
      <button onclick="removerFotoItem(${i})" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,0.6);border:none;color:#fff;width:20px;height:20px;border-radius:50%;font-size:0.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center">x</button>
    </div>`).join('');
  if(fotosFiles.length<5) html+=`<div class="foto-add-btn" onclick="document.getElementById('foto-input').click()"><span style="font-size:1.5rem">📷</span><span style="font-size:0.75rem;color:#aaa">Adicionar</span></div>`;
  grid.innerHTML=html;
}

window.removerFotoItem=function(i){ fotosFiles.splice(i,1); renderFotosGrid(); };
export function previewFoto(event){ previewFotos(event); }

export async function salvarItem() {
  const estab=getEstab(); if(!estab) return showToast('Faça login novamente.','error');
  const nome=document.getElementById('item-nome')?.value.trim();
  const preco=parseFloat(document.getElementById('item-preco')?.value);
  if(!nome) return showToast('Digite o nome do item.','error');
  if(isNaN(preco)) return showToast('Digite o preco.','error');
  const btn=document.querySelector('#modal-item .btn-primary');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  try {
    let foto_url=null;
    if(fotosFiles.length>0){
      const file=fotosFiles[0];
      const ext=file.name.split('.').pop();
      const path=`${estab.id}/${Date.now()}.${ext}`;
      const{error:upErr}=await getSupa().storage.from('fotos').upload(path,file,{upsert:true});
      if(upErr) throw new Error('Erro no upload: '+upErr.message);
      foto_url=getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
    }
    const promocao=document.getElementById('item-promocao')?.checked||false;
    const preco_orig=parseFloat(document.getElementById('item-preco-orig')?.value)||null;
    const{error}=await getSupa().from('produtos').insert({
      estabelecimento_id:estab.id,nome,
      descricao:document.getElementById('item-desc')?.value.trim(),
      categoria:document.getElementById('item-cat')?.value.trim().toUpperCase(),
      preco,preco_original:promocao?preco_orig:null,
      foto_url,emoji:emojiSel,disponivel:true,promocao,
    });
    if(error) throw new Error(error.message);
    await renderCardapio();fecharModal();showToast('Item adicionado!');
  } catch(e){showToast(e.message,'error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Salvar item';}}
}

export async function deletarItem(id){
  if(!confirm('Remover este item?'))return;
  await getSupa().from('produtos').delete().eq('id',id);
  await renderCardapio();showToast('Item removido.');
}

export async function editarItem(id){
  const estab=getEstab(); if(!estab) return;
  const{data:p}=await getSupa().from('produtos').select('*').eq('id',id).maybeSingle();
  if(!p)return;

  // Reseta o modal primeiro
  document.getElementById('modal-item').classList.add('open');
  fotosFiles=[];

  setTimeout(()=>{
    // Preenche campos
    const set=(sel,val)=>{const el=document.getElementById(sel);if(el&&val!=null)el.value=val;};
    set('item-nome', p.nome);
    set('item-desc', p.descricao||'');
    set('item-cat',  p.categoria||'');
    set('item-preco', p.preco);
    set('item-preco-orig', p.preco_original||'');
    const pr=document.getElementById('item-promocao');
    if(pr){pr.checked=!!p.promocao; const g=document.getElementById('preco-orig-group'); if(g)g.style.display=p.promocao?'flex':'none';}

    // Emoji
    emojiSel=p.emoji||'🍔';
    document.querySelectorAll('.emoji-btn').forEach(b=>{
      b.classList.toggle('selected', b.textContent===emojiSel);
    });

    // Foto existente no grid
    const grid=document.getElementById('fotos-grid');
    if(grid && p.foto_url){
      grid.innerHTML=`
        <div class="foto-thumb-item" style="position:relative">
          <img src="${p.foto_url}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;display:block">
          <div style="position:absolute;top:3px;left:3px;background:var(--red);color:#fff;font-size:0.55rem;font-weight:700;padding:2px 5px;border-radius:4px">ATUAL</div>
          <button onclick="this.closest('.foto-thumb-item').remove()" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,0.6);border:none;color:#fff;width:20px;height:20px;border-radius:50%;font-size:0.7rem;cursor:pointer">✕</button>
        </div>
        <div class="foto-add-btn" onclick="document.getElementById('foto-input').click()">
          <span style="font-size:1.5rem">📷</span>
          <span style="font-size:0.75rem;color:#aaa">Nova foto</span>
        </div>`;
    }

    // Botão salvar
    const btn=document.querySelector('#modal-item .btn-primary');
    if(btn){
      btn.textContent='Salvar alterações';
      btn.onclick=async()=>{
        const nome=document.getElementById('item-nome')?.value.trim();
        const preco=parseFloat(document.getElementById('item-preco')?.value);
        if(!nome||isNaN(preco))return showToast('Preencha nome e preço.','error');
        btn.disabled=true; btn.textContent='Salvando...';
        try {
          let foto_url=p.foto_url||null;
          if(fotosFiles.length>0){
            const file=fotosFiles[0];
            const ext=file.name.split('.').pop();
            const path=`${estab.id}/${Date.now()}.${ext}`;
            const{error:upErr}=await getSupa().storage.from('fotos').upload(path,file,{upsert:true});
            if(upErr)throw new Error('Erro upload: '+upErr.message);
            foto_url=getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
          }
          // Se o thumb da foto atual foi removido, limpa a foto
          const thumbAtual=document.querySelector('#fotos-grid .foto-thumb-item');
          if(!thumbAtual && fotosFiles.length===0) foto_url=null;

          const promocao=document.getElementById('item-promocao')?.checked||false;
          const preco_orig=parseFloat(document.getElementById('item-preco-orig')?.value)||null;
          const{error}=await getSupa().from('produtos').update({
            nome,
            descricao:document.getElementById('item-desc')?.value.trim(),
            categoria:document.getElementById('item-cat')?.value.trim().toUpperCase(),
            preco, preco_original:promocao?preco_orig:null,
            emoji:emojiSel, promocao, foto_url,
          }).eq('id',id);
          if(error)throw new Error(error.message);
          await renderCardapio(); fecharModal(); showToast('Item atualizado!');
        } catch(e){ showToast(e.message,'error'); }
        finally{ btn.disabled=false; btn.textContent='Salvar alterações'; }
      };
    }
  }, 100);
}

// ── FRESQUINHO ────────────────────────────────────────────
async function renderFresquinho() {
  const estab=getEstab();const grid=document.getElementById('fresquinho-grid');
  if(!grid||!estab)return;
  const{data}=await getSupa().from('fresquinhos').select('*')
    .eq('estabelecimento_id',estab.id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false});
  if(!data?.length){grid.innerHTML='<div class="empty-state-light"><span>✨</span><p>Nenhum conteúdo postado ainda.</p></div>';return;}
  grid.innerHTML='<div class="fresh-stories-row">'+data.map(f=>{
    const rest=new Date(f.expires_at)-new Date();
    const h=Math.floor(rest/3600000),m=Math.floor((rest%3600000)/60000);
    return `<div class="fresh-story-item">
      <div class="fresh-story-thumb" onclick="abrirStoryDash('${f.url}','${f.tipo||'foto'}')">
        ${f.tipo==='video'?`<video src="${f.url}" muted playsinline loop style="width:100%;height:100%;object-fit:cover"></video><div class="fresh-play">▶</div>`:
          `<img src="${f.url}" alt="Fresquinho" style="width:100%;height:100%;object-fit:cover">`}
        <div class="fresh-overlay"></div>
        <div class="fresh-timer-badge">⏱ ${h>0?h+'h '+m+'min':m+'min'}</div>
      </div>
      <button class="fresh-remove-btn" onclick="removerFresquinho('${f.id}')">🗑️</button>
    </div>`;
  }).join('')+'</div>';
}

// Arquivo pendente de upload (após crop)
let freshFilePendente = null;

export function postarFresquinho(event){
  const file=event.target.files[0];
  if(!file) return;
  if(file.size>50*1024*1024)return showToast('Max. 50MB','error');
  // Upload direto sem crop
  uploadFresquinho(file);
  event.target.value='';
}

function abrirCropFresh(file) {
  const url = URL.createObjectURL(file);
  // Reutiliza o modal de crop mas para fresquinho
  const overlay = document.getElementById('crop-overlay');
  const img = document.getElementById('crop-img');
  if (!overlay || !img) { uploadFresquinho(file); return; }
  cropObjectUrl = url;
  cropOffsetX = 0; cropOffsetY = 0; cropZoom = 100;
  img.src = url;
  img.style.transform = 'scale(1) translate(0px,0px)';
  const zoomEl = document.getElementById('crop-zoom');
  if (zoomEl) zoomEl.value = 100;
  // Troca o confirmar para fresquinho
  const btnOk = document.querySelector('.btn-crop-ok');
  if (btnOk) { btnOk.textContent = 'Postar'; btnOk.onclick = confirmarCropFresh; }
  overlay.classList.add('open');
  // Drag
  const preview = document.getElementById('crop-preview');
  if (preview) {
    preview.onmousedown = e=>{ isDragging=true; dragStartX=e.clientX-cropOffsetX; dragStartY=e.clientY-cropOffsetY; };
    preview.ontouchstart = e=>{ isDragging=true; dragStartX=e.touches[0].clientX-cropOffsetX; dragStartY=e.touches[0].clientY-cropOffsetY; };
    document.onmousemove = e=>{ if(!isDragging)return; cropOffsetX=e.clientX-dragStartX; cropOffsetY=e.clientY-dragStartY; aplicarCrop(); };
    document.ontouchmove = e=>{ if(!isDragging)return; cropOffsetX=e.touches[0].clientX-dragStartX; cropOffsetY=e.touches[0].clientY-dragStartY; aplicarCrop(); };
    document.onmouseup = ()=>isDragging=false;
    document.ontouchend = ()=>isDragging=false;
  }
}

window.confirmarCropFresh = async function() {
  document.getElementById('crop-overlay')?.classList.remove('open');
  const btnOk = document.querySelector('.btn-crop-ok');
  if (btnOk) { btnOk.textContent = 'Usar esta foto'; btnOk.onclick = window.confirmarCrop; }
  if (freshFilePendente) { await uploadFresquinho(freshFilePendente); freshFilePendente = null; }
};

async function uploadFresquinho(file) {
  const estab = getEstab(); if (!estab) return;
  showToast('Enviando...');
  const ext = file.name.split('.').pop();
  const path = `${estab.id}/fresh_${Date.now()}.${ext}`;
  const tipo = file.type.startsWith('video')?'video':'foto';
  const { error } = await getSupa().storage.from('fotos').upload(path, file, { upsert: true });
  if (error) return showToast('Erro: '+error.message, 'error');
  const url = getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
  await getSupa().from('fresquinhos').insert({
    estabelecimento_id: estab.id, url, tipo,
    expires_at: new Date(Date.now()+4*60*60*1000).toISOString(),
  });
  await renderFresquinho();
  showToast('Postado! Disponível por 4h');
}

export async function removerFresquinho(id){
  await getSupa().from('fresquinhos').delete().eq('id',id);
  await renderFresquinho();showToast('Removido.');
}

window.abrirStoryDash=function(url,tipo){
  const o=document.createElement('div');
  o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  o.onclick=()=>o.remove();
  o.innerHTML=tipo==='video'?`<video src="${url}" controls autoplay style="max-width:90vw;max-height:90vh;border-radius:12px"></video>`:
    `<img src="${url}" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain">`;
  const c=document.createElement('button');
  c.style.cssText='position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.15);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:1.1rem;cursor:pointer';
  c.textContent='x';c.onclick=e=>{e.stopPropagation();o.remove();};
  o.appendChild(c);document.body.appendChild(o);
};

// ── LOGO CROP (drag) ──────────────────────────────────────
export function previewLogo(event){
  const file=event.target.files[0];if(!file)return;
  logoFile=file;abrirCropLogo({target:{files:[file]}});
}

window.abrirCropLogo=function(event){
  const file=event.target.files[0];if(!file)return;
  logoFile=file;
  cropOffsetX=0;cropOffsetY=0;cropZoom=100;
  cropObjectUrl=URL.createObjectURL(file);
  const img=document.getElementById('crop-img');
  if(img){img.src=cropObjectUrl;img.style.transform='scale(1) translate(0px,0px)';}
  const zoom=document.getElementById('crop-zoom');if(zoom)zoom.value=100;
  document.getElementById('crop-overlay')?.classList.add('open');
  event.target.value='';
  // Drag na preview
  const preview=document.getElementById('crop-preview');
  if(preview){
    preview.onmousedown=e=>{ isDragging=true; dragStartX=e.clientX-cropOffsetX; dragStartY=e.clientY-cropOffsetY; };
    preview.ontouchstart=e=>{ isDragging=true; dragStartX=e.touches[0].clientX-cropOffsetX; dragStartY=e.touches[0].clientY-cropOffsetY; };
    document.onmousemove=e=>{ if(!isDragging)return; cropOffsetX=e.clientX-dragStartX; cropOffsetY=e.clientY-dragStartY; aplicarCrop(); };
    document.ontouchmove=e=>{ if(!isDragging)return; cropOffsetX=e.touches[0].clientX-dragStartX; cropOffsetY=e.touches[0].clientY-dragStartY; aplicarCrop(); };
    document.onmouseup=()=>isDragging=false;
    document.ontouchend=()=>isDragging=false;
  }
};

window.aplicarCrop=function(){
  const zoom=document.getElementById('crop-zoom')?.value||100;
  cropZoom=Number(zoom);
  const img=document.getElementById('crop-img');
  if(img) img.style.transform=`scale(${cropZoom/100}) translate(${cropOffsetX}px,${cropOffsetY}px)`;
};

window.fecharCrop=function(){ document.getElementById('crop-overlay')?.classList.remove('open'); logoFile=null; };

window.confirmarCrop=function(){
  const img=document.getElementById('logo-preview-img');
  const txt=document.getElementById('logo-placeholder-text');
  if(img&&cropObjectUrl){
    img.src=cropObjectUrl;
    img.style.transform=`scale(${cropZoom/100}) translate(${cropOffsetX}px,${cropOffsetY}px)`;
    img.style.display='block';
  }
  if(txt)txt.style.display='none';
  document.getElementById('crop-overlay')?.classList.remove('open');
};

// ── CONFIGURACOES ─────────────────────────────────────────
export async function salvarConfig(){
  if(window._isDemo)return showToast('No demo não é possível salvar. Crie sua conta!');
  const estab=getEstab();if(!estab)return;
  const nome=document.getElementById('cfg-nome')?.value.trim();
  const slug=document.getElementById('cfg-slug')?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-');
  const whats=document.getElementById('cfg-whats')?.value.trim();
  const desc=document.getElementById('cfg-desc')?.value.trim();
  const endereco=document.getElementById('cfg-endereco')?.value.trim();
  const tempo=document.getElementById('cfg-tempo')?.value.trim();
  const aberto=document.getElementById('cfg-aberto')?.checked;
  const faz_entrega=document.getElementById('cfg-entrega')?.checked;
  const faz_retirada=document.getElementById('cfg-retirada')?.checked;
  const corAtiva=document.querySelector('.cor-opcao.ativa')?.style.background||estab.cor_primaria||'#C0392B';

  if(!nome||!slug)return showToast('Preenchá nome e link.','error');

  const btn=document.querySelector('[onclick="salvarConfig()"]');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}

  try{
    if(slug!==estab.slug){
      const{data:existe}=await getSupa().from('estabelecimentos').select('id').eq('slug',slug).maybeSingle();
      if(existe)throw new Error('Esse link já está em uso.');
    }
    let logo_url=estab.logo_url||null;
    if(logoFile){
      const ext=logoFile.name.split('.').pop();
      const path=`${estab.id}/logo.${ext}`;
      const{error:upErr}=await getSupa().storage.from('fotos').upload(path,logoFile,{upsert:true});
      if(upErr)throw new Error('Erro no upload da logo: '+upErr.message);
      logo_url=getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
      logoFile=null;
    }
    const{error}=await getSupa().from('estabelecimentos').update({
      nome,slug,whatsapp:whats,descricao:desc,endereco,
      tempo_entrega:tempo,aberto,faz_entrega,faz_retirada,
      cor_primaria:corAtiva,logo_url,
    }).eq('id',estab.id);
    if(error)throw new Error(error.message);
    const novoEstab={...estab,nome,slug,whatsapp:whats,descricao:desc,endereco,tempo_entrega:tempo,aberto,faz_entrega,faz_retirada,cor_primaria:corAtiva,logo_url};
    window._estab=novoEstab;localStorage.setItem('pw_estab',JSON.stringify(novoEstab));
    document.getElementById('dash-store-name').textContent=nome;
    document.getElementById('link-url').textContent=`${BASE}/${slug}`;
    document.getElementById('cfg-link-preview').textContent=`${BASE}/${slug}`;
    atualizarBadgeLoja(aberto);
    showToast('Configurações salvas!');
  }catch(e){showToast(e.message,'error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Salvar configuracoes';}}
}

// ── GLOBAIS ───────────────────────────────────────────────
window.abrirModalItem    = abrirModalItem;
window.fecharModal       = fecharModal;
window.fecharModalFora   = fecharModalFora;
window.fecharModalPedido = fecharModalPedido;
window.fecharModal       = fecharModal;
window.fecharModalFora   = fecharModalFora;
window.previewFotos      = previewFotos;
window.previewFoto       = previewFoto;
window.selecionarEmoji   = selecionarEmoji;
window.salvarItem        = salvarItem;
window.deletarItem       = deletarItem;
  window.editarItem        = editarItem;
window.postarFresquinho  = postarFresquinho;
window.removerFresquinho = removerFresquinho;
window.salvarConfig      = salvarConfig;
window.initDashboard     = initDashboard;
window.previewLogo       = previewLogo;
window.renderPedidos     = renderPedidos;
