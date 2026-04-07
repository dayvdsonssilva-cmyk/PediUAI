// src/utils.js
const BASE_URL = 'https://pediway.vercel.app';

export function goTo(screenId) {
  document.querySelectorAll('[data-screen]').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`[data-screen="${screenId}"]`);
  if (target) { target.classList.add('active'); window.scrollTo(0, 0); }
}

export function openDemo() {
  window.open(`${BASE_URL}/demo`, '_blank');
}

export function showTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById(`tab-${tabId}`);
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active');
}

export function gerarSlug(nome) {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

export function copiarLink() {
  const slug = localStorage.getItem('pw_slug') || 'meu-estabelecimento';
  const link = `${BASE_URL}/${slug}`;
  navigator.clipboard.writeText(link).then(() => showToast('Link copiado! 🔗'));
}

export function showToast(msg, type = 'success') {
  document.querySelector('.pediway-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'pediway-toast';
  t.style.cssText = `
    position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
    background:${type === 'error' ? '#dc2626' : '#C0392B'};
    color:#fff; padding:13px 28px; border-radius:50px;
    font-family:'Poppins',sans-serif; font-weight:600; font-size:0.88rem;
    z-index:9999; box-shadow:0 6px 24px rgba(0,0,0,0.2);
    animation:toastIn 0.25s ease; white-space:nowrap;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

window.showTab    = showTab;
window.copiarLink = copiarLink;
