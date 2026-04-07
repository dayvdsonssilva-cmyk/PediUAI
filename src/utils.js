// src/utils.js

export function goTo(screenId) {
  document.querySelectorAll('[data-screen]').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`[data-screen="${screenId}"]`);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  } else {
    console.warn(`Screen "${screenId}" não encontrada.`);
  }
}

export function openDemo() {
  goTo('s-dash');
}

export function showToast(msg, type = 'success') {
  document.querySelector('.pediway-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'pediway-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#dc2626' : '#FF5C00'};
    color: white;
    padding: 13px 28px;
    border-radius: 50px;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 0.88rem;
    z-index: 9999;
    box-shadow: 0 6px 24px rgba(0,0,0,0.2);
    animation: toastIn 0.25s ease;
    white-space: nowrap;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function showTab(tabId, btn) {
  // Esconde todas as abas
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  // Mostra a aba selecionada
  const tab = document.getElementById(`tab-${tabId}`);
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active');
}

export function copiarLink() {
  const link = document.getElementById('link-url')?.textContent || 'pediway.com.br';
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copiado! 🔗');
  });
}

export function salvarConfig() {
  showToast('Configurações salvas!');
}

// Expõe globalmente
window.showTab    = showTab;
window.copiarLink = copiarLink;
window.salvarConfig = salvarConfig;
