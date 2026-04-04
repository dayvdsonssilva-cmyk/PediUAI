
let _notifAudio = null;
let _notifTimeout = null;
let _notifOrderId = null;

export function tocarSomNovoPedido(orderId) {
  pararSomNotificacao();
  _notifOrderId = orderId || null;
  _iniciarCicloSom();
}

function _iniciarCicloSom() {
  if (_notifOrderId) {
    const ativo = (state.currentUser?.orders || []).find(o => o.supaId === _notifOrderId || o.id === _notifOrderId);
    if (!ativo || ativo.status !== 'new') { pararSomNotificacao(); return; }
  }
  _tocarAudio(() => {
    _notifTimeout = setTimeout(() => { _iniciarCicloSom(); }, 5000);
  });
}

function _tocarAudio(onEnded) {
  try {
    const a = new Audio(NOTIF_AUDIO_B64);
    a.volume = 0.85;
    _notifAudio = a;
    a.onended = () => { if (onEnded) onEnded(); };
    a.play().catch(() => { if (onEnded) onEnded(); });
  } catch (e) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;
      function beep(freq, st, dur) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = freq; g.gain.setValueAtTime(0.3, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + dur);
        o.start(st); o.stop(st + dur);
      }
      beep(880, t, 0.12); beep(1100, t + 0.15, 0.12); beep(1320, t + 0.30, 0.18);
      if (onEnded) setTimeout(onEnded, 550);
    } catch (e2) { if (onEnded) setTimeout(onEnded, 550); }
  }
}

export function pararSomNotificacao() {
  if (_notifTimeout) { clearTimeout(_notifTimeout); _notifTimeout = null; }
  if (_notifAudio) {
    try { _notifAudio.onended = null; _notifAudio.pause(); _notifAudio.currentTime = 0; } catch (e) {}
    _notifAudio = null;
  }
  _notifOrderId = null;
}

export function notifCliente(titulo, corpo) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(titulo, { body: corpo, icon: '/icons/icon-192.png', silent: false });
    } catch (e) { new Notification(titulo, { body: corpo }); }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') notifCliente(titulo, corpo);
    });
  }
}

export function pedirPermissaoNotificacao() {
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }, 5000);
  }
}

export function toggleLojaAberta() {
  const aberta = document.getElementById('toggle-loja-open')?.checked ?? true;
  const txt = document.getElementById('loja-status-txt');
  const thumb = document.getElementById('thumb-loja');
  const ball = document.getElementById('ball-loja');
  if (txt) txt.textContent = aberta ? '\u{1F7E2} Loja aberta' : '\u{1F534} Loja fechada';
  if (thumb) thumb.style.background = aberta ? 'var(--brand)' : '#9CA3AF';
  if (ball) ball.style.transform = aberta ? 'translateX(24px)' : 'translateX(0)';
  if (!state.currentUser) return;
  state.currentUser.isOpen = aberta;
  saveCurrentUser();
  const db = getSupa();
  if (db && state.currentUser.id?.includes('-')) {
    db.from('estabelecimentos').update({ is_open: aberta }).eq('id', state.currentUser.id).then(() => {});
  }
}

export function carregarStatusLoja() {
  const aberta = state.currentUser?.isOpen !== false;
  const chk = document.getElementById('toggle-loja-open');
  const txt = document.getElementById('loja-status-txt');
  const thumb = document.getElementById('thumb-loja');
  const ball = document.getElementById('ball-loja');
  if (chk) chk.checked = aberta;
  if (txt) txt.textContent = aberta ? '\u{1F7E2} Loja aberta' : '\u{1F534} Loja fechada';
  if (thumb) thumb.style.background = aberta ? 'var(--brand)' : '#9CA3AF';
  if (ball) ball.style.transform = aberta ? 'translateX(24px)' : 'translateX(0)';
}

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
export function salvarHorarios() {
  const horarios = {};
  DIAS.forEach(d => {
    horarios[d] = {
      aberto: document.getElementById('h-' + d + '-on')?.checked ?? true,
      abre: document.getElementById('h-' + d + '-a')?.value || '08:00',
      fecha: document.getElementById('h-' + d + '-f')?.value || '22:00'
    };
  });
  if (!state.currentUser) return;
  state.currentUser.horarios = horarios;
  saveCurrentUser();
  const db = getSupa();
  if (db && state.currentUser.id?.includes('-')) {
    db.from('estabelecimentos').update({ horarios: JSON.stringify(horarios) }).eq('id', state.currentUser.id).then(() => {});
  }
}

export function carregarHorarios() {
  const h = state.currentUser?.horarios;
  if (!h) return;
  DIAS.forEach(d => {
    const dia = h[d];
    if (!dia) return;
    const on = document.getElementById('h-' + d + '-on');
    const a = document.getElementById('h-' + d + '-a');
    const f = document.getElementById('h-' + d + '-f');
    if (on) on.checked = dia.aberto !== false;
    if (a) a.value = dia.abre || '08:00';
    if (f) f.value = dia.fecha || '22:00';
  });
}

let realtimeChannel = null;
let _pedidoEntrega = 'pickup';

export async function assinarStatusPedido(orderId, tipoEntrega) {
  const db = getSupa(); if (!db || !orderId) return;
  _pedidoEntrega = tipoEntrega || 'pickup';
  if (realtimeChannel) { try { db.removeChannel(realtimeChannel); } catch (e) {} realtimeChannel = null; }
  realtimeChannel = db
    .channel('cliente-pedido-' + orderId)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'orders',
      filter: 'id=eq.' + orderId
    }, (payload) => {
      const novoStatus = payload.new?.status;
      if (novoStatus === 'preparing') {
        atualizarStatusPedidoCliente(orderId, 'preparing');
        notifCliente('\u{1F373} Pedido confirmado!', 'Estamos preparando agora. Aguarde!');
        showCSNotif('preparing');
      } else if (novoStatus === 'rejected') {
        atualizarStatusPedidoCliente(orderId, 'rejected');
        notifCliente('\u274C Pedido recusado', 'O estabelecimento n\u00E3o p\u00F4de aceitar seu pedido.');
        showCSNotif('rejected');
      } else if (novoStatus === 'ready') {
        const msg = _pedidoEntrega === 'pickup' ? 'Pode vir retirar no estabelecimento.' : 'Seu pedido saiu para entrega.';
        const titulo = _pedidoEntrega === 'pickup' ? 'Pronto para retirada!' : 'Pedido a caminho!';
        atualizarStatusPedidoCliente(orderId, 'ready');
        notifCliente(titulo, msg);
        showCSNotif('ready');
      }
    })
    .subscribe((status) => {
      console.log('Realtime cliente:', status);
    });
}

export function atualizarStatusPedidoCliente(supaId, novoStatus) {
  try {
    const raw = localStorage.getItem('pw_hist_pedidos');
    if (!raw) return;
    const lista = JSON.parse(raw);
    const idx = lista.findIndex(p => p.supaId === supaId);
    if (idx >= 0) {
      lista[idx].status = novoStatus;
      localStorage.setItem('pw_hist_pedidos', JSON.stringify(lista));
    }
  } catch (e) {}
}

export async function restaurarAssinaturaCliente() {
  try {
    const { carregarPedidosCliente } = await import('./client-store.js');
    const pedidos = carregarPedidosCliente(false);
    if (!pedidos.length) return;
    const ativo = pedidos.find(p => p.status !== 'done' && p.supaId);
    if (!ativo?.supaId) return;
    const db = getSupa();
    if (!db) return;
    const { data: pedidoSupa } = await db
      .from('orders').select('status').eq('id', ativo.supaId).single();
    if (!pedidoSupa) return;
    if (pedidoSupa.status !== ativo.status) {
      atualizarStatusPedidoCliente(ativo.supaId, pedidoSupa.status);
      _pedidoEntrega = ativo.delivery || 'delivery';
      showCSNotif(pedidoSupa.status);
    }
    assinarStatusPedido(ativo.supaId, ativo.delivery || 'delivery');
  } catch (e) { console.warn('Erro restaurar assinatura:', e); }
}

export function showCSNotif(status) {
  const bar = document.getElementById('client-status-bar'); if (!bar) return;
  const waiting = document.getElementById('status-waiting');
  if (waiting) waiting.style.display = 'none';
  const isPickup = _pedidoEntrega === 'pickup';
  if (status === 'preparing') {
    bar.className = 'csb vis csb-prep';
    bar.innerHTML = '<span class="spinning" style="font-size:1.1rem">\u{1F373}</span><div><div style="font-family:\'Poppins\',sans-serif;font-weight:700;font-size:.86rem;color:#3730A3">Pedido confirmado!</div><div style="font-size:.72rem;color:var(--ink3);margin-top:.1rem">Estamos preparando agora.</div></div>';
    showNotif('Pedido confirmado!', 'Estamos preparando agora.');
  } else if (status === 'rejected') {
    bar.className = 'csb vis';
    bar.style.background = '#FEF2F2'; bar.style.borderColor = '#FECACA';
    bar.innerHTML = '<span style="font-size:1.1rem">\u274C</span><div><div style="font-family:\'Poppins\',sans-serif;font-weight:700;font-size:.86rem;color:#DC2626">Pedido recusado</div><div style="font-size:.72rem;color:var(--ink3);margin-top:.1rem">O estabelecimento n\u00E3o p\u00F4de aceitar seu pedido.</div></div>';
    showNotif('\u274C Pedido recusado', 'O estabelecimento n\u00E3o p\u00F4de atender no momento.');
  } else {
    bar.className = 'csb vis csb-ready';
    const readyMsg = isPickup ? 'Pode vir retirar no estabelecimento.' : 'Seu pedido saiu para entrega.';
    const readyTitle = isPickup ? 'Pronto para retirada!' : 'Pedido a caminho!';
    bar.innerHTML = '<span style="font-size:1.1rem">\u2705</span><div><div style="font-family:\'Poppins\',sans-serif;font-weight:700;font-size:.86rem;color:var(--success)">' + readyTitle + '</div><div style="font-size:.72rem;color:var(--ink3);margin-top:.1rem">' + readyMsg + '</div></div>';
    showNotif(readyTitle, readyMsg);
  }
}

export function goTo(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  state.currentScreen = id;
  if (id === 's-dash') import('./dashboard.js').then(({ renderDashboard }) => renderDashboard());
  if (id === 's-store') import('./client-store.js').then(({ renderStore }) => renderStore());
  if (id === 's-checkout') import('./client-store.js').then(({ renderCheckout }) => renderCheckout());
  if (id === 's-ceo') import('./dashboard.js').then(({ renderCeo }) => renderCeo());
  const activeScreen = document.getElementById(id);
  if (activeScreen) activeScreen.scrollTop = 0;
}

export function initRouting() {
  const hash = window.location.hash;
  if (hash === '#demo') { openDemo(); }
}

export function openDemo() {
  import('./utils.js').then(({ initDemoData }) => initDemoData());
  const users = LS.get('users') || [];
  const demo = users.find(u => u.id === 'demo');
  if (demo) {
    state.currentUser = demo;
    state.currentStoreSlug = 'demo';
    window._fromLanding = true;
    goTo('s-store');
  }
}

export function goBackFromStore() {
  state.currentUser = null;
  state.currentStoreSlug = null;
  goTo('sl');
}

let cropCallback = null;
let cropX = 0, cropY = 0, cropScale = 1;
let cropDragStart = null, cropImgNatW = 0, cropImgNatH = 0;
let cropIsCircle = false;

export function openCropModal(dataUrl, title, isCircle, onConfirm) {
  cropCallback = onConfirm;
  cropIsCircle = isCircle;
  cropX = 0; cropY = 0; cropScale = 1;
  document.getElementById('crop-title').textContent = title;
  document.getElementById('crop-zoom').value = 1;
  const img = document.getElementById('crop-img');
  img.src = dataUrl;
  img.onload = () => {
    cropImgNatW = img.naturalWidth;
    cropImgNatH = img.naturalHeight;
    const cont = document.getElementById('crop-container');
    const cw = cont.clientWidth;
    cropScale = cw / Math.min(cropImgNatW, cropImgNatH);
    document.getElementById('crop-zoom').value = cropScale;
    document.getElementById('crop-zoom').min = cropScale * 0.5;
    document.getElementById('crop-zoom').max = cropScale * 4;
    document.getElementById('crop-zoom').step = cropScale * 0.05;
    applyCropTransform();
  };
  const cont = document.getElementById('crop-container');
  cont.style.borderRadius = isCircle ? '50%' : 'var(--r)';
  setupCropDrag();
  import('./utils.js').then(({ openModal }) => openModal('modal-crop'));
}

export function applyCropTransform() {
  cropScale = parseFloat(document.getElementById('crop-zoom').value);
  const img = document.getElementById('crop-img');
  img.style.width = (cropImgNatW * cropScale) + 'px';
  img.style.height = (cropImgNatH * cropScale) + 'px';
  img.style.left = cropX + 'px';
  img.style.top = cropY + 'px';
}

export function setupCropDrag() {
  const cont = document.getElementById('crop-container');
  cont.onpointerdown = e => {
    cont.setPointerCapture(e.pointerId);
    cropDragStart = { x: e.clientX - cropX, y: e.clientY - cropY };
    cont.style.cursor = 'grabbing';
  };
  cont.onpointermove = e => {
    if (!cropDragStart) return;
    cropX = e.clientX - cropDragStart.x;
    cropY = e.clientY - cropDragStart.y;
    applyCropTransform();
  };
  cont.onpointerup = () => { cropDragStart = null; cont.style.cursor = 'grab'; };
}

export function confirmCrop() {
  const cont = document.getElementById('crop-container');
  const img = document.getElementById('crop-img');
  const canvas = document.createElement('canvas');
  const size = Math.min(cont.clientWidth, cont.clientHeight);
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (cropIsCircle) {
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
  }
  ctx.drawImage(img, cropX, cropY, cropImgNatW * cropScale, cropImgNatH * cropScale);
  const result = canvas.toDataURL('image/jpeg', 0.88);
  import('./utils.js').then(({ closeModal }) => closeModal('modal-crop'));
  if (cropCallback) cropCallback(result);
}

export function cancelCrop() {
  import('./utils.js').then(({ closeModal }) => closeModal('modal-crop'));
}

export function previewLogo(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    openCropModal(e.target.result, 'Ajustar logo', true, (cropped) => {
      document.getElementById('logo-preview').src = cropped;
      document.getElementById('logo-preview').style.display = 'block';
      document.getElementById('logo-ph').style.display = 'none';
    });
  };
  reader.readAsDataURL(file);
}

export function spawnParticles() {
  const container = document.getElementById('s-confirm');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.style.cssText = 'position:absolute;width:8px;height:8px;border-radius:50%;pointer-events:none;z-index:999;';
    const colors = ['#E8410A', '#FFB800', '#00C896', '#6366F1', '#EC4899'];
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = Math.random() * 100 + '%';
    p.style.top = '30%';
    container.appendChild(p);
    const tx = (Math.random() - 0.5) * 300;
    const ty = -(Math.random() * 300 + 100);
    p.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(0)', opacity: 0 }
    ], { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(0,0,.2,1)', fill: 'forwards' });
    setTimeout(() => p.remove(), 1600);
  }
}
