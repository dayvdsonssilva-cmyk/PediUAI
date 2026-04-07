// src/utils.js
const BASE = 'https://pediway.vercel.app';

export function goTo(id) {
  document.querySelectorAll('[data-screen]').forEach(s => s.classList.remove('active'));
  const t = document.querySelector(`[data-screen="${id}"]`);
  if (t) { t.classList.add('active'); window.scrollTo(0, 0); }
}

// Demo do PAINEL (dashboard)
export function openDemo() {
  // Carrega dados fictícios e vai para o dashboard
  const demoEstab = {
    id: 'demo', nome: 'Nome da sua loja', slug: 'demo',
    whatsapp: '', descricao: 'Cardápio digital', logo_url: null,
  };
  window._estab = demoEstab;
  window._isDemo = true;
  localStorage.setItem('pw_estab', JSON.stringify(demoEstab));
  goTo('s-dash');
  if (window.initDashboard) window.initDashboard();
}

// Demo do CARDÁPIO do cliente
export function openDemoCliente() {
  window.open(`${BASE}/demo`, '_blank');
}

export function showTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tabId}`)?.classList.add('active');
  btn?.classList.add('active');
}

export function gerarSlug(nome) {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

export function copiarLink() {
  const slug = window._estab?.slug || 'meu-estabelecimento';
  navigator.clipboard.writeText(`${BASE}/${slug}`).then(() => showToast('Link copiado! 🔗'));
}

export function showToast(msg, type = 'success') {
  document.querySelector('.pw-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'pw-toast';
  t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
    background:${type === 'error' ? '#dc2626' : '#C0392B'};color:#fff;padding:13px 28px;
    border-radius:50px;font-family:'Poppins',sans-serif;font-weight:600;font-size:0.88rem;
    z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,0.2);white-space:nowrap;
    animation:toastIn 0.25s ease;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

window.showTab         = showTab;
window.copiarLink      = copiarLink;
window.openDemoCliente = openDemoCliente;
