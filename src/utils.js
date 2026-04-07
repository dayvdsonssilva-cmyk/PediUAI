// src/utils.js

export function goTo(screenId) {
  document.querySelectorAll('[data-screen]').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`[data-screen="${screenId}"]`);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

export function openDemo() {
  goTo('s-dash');
}

export function showTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById(`tab-${tabId}`);
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active');
}

export function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function atualizarSlugPreview(nome) {
  const slug = gerarSlug(nome);
  const el = document.getElementById('slug-preview');
  if (el) el.textContent = slug ? `pediway.com.br/${slug}` : 'pediway.com.br/seu-estabelecimento';
}

export function atualizarLinkDash(nome) {
  const slug = gerarSlug(nome);
  const preview = document.getElementById('cfg-link-preview');
  const linkUrl = document.getElementById('link-url');
  const url = slug ? `pediway.com.br/${slug}` : 'pediway.com.br/meu-estabelecimento';
  if (preview) preview.textContent = url;
  if (linkUrl) linkUrl.textContent = url;
  localStorage.setItem('pw_slug', slug);
}

export function copiarLink() {
  const link = document.getElementById('link-url')?.textContent || '';
  navigator.clipboard.writeText('https://' + link).then(() => showToast('Link copiado! 🔗'));
}

export function salvarConfig() {
  const nome = document.getElementById('cfg-nome')?.value.trim();
  if (nome) {
    localStorage.setItem('pw_nome', nome);
    const storeEl = document.getElementById('dash-store-name');
    if (storeEl) storeEl.textContent = nome;
    atualizarLinkDash(nome);
  }
  showToast('Configurações salvas! ✅');
}

export function showToast(msg, type = 'success') {
  document.querySelector('.pediway-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'pediway-toast';
  toast.style.cssText = `
    position:fixed; bottom:28px; left:50%;
    transform:translateX(-50%);
    background:${type === 'error' ? '#dc2626' : '#C0392B'};
    color:white; padding:13px 28px; border-radius:50px;
    font-family:'Poppins',sans-serif; font-weight:600; font-size:0.88rem;
    z-index:9999; box-shadow:0 6px 24px rgba(0,0,0,0.2);
    animation:toastIn 0.25s ease; white-space:nowrap;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Expõe globalmente
window.showTab            = showTab;
window.copiarLink         = copiarLink;
window.salvarConfig       = salvarConfig;
window.atualizarSlugPreview = atualizarSlugPreview;
window.atualizarLinkDash  = atualizarLinkDash;
