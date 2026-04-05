// src/ui.js
import { goTo } from './utils.js';

export function switchScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const el = document.getElementById(screen);
  if (el) el.classList.add('active');
}

export function tocarSomNovoPedido() {
  const audio = new Audio('/sounds/new-order.mp3');
  audio.volume = 0.7;
  audio.play().catch(() => {});
}

// Torna global
window.switchScreen = switchScreen;
window.tocarSomNovoPedido = tocarSomNovoPedido;
