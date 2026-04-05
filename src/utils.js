// src/utils.js
import { state, LS } from './config.js';

export function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screen);
  if (target) target.classList.add('active');
}

export function showNotif(title, body) {
  const notif = document.getElementById('notif');
  if (notif) {
    document.getElementById('notif-t').textContent = title;
    document.getElementById('notif-b').textContent = body;
    notif.classList.add('show');
    setTimeout(() => notif.classList.remove('show'), 4000);
  }
}

export function openDemo() {
  alert("Demo aberta! (Em breve vamos conectar o demo completo)");
  goTo('sl');
}

// Exporta tudo que precisar ser global
window.goTo = goTo;
window.openDemo = openDemo;
