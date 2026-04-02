import { state, LS } from './config.js';
import { showNotif, openModal, closeModal, saveCurrentUser } from './utils.js';
import { getSupa, salvarPedidoSupa } from './supabase.js';

// ── Pedido detalhe ─────────────────────────────────────────────────────────
export function togglePedidoDetalhe(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
}

// ── Abas cliente ───────────────────────────────────────────────────────────
export function switchClientTab(tab) {
  document.getElementById('tab-cardapio')?.classList.toggle('active', tab === 'cardapio');
  document.getElementById('tab-meus-pedidos')?.classList.toggle('active', tab === 'meus-pedidos');
  document.getElementById('panel-cardapio')?.classList.toggle('active', tab === 'cardapio');
  document.getElementById('panel-meus-pedidos')?.classList.toggle('active', tab === 'meus-pedidos');
  if (tab === 'meus-pedidos') {
    renderMeusPedidos();
    const qtd = carregarPedidosCliente().length;
    console.log('Meus pedidos:', qtd, 'pedido(s) no localStorage');
  }
}

export function salvarPedidoCliente(pedido) {
  try {
    if (!pedido || !pedido.id) return;
    const hist = carregarPedidosCliente(false);
    const jaExiste = hist.find(p => p.id === pedido.id || p.supaId === pedido.supaId);
    if (!jaExiste) {
      pedido.savedAt = pedido.savedAt || Date.now();
      hist.unshift(pedido);
    }
    localStorage.setItem('pw_hist_pedidos', JSON.stringify(hist.slice(0, 30)));
    console.log('Pedido salvo no hist\u00F3rico:', pedido.id, 'Total:', hist.length);
  } catch (e) { console.warn('Erro salvar pedido cliente:', e); }
}

export function carregarPedidosCliente(filtrarExpirados = true) {
  try {
    const raw = localStorage.getItem('pw_hist_pedidos');
    if (!raw) return [];
    const todos = JSON.parse(raw);
    if (!filtrarExpirados) return todos;
    const umDia = 25 * 60 * 60 * 1000;
    return todos.filter(p => (Date.now() - (p.savedAt || Date.now())) < umDia);
  } catch (e) { return []; }
}

export function renderMeusPedidos() {
  const lista = document.getElementById('meus-pedidos-lista'); if (!lista) return;
  const pedidos = carregarPedidosCliente();
  if (!pedidos.length) {
    lista.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:2.5rem;margin-bottom:.75rem">\u{1F4ED}</div><div style="font-weight:700">Nenhum pedido ainda</div><div style="font-size:.8rem;color:var(--ink3);margin-top:.3rem">Fa\u00E7a seu primeiro pedido!</div></div>';
    return;
  }
  lista.innerHTML = pedidos.map((p, pidx) => {
    const isPickup = p.delivery === 'pickup';
    const isReady = p.status === 'ready';
    const isPreparing = p.status === 'preparing';
    const isRejected = p.status === 'rejected';
    const stLabel = isRejected ? '\u274C Pedido recusado' : isPreparing ? '\u{1F373} Preparando...' :
      isReady ? (isPickup ? '\u2705 Pronto para retirada!' : '\u{1F6F5} Saiu para entrega!') :
        p.status === 'done' ? '\u2705 Entregue' : '\u23F3 Aguardando confirma\u00E7\u00E3o';
    const stBg = isRejected ? '#FEF2F2' : isPreparing ? '#eef2ff' : isReady ? 'var(--success-bg)' : 'var(--brand-light)';
    const stCor = isRejected ? '#DC2626' : isPreparing ? '#6366f1' : isReady ? 'var(--success)' : 'var(--brand)';
    const endAddr = isReady && isPickup && p.lojaAddress
      ? `<div style="margin-top:.5rem;padding:.6rem .75rem;background:rgba(26,138,90,.08);border:1px solid rgba(26,138,90,.2);border-radius:8px;font-size:.78rem;color:var(--success)">
           <strong>\u{1F4CD} Endere\u00E7o para retirada:</strong><br>${p.lojaAddress}
         </div>` : '';
    const detailId = 'pedido-detail-' + pidx;
    return `<div style="background:var(--white);border:1.5px solid ${stCor};border-radius:var(--r);margin-bottom:.75rem;box-shadow:0 1px 6px rgba(0,0,0,.06);overflow:hidden">
      <div onclick="togglePedidoDetalhe('${detailId}')" style="padding:1rem;cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem">
          <div>
            <div style="font-weight:800;font-size:.9rem">${p.id || '#-'}</div>
            <div style="font-size:.7rem;color:var(--ink3);margin-top:.1rem">${p.lojaName || ''} \u00B7 ${p.time || 'agora'}</div>
          </div>
          <span style="font-size:.7rem;font-weight:700;background:${stBg};color:${stCor};padding:.2rem .6rem;border-radius:100px;white-space:nowrap;flex-shrink:0">${stLabel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:800;color:var(--brand);font-size:.95rem">R$ ${Number(p.total || 0).toFixed(2).replace('.', ',')}</div>
          <div style="font-size:.8rem;color:var(--ink3)">Toque para ver detalhes \u25BC</div>
        </div>
      </div>
      <div id="${detailId}" style="display:none;border-top:1px solid var(--border);padding:.85rem 1rem;background:var(--surface)">
        <div style="font-size:.75rem;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Itens do pedido</div>
        ${(p.items || []).map(i => `<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.25rem 0;border-bottom:1px solid var(--border)">
          <span>${i.qty}x ${i.name}</span>
          <span style="color:var(--brand);font-weight:700">R$ ${(Number(i.price || 0) * i.qty).toFixed(2).replace('.', ',')}</span>
        </div>`).join('')}
        <div style="display:flex;justify-content:space-between;margin-top:.6rem;font-weight:800;font-size:.9rem">
          <span>Total</span><span style="color:var(--brand)">R$ ${Number(p.total || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="margin-top:.5rem;font-size:.78rem;color:var(--ink3)">
          \u{1F4B3} ${p.payment || '-'} &nbsp;\u00B7&nbsp; ${p.delivery === 'pickup' ? '\u{1F3C3} Retirada' : '\u{1F6F5} Entrega'}
        </div>
        ${endAddr}
      </div>
    </div>`;
  }).join('');
}

// ── Store render ────────────────────────────────────────────────────────────
export function renderStore() {
  const u = state.currentUser; if (!u) return;
  const backBtn = document.getElementById('demo-back-btn');
  if (backBtn) backBtn.style.display = (u.id === 'demo' && window._fromLanding) ? 'flex' : 'none';
  const heroBg = document.getElementById('s-hero-bg');
  if (heroBg) heroBg.style.background = u.colorGrad || u.color || '#1A1208';
  document.documentElement.style.setProperty('--brand', u.color || '#E8410A');
  const logoEl = document.getElementById('store-logo-el');
  const seEl = document.getElementById('se');
  if (logoEl && u.logo) {
    logoEl.innerHTML = `<img src="${u.logo}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else if (seEl) {
    seEl.textContent = u.emoji || '\u{1F354}';
  }
  document.getElementById('sn').textContent = u.name;
  document.getElementById('sd').textContent = u.desc || '';
  const pillTempo = document.getElementById('pill-tempo');
  if (pillTempo) pillTempo.textContent = '\u23F3 ' + (u.prepTime || '30') + ' min';
  const pillEntrega = document.getElementById('pill-entrega');
  if (pillEntrega) {
    const temDel = u.deliveryEnabled !== false;
    const temPick = u.pickupEnabled !== false;
    if (temDel && temPick) pillEntrega.textContent = '\u{1F6F5} Entrega e Retirada';
    else if (temDel) pillEntrega.textContent = '\u{1F6F5} Entrega dispon\u00EDvel';
    else if (temPick) pillEntrega.textContent = '\u{1F3C3} Apenas retirada';
    else pillEntrega.textContent = '\u{1F4DE} Consulte o estabelecimento';
  }
  const fechadoBanner = document.getElementById('loja-fechada-banner');
  const isOpen = u.isOpen !== false;
  if (fechadoBanner) fechadoBanner.style.display = isOpen ? 'none' : 'flex';
  renderFlashClient();
  import('./ui.js').then(({ pedirPermissaoNotificacao, restaurarAssinaturaCliente }) => {
    pedirPermissaoNotificacao();
    setTimeout(restaurarAssinaturaCliente, 1200);
    restaurarAssinaturaCliente();
  });
  const avail = (u.menuItems || []).filter(i => i.available);
  const cats = ['Todos', ...new Set(avail.map(i => i.cat))];
  document.getElementById('cat-tabs').innerHTML = cats.map((c, i) => `<button class="cp ${i === 0 ? 'active' : ''}" onclick="filterCat('${c}',this)">${c}</button>`).join('');
  renderClientMenu('Todos');
  updateCartUI();
}

export async function renderFlashClient() {
  if (state.currentUser?.id?.includes('-')) {
    try {
      const db = getSupa();
      if (db) {
        const { data: estab } = await db
          .from('estabelecimentos')
          .select('flash_items')
          .eq('id', state.currentUser.id)
          .single();
        if (estab?.flash_items) {
          const lista = typeof estab.flash_items === 'string'
            ? JSON.parse(estab.flash_items) : (estab.flash_items || []);
          state.currentUser.flashItems = lista.filter(f => !f.expiresAt || f.expiresAt > Date.now());
          saveCurrentUser();
        }
      }
    } catch (e) { console.warn('Erro fresquinho:', e); }
  }
  const items = state.currentUser?.flashItems || [];
  const sec = document.getElementById('flash-client-sec');
  if (!items.length) { if (sec) sec.style.display = 'none'; return; }
  if (sec) sec.style.display = 'block';
  document.getElementById('flash-client-row').innerHTML = items.map((f, i) => `<div class="fc" onclick="openFlash(${i})">
    ${f.url ? `<img src="${f.url}" class="fc-th" onerror="this.style.display='none'">` : `<div class="fc-ph">${f.emoji}</div>`}
    <div class="fc-ov"></div>
  </div>`).join('');
}

export function openFlash(idx) {
  if (!state.currentUser?.flashItems?.length) return;
  state.flashIdx = idx;
  document.getElementById('modal-flash').style.display = 'block';
  document.body.style.overflow = 'hidden';
  renderFlashSlide();
}

function renderFlashSlide() {
  const { FLASH_DUR } = state;
  clearTimeout(state.flashTimer);
  const items = state.currentUser?.flashItems || [];
  const f = items[state.flashIdx]; if (!f) { closeFlash(); return; }
  const slides = document.getElementById('flash-slides');
  slides.innerHTML = f.url ? (f.type === 'video' ? `<video src="${f.url}" autoplay playsinline loop controls style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"></video>` : `<img src="${f.url}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`) : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:8rem">${f.emoji}</div>`;
  const fsTitleEl = document.getElementById('fs-title');
  if (fsTitleEl) { fsTitleEl.textContent = f.title || ''; fsTitleEl.style.display = f.title ? 'block' : 'none'; }
  const prog = document.getElementById('fp-prog');
  prog.innerHTML = items.map((_, i) => `<div class="fp-track"><div class="fp-fill" id="fp-${i}" style="width:${i < state.flashIdx ? '100%' : '0%'}"></div></div>`).join('');
  const fill = document.getElementById('fp-' + state.flashIdx);
  if (fill) { fill.style.transition = `width 5000ms linear`; requestAnimationFrame(() => { fill.style.width = '100%'; }); }
  state.flashTimer = setTimeout(() => flashNext(), 5000);
}

export function flashNext() { const items = state.currentUser?.flashItems || []; if (state.flashIdx < items.length - 1) { state.flashIdx++; renderFlashSlide(); } else { closeFlash(); } }
export function flashPrev() { if (state.flashIdx > 0) { state.flashIdx--; renderFlashSlide(); } }
export function closeFlash() { clearTimeout(state.flashTimer); document.getElementById('modal-flash').style.display = 'none'; document.body.style.overflow = ''; document.getElementById('flash-slides').innerHTML = ''; }

export function renderClientMenu(cat) {
  const list = document.getElementById('client-menu');
  const avail = (state.currentUser?.menuItems || []).filter(i => i.available);
  const filtered = cat === 'Todos' ? avail : avail.filter(i => i.cat === cat);
  if (!filtered.length) { list.innerHTML = '<div class="es"><div class="ei">\u{1F35D}</div><p>Nenhum item nesta categoria</p></div>'; return; }
  list.innerHTML = filtered.map((it, idx) => `<div class="ci">
    <div class="ci-in">
      <div class="ci-med" onclick="openProductModal(${idx})">
        ${it.photo ? `<img src="${it.photo}" alt="${it.name}" onerror="this.style.display='none';this.nextElementSibling.style.opacity='1'">` : ''}
        <span class="ef" style="${it.photo ? 'opacity:0' : ''}; transition:.2s">${it.emoji || '\u{1F35D}'}</span>
      </div>
      <div class="ci-body">
        <div class="ci-name">${it.name}</div>
        <div class="ci-desc">${it.desc || ''}</div>
        <div class="ci-foot"><div class="ci-price">R$ ${Number(it.price).toFixed(2).replace('.', ',')}</div>
          <div class="ci-acts"><button class="smb" onclick="openProductModal(${idx})">Ver mais</button><button class="ab" onclick="addToCart(${idx},this)">+</button></div>
        </div>
      </div>
    </div>
  </div>`).join('');
}

export function filterCat(cat, btn) { document.querySelectorAll('.cp').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderClientMenu(cat); }

export function openProductModal(idx) {
  const avail = (state.currentUser?.menuItems || []).filter(i => i.available);
  const it = avail[idx]; if (!it) return;
  const id = it.id;
  const img = document.getElementById('pm-img');
  document.getElementById('pm-emoji').textContent = it.emoji;
  if (it.photo) {
    let i = img.querySelector('img');
    if (!i) { i = document.createElement('img'); img.appendChild(i); }
    i.src = it.photo; i.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0';
    document.getElementById('pm-emoji').style.opacity = '0';
  } else {
    const i = img.querySelector('img'); if (i) i.remove();
    document.getElementById('pm-emoji').style.opacity = '1';
  }
  document.getElementById('pm-cat').textContent = it.cat;
  document.getElementById('pm-name').textContent = it.name;
  document.getElementById('pm-desc').textContent = it.desc;
  document.getElementById('pm-price').textContent = 'R$ ' + it.price.toFixed(2).replace('.', ',');
  document.getElementById('pm-add').onclick = () => { addToCartById(id, null); closeModal('modal-product'); };
  openModal('modal-product');
}

export function addToCart(idx, btn) {
  const avail = (state.currentUser?.menuItems || []).filter(i => i.available);
  const it = avail[idx]; if (!it) return;
  addToCartById(it.id, btn);
}

export function addToCartById(id, btn) {
  const it = (state.currentUser?.menuItems || []).find(i => i.id === id); if (!it) return;
  const ex = state.cart.find(c => c.id === id);
  if (ex) ex.qty++; else state.cart.push({ ...it, qty: 1 });
  updateCartUI();
  if (btn) { btn.textContent = '\u2713'; btn.style.background = 'var(--success)'; setTimeout(() => { btn.textContent = '+'; btn.style.background = ''; }, 700); }
}

export function updateCartUI() {
  const count = state.cart.reduce((s, c) => s + c.qty, 0);
  const total = state.cart.reduce((s, c) => s + c.qty * c.price, 0);
  const fab = document.getElementById('cart-fab');
  fab.classList.toggle('vis', count > 0);
  document.getElementById('cart-cnt').textContent = count;
  document.getElementById('cart-total-fab').textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
}

export function setDeliveryType(type) {
  state.deliveryType = type;
  document.getElementById('dt-delivery')?.classList.toggle('active', type === 'delivery');
  document.getElementById('dt-pickup')?.classList.toggle('active', type === 'pickup');
  const ab = document.getElementById('address-block');
  if (ab) ab.style.display = type === 'delivery' ? 'block' : 'none';
  const subtotal = state.cart.reduce((s, c) => s + c.qty * c.price, 0);
  const taxa = type === 'delivery' ? (state.currentUser?.deliveryFee || 0) : 0;
  const taxaRow = document.getElementById('co-taxa-row');
  const taxaEl = document.getElementById('co-taxa');
  if (taxaRow) taxaRow.style.display = taxa > 0 ? 'flex' : 'none';
  if (taxaEl) taxaEl.textContent = 'R$ ' + taxa.toFixed(2).replace('.', ',');
  const totalEl = document.getElementById('co-total');
  if (totalEl) totalEl.textContent = 'R$ ' + (subtotal + taxa).toFixed(2).replace('.', ',');
  const pickupBlock = document.getElementById('pickup-address-block');
  if (pickupBlock) {
    if (type === 'pickup') {
      pickupBlock.style.display = 'block';
      const endLoja = state.currentUser?.address || '';
      pickupBlock.innerHTML = `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:var(--rs);padding:.85rem 1rem;margin-bottom:.85rem">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">
          <span style="font-size:1.1rem">\u{1F4CD}</span>
          <span style="font-weight:700;font-size:.85rem;color:#166534">Local de retirada</span>
        </div>
        ${endLoja
          ? `<div style="font-size:.82rem;color:#15803d;line-height:1.5">${endLoja}</div>`
          : `<div style="font-size:.78rem;color:#6b7280">O estabelecimento informar\u00E1 o endere\u00E7o pelo WhatsApp.</div>`
        }
      </div>`;
    } else {
      pickupBlock.style.display = 'none';
    }
  }
}

export function renderCheckout() {
  const list = document.getElementById('cart-items'); if (!state.cart.length) { list.innerHTML = '<div class="es"><p>Carrinho vazio</p></div>'; return; }
  const temDel = state.currentUser?.deliveryEnabled !== false;
  const temPick = state.currentUser?.pickupEnabled !== false;
  const taxaFee = state.currentUser?.deliveryFee || 0;
  document.getElementById('dt-delivery').style.display = temDel ? '' : 'none';
  document.getElementById('dt-pickup').style.display = temPick ? '' : 'none';
  if (!temDel && temPick) setDeliveryType('pickup');
  if (temDel && !temPick) setDeliveryType('delivery');
  const taxaLabel = document.getElementById('taxa-label-checkout');
  if (taxaLabel) taxaLabel.textContent = taxaFee > 0 ? `Taxa: R$ ${taxaFee.toFixed(2).replace('.', ',')}` : 'Entrega gr\u00E1tis';
  list.innerHTML = state.cart.map((it, i) => `<div class="cir"><div class="ce">${it.emoji || '\u{1F35D}'}</div><div class="cn">${it.name}</div><div class="qc"><button class="qb" onclick="changeQty(${i},-1)">-</button><span class="qn">${it.qty}</span><button class="qb" onclick="changeQty(${i},1)">+</button></div><div class="cprice">R$ ${(it.qty * Number(it.price)).toFixed(2).replace('.', ',')}</div></div>`).join('');
  const subtotal = state.cart.reduce((s, c) => s + c.qty * c.price, 0);
  const taxa = (state.deliveryType === 'delivery') ? taxaFee : 0;
  const total = subtotal + taxa;
  const taxaEl = document.getElementById('co-taxa');
  const taxaRow = document.getElementById('co-taxa-row');
  if (taxaRow) taxaRow.style.display = taxa > 0 ? 'flex' : 'none';
  if (taxaEl) taxaEl.textContent = 'R$ ' + taxa.toFixed(2).replace('.', ',');
  document.getElementById('co-total').textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
}

export function changeQty(i, d) {
  state.cart[i].qty += d;
  if (state.cart[i].qty <= 0) state.cart.splice(i, 1);
  renderCheckout(); updateCartUI();
}

export function selPayment(p, btn) {
  state.selectedPayment = p;
  document.querySelectorAll('.pmb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

export function placeOrder() {
  const name = document.getElementById('cl-name').value.trim();
  const phone = document.getElementById('cl-phone').value.trim();
  if (!name || !phone) { alert('Preencha nome e telefone'); return; }
  if (state.deliveryType === 'delivery' && !document.getElementById('cl-addr').value.trim()) { alert('Preencha o endere\u00E7o de entrega'); return; }
  if (state.cart.length === 0) { alert('Carrinho vazio'); return; }
  buildConfirmData();
  import('./ui.js').then(({ goTo }) => goTo('s-confirm-data'));
}

export function buildConfirmData() {
  const total = state.cart.reduce((s, c) => s + c.qty * c.price, 0);
  const name = document.getElementById('cl-name').value;
  const phone = document.getElementById('cl-phone').value;
  const addr = state.deliveryType === 'delivery' ? document.getElementById('cl-addr').value : 'Retirada no local';
  const items = state.cart.map(c => `${c.qty}x ${c.name} - R$ ${(c.qty * c.price).toFixed(2).replace('.', ',')}`);
  const cdItems = document.getElementById('confirm-data-items');
  const cdTotal = document.getElementById('confirm-data-total');
  const cdDel = document.getElementById('confirm-data-delivery');
  const cdPay = document.getElementById('confirm-data-payment');
  if (cdItems) cdItems.innerHTML = items.join('<br>');
  if (cdTotal) cdTotal.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
  const endLoja = state.currentUser?.address || '';
  const retiradaInfo = state.deliveryType === 'pickup' && endLoja
    ? `<br><strong style="color:#166534">\u{1F4CD} Retirar em:</strong> <span style="color:#15803d">${endLoja}</span>`
    : state.deliveryType === 'pickup' ? '<br><em style="color:var(--ink3)">Endere\u00E7o ser\u00E1 informado pelo WhatsApp</em>' : '';
  if (cdDel) cdDel.innerHTML = `<strong>Nome:</strong> ${name}<br><strong>Telefone:</strong> ${phone}<br><strong>Tipo:</strong> ${state.deliveryType === 'pickup' ? 'Retirada' : 'Entrega'}${state.deliveryType === 'delivery' ? '<br><strong>Endere\u00E7o:</strong> ' + addr : ''}${retiradaInfo}`;
  if (cdPay) cdPay.textContent = state.selectedPayment;
}

export function buildConfirmation(order) {
  const orderIdEl = document.getElementById('conf-order-id');
  if (orderIdEl) orderIdEl.textContent = order.id;
  const art = document.getElementById('conf-art');
  if (art && state.currentUser?.color) {
    art.style.background = `linear-gradient(150deg, ${state.currentUser.color} 0%, ${state.currentUser.colorDark || '#B83208'} 100%)`;
  }
  import('./ui.js').then(({ spawnParticles }) => spawnParticles());
  const bar = document.getElementById('client-status-bar');
  if (bar) { bar.className = 'csb'; bar.innerHTML = ''; }
  const waiting = document.getElementById('status-waiting');
  if (waiting) waiting.style.display = 'flex';
  const gmsg = document.getElementById('game-start-msg');
  const gover = document.getElementById('game-over');
  const gburger = document.getElementById('game-burger');
  if (gmsg) gmsg.style.display = 'flex';
  if (gover) gover.style.display = 'none';
  if (gburger) gburger.style.display = 'none';
  state.gameActive = false; clearInterval(state.gTimer); cancelAnimationFrame(state.gAnimFrame);
  state.gameScore = 0;
  const scoreEl = document.getElementById('g-score'); if (scoreEl) scoreEl.textContent = '0';
  const timerEl = document.getElementById('g-timer'); if (timerEl) timerEl.textContent = '20';
}

export function openWhatsApp() {
  const orders = state.currentUser?.orders || []; const o = orders[0]; if (!o) return;
  const msg = encodeURIComponent(`Ol\u00E1! Fiz um pedido pelo PEDIWAY \u{1F6F5}\n\nPedido ${o.id}\nNome: ${o.client}\nTelefone: ${o.phone}\nEntrega: ${o.delivery === 'pickup' ? 'Retirada' : 'Entrega - ' + o.address}\nItens: ${o.items.map(i => `${i.qty}x ${i.name}`).join(', ')}\nPagamento: ${o.payment}\nTotal: R$ ${o.total.toFixed(2).replace('.', ',')}`);
  window.open(`https://wa.me/${state.currentUser?.whatsapp || ''}?text=${msg}`, '_blank');
}

export async function confirmAndSendOrder() {
  const u = state.currentUser;
  if (!u) return;
  const name = document.getElementById('cl-name').value.trim();
  const phone = document.getElementById('cl-phone').value.trim();
  const addr = state.deliveryType === 'delivery' ? document.getElementById('cl-addr').value.trim() : 'Retirada no local';
  const subtotal = state.cart.reduce((s, c) => s + c.qty * c.price, 0);
  const taxaEntrega = state.deliveryType === 'delivery' ? (u.deliveryFee || 0) : 0;
  const total = subtotal + taxaEntrega;
  state.orderCounter++;
  localStorage.setItem('pw_order_counter', String(state.orderCounter));
  const order = {
    id: '#' + String(state.orderCounter).padStart(4, '0'), client: name, phone, address: addr, delivery: state.deliveryType,
    items: state.cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
    payment: state.selectedPayment, total, status: 'new', time: 'agora', ts: Date.now()
  };
  u.orders = [order, ...(u.orders || [])];
  saveCurrentUser();
  const lojaIdParaSalvar = (u.id && u.id.includes('-')) ? u.id : null;
  if (lojaIdParaSalvar) {
    salvarPedidoSupa(lojaIdParaSalvar, order).then(orderId => {
      if (orderId) {
        order.supaId = orderId;
        u.orders[0].supaId = orderId;
        saveCurrentUser();
        try {
          const lista = carregarPedidosCliente(false);
          if (lista[0]) { lista[0].supaId = orderId; }
          localStorage.setItem('pw_hist_pedidos', JSON.stringify(lista));
        } catch (e) {}
        import('./ui.js').then(({ assinarStatusPedido }) => assinarStatusPedido(orderId, state.deliveryType));
      }
    });
  }
  const pedidoParaSalvar = { ...order, lojaAddress: u.address || '', lojaName: u.name || '', time: 'agora', savedAt: Date.now() };
  salvarPedidoCliente(pedidoParaSalvar);
  state.cart = [];
  updateCartUI();
  buildConfirmation(order);
  const { goTo } = await import('./ui.js');
  goTo('s-confirm');
  const { startGame } = await import('./game.js');
  setTimeout(() => startGame(), 1000);
}
