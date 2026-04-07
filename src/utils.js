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

export function showToast(msg, type = 'info') {
  document.querySelector('.pediway-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'pediway-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%) translateY(0);
    background: ${type === 'error' ? '#c0392b' : '#FF6000'};
    color: white;
    padding: 13px 28px;
    border-radius: 50px;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 0.9rem;
    z-index: 9999;
    box-shadow: 0 6px 24px rgba(0,0,0,0.35);
    animation: toastIn 0.25s ease;
    white-space: nowrap;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
