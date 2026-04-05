// src/dashboard.js
import { state, LS } from './config.js';
import { goTo } from './utils.js';
import { renderOrdersList } from './orders.js';

export function initDashboard() {
  console.log("Dashboard do estabelecimento carregado");
  
  // Renderiza os pedidos quando entrar no painel
  if (typeof renderOrdersList === 'function') {
    renderOrdersList();
  }
}

// Torna global
window.initDashboard = initDashboard;
