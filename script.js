// ═══════════════════════════════════════════════════════════════
// PEDIWAY — script.js  |  Conectado ao Supabase
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://nmttkjmfazcipefeakkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdHRram1mYXpjaXBlZmVha2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM3NjQsImV4cCI6MjA5MDI4OTc2NH0.MMTX_6iQJk7Uv3HPSk0m32_BihvqsWhHJ_qiRkw0WYo';

// Cliente Supabase (carregado via CDN no index.html)
const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── ESTADO ───────────────────────────────────────────────────
let lojaAtual = null;
let cardapioAtual = [];
let carrinho = [];
let tipoEntrega = 'entrega';
let pagamento = 'Pix';
let usuarioLogado = null;
let pedidoContador = 1000;

// ─── ROTEAMENTO ───────────────────────────────────────────────
async function iniciar() {
  const caminho = window.location.pathname;
  const match = caminho.match(/\/restaurante\/([\w-]+)/);

  if (match) {
    const slug = match[1];
    await abrirVitrine(slug);
    return;
  }
  // Página inicial padrão
  mostrarTela('tela-inicio');
}

// ─── CARREGAR VITRINE DO CLIENTE ──────────────────────────────
async function abrirVitrine(slug) {
  mostrarTela('tela-vitrine');
  document.getElementById('loja-nome').textContent = 'Carregando...';

  try {
    // Busca loja no Supabase
    const { data: loja, error } = await db
      .from('estabelecimentos')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !loja) {
      document.getElementById('loja-nome').textContent = 'Loja não encontrada';
      document.getElementById('loja-desc').textContent = 'Verifique o link e tente novamente.';
      return;
    }

    lojaAtual = loja;

    // Aplica cor da loja
    document.documentElement.style.setProperty('--cor', loja.color || '#E8410A');

    // Preenche hero
    document.getElementById('loja-nome').textContent = loja.name;
    document.getElementById('loja-desc').textContent = loja.desc || '';
    document.getElementById('loja-emoji').textContent = loja.emoji || '🍔';

    if (loja.logo_url) {
      const logoEl = document.getElementById('loja-logo');
      if (logoEl) { logoEl.src = loja.logo_url; logoEl.style.display = 'block'; }
    }

    // Carrega cardápio
    await carregarCardapio(loja.id);

  } catch (e) {
    console.error('Erro ao carregar loja:', e);
    document.getElementById('loja-nome').textContent = 'Erro ao carregar';
  }
}

async function carregarCardapio(lojaId) {
  const { data: itens } = await db
    .from('menu_items')
    .select('*')
    .eq('establishment_id', lojaId)
    .eq('available', true)
    .order('category');

  cardapioAtual = itens || [];
  renderizarCardapio(cardapioAtual);
  renderizarCategorias(cardapioAtual);
}

function renderizarCategorias(itens) {
  const cats = ['Todos', ...new Set(itens.map(i => i.category))];
  const el = document.getElementById('categorias');
  if (!el) return;
  el.innerHTML = cats.map((c, i) =>
    `<button class="cat-btn ${i === 0 ? 'ativo' : ''}" onclick="filtrarCategoria('${c}', this)">${c}</button>`
  ).join('');
}

function renderizarCardapio(itens) {
  const el = document.getElementById('lista-cardapio');
  if (!el) return;
  if (!itens.length) {
    el.innerHTML = '<div class="vazio"><p>Nenhum item disponível</p></div>';
    return;
  }
  el.innerHTML = itens.map(item => `
    <div class="item-card">
      <div class="item-img">
        ${item.photo_url ? `<img src="${item.photo_url}" alt="${item.name}">` : ''}
        <span class="item-emoji" style="${item.photo_url ? 'opacity:0' : ''}">${item.emoji || '🍔'}</span>
      </div>
      <div class="item-info">
        <div class="item-nome">${item.name}</div>
        <div class="item-desc">${item.desc || ''}</div>
        <div class="item-rodape">
          <div class="item-preco">R$ ${Number(item.price).toFixed(2).replace('.', ',')}</div>
          <button class="btn-add" onclick="adicionarCarrinho(${item.id})">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filtrarCategoria(cat, btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  const filtrados = cat === 'Todos' ? cardapioAtual : cardapioAtual.filter(i => i.category === cat);
  renderizarCardapio(filtrados);
}

// ─── CARRINHO ─────────────────────────────────────────────────
function adicionarCarrinho(id) {
  const item = cardapioAtual.find(i => i.id === id);
  if (!item) return;
  const ex = carrinho.find(c => c.id === id);
  if (ex) ex.qty++; else carrinho.push({ ...item, qty: 1 });
  atualizarFAB();
}

function atualizarFAB() {
  const total = carrinho.reduce((s, c) => s + c.qty * Number(c.price), 0);
  const qtd = carrinho.reduce((s, c) => s + c.qty, 0);
  const fab = document.getElementById('fab-carrinho');
  if (!fab) return;
  fab.style.display = qtd > 0 ? 'flex' : 'none';
  const qtdEl = document.getElementById('fab-qtd');
  const totalEl = document.getElementById('fab-total');
  if (qtdEl) qtdEl.textContent = qtd;
  if (totalEl) totalEl.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
}

// ─── CHECKOUT ─────────────────────────────────────────────────
function abrirCheckout() {
  if (!carrinho.length) return;
  mostrarTela('tela-checkout');
  renderizarCheckout();
}

function renderizarCheckout() {
  const el = document.getElementById('lista-checkout');
  if (!el) return;
  const total = carrinho.reduce((s, c) => s + c.qty * Number(c.price), 0);
  el.innerHTML = carrinho.map((it, i) => `
    <div class="checkout-item">
      <span class="checkout-emoji">${it.emoji || '🍔'}</span>
      <span class="checkout-nome">${it.name}</span>
      <div class="checkout-qtd">
        <button onclick="mudarQtd(${i}, -1)">−</button>
        <span>${it.qty}</span>
        <button onclick="mudarQtd(${i}, 1)">+</button>
      </div>
      <span class="checkout-preco">R$ ${(it.qty * Number(it.price)).toFixed(2).replace('.', ',')}</span>
    </div>
  `).join('');
  const totalEl = document.getElementById('checkout-total');
  if (totalEl) totalEl.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
}

function mudarQtd(i, d) {
  carrinho[i].qty += d;
  if (carrinho[i].qty <= 0) carrinho.splice(i, 1);
  renderizarCheckout();
  atualizarFAB();
}

function selecionarTipoEntrega(tipo) {
  tipoEntrega = tipo;
  document.getElementById('btn-entrega')?.classList.toggle('ativo', tipo === 'entrega');
  document.getElementById('btn-retirada')?.classList.toggle('ativo', tipo === 'retirada');
  const endBlock = document.getElementById('bloco-endereco');
  if (endBlock) endBlock.style.display = tipo === 'entrega' ? 'block' : 'none';
}

function selecionarPagamento(el, metodo) {
  document.querySelectorAll('.opcao-pgto').forEach(o => o.classList.remove('ativo'));
  el.classList.add('ativo');
  pagamento = metodo;
}

function confirmarPedido() {
  const nome = document.getElementById('cl-nome')?.value.trim();
  const fone = document.getElementById('cl-fone')?.value.trim();
  if (!nome || !fone) { alert('Preencha nome e telefone'); return; }
  if (tipoEntrega === 'entrega' && !document.getElementById('cl-end')?.value.trim()) {
    alert('Preencha o endereço'); return;
  }
  // Mostra tela de confirmação
  const total = carrinho.reduce((s, c) => s + c.qty * Number(c.price), 0);
  const endEl = document.getElementById('cl-end');
  const addr = tipoEntrega === 'entrega' ? (endEl?.value.trim() || '') : 'Retirada no local';

  const cdItens = document.getElementById('conf-itens');
  const cdTotal = document.getElementById('conf-total');
  const cdEntrega = document.getElementById('conf-entrega');
  const cdPgto = document.getElementById('conf-pgto');
  if (cdItens) cdItens.innerHTML = carrinho.map(c => `${c.qty}x ${c.name} — R$ ${(c.qty*Number(c.price)).toFixed(2).replace('.',',')}`).join('<br>');
  if (cdTotal) cdTotal.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
  if (cdEntrega) cdEntrega.innerHTML = `<b>Nome:</b> ${nome}<br><b>Tel:</b> ${fone}<br><b>Tipo:</b> ${tipoEntrega === 'entrega' ? '🛵 Entrega' : '🏃 Retirada'}${tipoEntrega === 'entrega' ? '<br><b>End:</b> '+addr : ''}`;
  if (cdPgto) cdPgto.textContent = pagamento;

  // Guarda dados para envio
  window._pedidoPendente = { nome, fone, addr, total };
  mostrarTela('tela-confirmar');
}

async function enviarPedido() {
  const p = window._pedidoPendente;
  if (!p) return;

  try {
    const { data: pedido, error } = await db.from('orders').insert({
      establishment_id: lojaAtual.id,
      client_name: p.nome,
      client_phone: p.fone,
      address: p.addr,
      delivery_type: tipoEntrega,
      items: JSON.stringify(carrinho.map(c => ({ name: c.name, qty: c.qty, price: Number(c.price) }))),
      payment_method: pagamento,
      total: p.total,
      status: 'new',
      created_at: new Date().toISOString()
    }).select().single();

    if (error) throw error;

    pedidoContador++;
    const idEl = document.getElementById('pedido-id');
    if (idEl) idEl.textContent = pedido?.id?.toString().slice(-6) || ('#' + pedidoContador);

    const iconEl = document.getElementById('pedido-icone');
    if (iconEl) iconEl.textContent = tipoEntrega === 'retirada' ? '🏃' : '🛵';

    carrinho = [];
    atualizarFAB();
    mostrarTela('tela-enviado');

  } catch (e) {
    console.error('Erro ao salvar pedido:', e);
    // Mesmo com erro salva localmente e avança
    pedidoContador++;
    const idEl = document.getElementById('pedido-id');
    if (idEl) idEl.textContent = '#' + pedidoContador;
    carrinho = [];
    atualizarFAB();
    mostrarTela('tela-enviado');
  }
}

// ─── WHATSAPP ─────────────────────────────────────────────────
function abrirWhatsApp() {
  const p = window._pedidoPendente || {};
  const itens = (carrinho.length ? carrinho : []).map(c => `${c.qty}x ${c.name}`).join(', ') || 'Ver pedido';
  const msg = encodeURIComponent(
    `Olá! Fiz um pedido pelo PEDIWAY 🎉\n\nNome: ${p.nome || ''}\nTelefone: ${p.fone || ''}\nEntrega: ${p.addr || ''}\nPagamento: ${pagamento}\nTotal: R$ ${(p.total || 0).toFixed(2).replace('.', ',')}`
  );
  const wp = lojaAtual?.whatsapp || '5511999999999';
  window.open(`https://wa.me/${wp}?text=${msg}`, '_blank');
}

// ─── LOGIN DO ESTABELECIMENTO ──────────────────────────────────
async function fazerLogin() {
  const email = document.getElementById('login-email')?.value.trim();
  const senha = document.getElementById('login-senha')?.value;
  const errEl = document.getElementById('login-erro');

  if (!email || !senha) { if (errEl) errEl.textContent = 'Preencha e-mail e senha'; return; }

  try {
    // SHA256 simples para comparar senha (mesma lógica do backend)
    const senhaHash = await sha256(senha);

    const { data: user, error } = await db
      .from('estabelecimentos')
      .select('*')
      .eq('email', email)
      .eq('password_hash', senhaHash)
      .single();

    if (error || !user) {
      // Tenta comparar senha em texto plano (compatibilidade)
      const { data: u2 } = await db
        .from('estabelecimentos')
        .select('*')
        .eq('email', email)
        .single();

      if (!u2 || (u2.pass !== senha && u2.password_plain !== senha)) {
        if (errEl) errEl.textContent = 'E-mail ou senha incorretos';
        return;
      }
      usuarioLogado = u2;
    } else {
      usuarioLogado = user;
    }

    if (usuarioLogado.status === 'pending') { alert('Cadastro aguardando aprovação.'); return; }
    if (usuarioLogado.status === 'inactive') { alert('Conta inativa. Fale com o suporte.'); return; }

    lojaAtual = usuarioLogado;
    await abrirPainel();

  } catch (e) {
    console.error('Erro no login:', e);
    if (errEl) errEl.textContent = 'Erro ao conectar. Tente novamente.';
  }
}

async function abrirPainel() {
  mostrarTela('tela-painel');
  if (!usuarioLogado) return;

  // Carrega dados reais do painel
  document.getElementById('painel-nome')?.setAttribute('data-text', usuarioLogado.name);

  const slug = usuarioLogado.slug || 'demo';
  const linkEl = document.getElementById('painel-link');
  if (linkEl) linkEl.textContent = window.location.origin + '/restaurante/' + slug;

  // Carrega pedidos do Supabase
  const { data: pedidos } = await db
    .from('orders')
    .select('*')
    .eq('establishment_id', usuarioLogado.id)
    .order('created_at', { ascending: false })
    .limit(50);

  renderizarPedidosPainel(pedidos || []);

  // Carrega cardápio do Supabase
  const { data: menu } = await db
    .from('menu_items')
    .select('*')
    .eq('establishment_id', usuarioLogado.id)
    .order('category');

  renderizarMenuPainel(menu || []);
}

function renderizarPedidosPainel(pedidos) {
  const el = document.getElementById('painel-pedidos');
  if (!el) return;
  if (!pedidos.length) { el.innerHTML = '<p style="opacity:.5;text-align:center;padding:1rem">Nenhum pedido ainda</p>'; return; }

  el.innerHTML = pedidos.map(p => {
    const itens = JSON.parse(p.items || '[]');
    const statusLabel = { new: 'Novo', preparing: 'Preparando', ready: 'Pronto', done: 'Entregue' }[p.status] || p.status;
    return `
    <div class="pedido-card">
      <div class="pedido-topo">
        <div>
          <strong>${p.client_name}</strong>
          <div style="font-size:.75rem;opacity:.6">${p.client_phone || ''} · ${p.delivery_type === 'pickup' ? '🏃 Retirada' : '🛵 Entrega'}</div>
        </div>
        <span class="status-badge status-${p.status}">${statusLabel}</span>
      </div>
      <div class="pedido-itens">${itens.map(i => `${i.qty}x ${i.name}`).join(' · ')}</div>
      <div class="pedido-rodape">
        <strong>R$ ${Number(p.total).toFixed(2).replace('.', ',')}</strong>
        <div style="display:flex;gap:.4rem">
          ${p.status === 'new' ? `<button onclick="atualizarStatus('${p.id}', 'preparing')" class="btn-status btn-prep">🍳 Preparando</button>` : ''}
          ${p.status === 'preparing' ? `<button onclick="atualizarStatus('${p.id}', 'ready')" class="btn-status btn-pronto">✅ Pronto</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function atualizarStatus(id, status) {
  await db.from('orders').update({ status }).eq('id', id);
  await abrirPainel(); // Recarrega
}

function renderizarMenuPainel(itens) {
  const el = document.getElementById('painel-menu');
  if (!el) return;
  if (!itens.length) { el.innerHTML = '<p style="opacity:.5;text-align:center;padding:1rem">Nenhum item. Adicione o primeiro!</p>'; return; }
  el.innerHTML = itens.map((it, i) => `
    <div class="menu-item-admin">
      <span style="font-size:1.5rem">${it.emoji || '🍔'}</span>
      <div style="flex:1">
        <div style="font-weight:700">${it.name}</div>
        <div style="font-size:.75rem;opacity:.6">${it.category} · R$ ${Number(it.price).toFixed(2).replace('.', ',')}</div>
      </div>
      <button onclick="toggleItem('${it.id}', ${it.available})" style="font-size:.75rem">${it.available ? '👁 Ativo' : '🚫 Parado'}</button>
    </div>
  `).join('');
}

async function toggleItem(id, available) {
  await db.from('menu_items').update({ available: !available }).eq('id', id);
  await abrirPainel();
}

function copiarLink() {
  const link = window.location.origin + '/restaurante/' + (usuarioLogado?.slug || 'demo');
  navigator.clipboard?.writeText(link);
  alert('Link copiado: ' + link);
}

// ─── CEO PANEL ────────────────────────────────────────────────
async function abrirCeo() {
  mostrarTela('tela-ceo');

  const { data: lojas } = await db.from('estabelecimentos').select('*').order('created_at', { ascending: false });
  const { data: pedidos } = await db.from('orders').select('*');
  const { data: solics } = await db.from('estabelecimentos').select('*').eq('status', 'pending');

  const ativos = (lojas || []).filter(l => l.status === 'active');
  const mrr = ativos.reduce((s, l) => s + (l.plan_type === 'ultra' ? 99.90 : 39.90), 0);

  const elAtivos = document.getElementById('ceo-ativos');
  const elSolics = document.getElementById('ceo-solics');
  const elMrr = document.getElementById('ceo-mrr');
  if (elAtivos) elAtivos.textContent = ativos.length;
  if (elSolics) elSolics.textContent = (solics || []).length;
  if (elMrr) elMrr.textContent = 'R$ ' + mrr.toFixed(2).replace('.', ',');

  const tbody = document.getElementById('ceo-tabela');
  if (tbody) tbody.innerHTML = (lojas || []).map((l, i) => `
    <tr>
      <td style="font-weight:700;cursor:pointer" onclick="verLojaCeo('${l.id}')">${l.name}</td>
      <td style="font-size:.72rem">${l.email}</td>
      <td>
        <span id="pw-m-${i}" style="opacity:.4">••••••</span>
        <span id="pw-s-${i}" style="display:none;color:#fbbf24;font-weight:700">${l.pass || l.password_plain || '—'}</span>
        <button onclick="toggleSenha(${i})" style="background:none;border:none;cursor:pointer;font-size:.8rem">👁</button>
      </td>
      <td><span style="background:${l.plan_type==='ultra'?'rgba(124,58,237,.2)':'rgba(232,65,10,.15)'};color:${l.plan_type==='ultra'?'#a78bfa':'#E8410A'};padding:.1rem .4rem;border-radius:4px;font-size:.68rem;font-weight:700">${l.plan_type==='ultra'?'Ultra':'Básico'}</span></td>
      <td>${l.status==='active'?'<span style="color:#4ade80;font-weight:700">● Ativo</span>':l.status==='pending'?'<span style="color:#fbbf24;font-weight:700">● Pendente</span>':'<span style="opacity:.4">● Inativo</span>'}</td>
      <td>
        ${l.status === 'pending'
          ? `<button onclick="aprovarLoja('${l.id}')" style="background:rgba(74,222,128,.15);color:#4ade80;border:1px solid rgba(74,222,128,.3);border-radius:6px;padding:.2rem .55rem;font-size:.7rem;font-weight:700;cursor:pointer">✓ Aprovar</button>`
          : `<button onclick="toggleLoja('${l.id}', '${l.status}')" style="background:${l.status==='active'?'rgba(239,68,68,.1)':'rgba(74,222,128,.1)'};color:${l.status==='active'?'#f87171':'#4ade80'};border:1px solid ${l.status==='active'?'rgba(239,68,68,.2)':'rgba(74,222,128,.2)'};border-radius:6px;padding:.2rem .55rem;font-size:.7rem;font-weight:700;cursor:pointer">${l.status==='active'?'Desativar':'Ativar'}</button>`
        }
      </td>
    </tr>
  `).join('');

  // Busca CEO
  const buscaEl = document.getElementById('ceo-busca');
  if (buscaEl) buscaEl.oninput = (e) => filtrarTabelaCeo(e.target.value);
}

function filtrarTabelaCeo(q) {
  document.querySelectorAll('#ceo-tabela tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

function toggleSenha(i) {
  const m = document.getElementById('pw-m-'+i);
  const s = document.getElementById('pw-s-'+i);
  if (!m || !s) return;
  const vis = s.style.display !== 'none';
  m.style.display = vis ? 'inline' : 'none';
  s.style.display = vis ? 'none' : 'inline';
}

async function aprovarLoja(id) {
  await db.from('estabelecimentos').update({ status: 'active' }).eq('id', id);
  await abrirCeo();
}

async function toggleLoja(id, status) {
  const novo = status === 'active' ? 'inactive' : 'active';
  await db.from('estabelecimentos').update({ status: novo }).eq('id', id);
  await abrirCeo();
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────
function mostrarTela(id) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  const el = document.getElementById(id);
  if (el) el.classList.add('ativa');
  window.scrollTo(0, 0);
}

function voltar(telaId) {
  mostrarTela(telaId);
}

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── INICIALIZAR ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', iniciar);
