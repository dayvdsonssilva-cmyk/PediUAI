// src/dashboard.js
import { goTo } from './utils.js';

export function initDashboard() {
  console.log('Dashboard carregado');
  renderOrdersList();
}

export function renderOrdersList(orders = []) {
  const list = document.getElementById('orders-list');
  if (!list) return;

  if (!orders.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span>🛵</span>
        <p>Nenhum pedido ainda.<br>Compartilhe seu link!</p>
      </div>
    `;
    return;
  }

  list.innerHTML = orders.map(o => `
    <div class="order-card">
      <strong>#${o.id}</strong>
      <span>${o.items}</span>
      <span class="price">R$ ${o.total}</span>
    </div>
  `).join('');
}

window.initDashboard = initDashboard;
