// src/orders.js
import { state } from './config.js';
import { showNotif } from './utils.js';

export function renderOrdersList() {
  console.log("Lista de pedidos renderizada (em desenvolvimento)");
}

export function tocarSomNovoPedido() {
  const audio = new Audio('/sounds/new-order.mp3');
  audio.play().catch(() => {});
}

// Torna global
window.renderOrdersList = renderOrdersList;
