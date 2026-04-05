// src/client-store.js
import { state } from './config.js';
import { goTo } from './utils.js';

export function renderStore() {
  console.log("Cardápio da loja carregado");
  // Aqui vamos colocar o cardápio completo depois
}

export function addToCart(item) {
  state.cart.push(item);
  console.log("Item adicionado ao carrinho:", item);
}

export function placeOrder() {
  alert("Pedido enviado! 🎉 (em desenvolvimento)");
  goTo('s-confirm');
}

// Torna global
window.renderStore = renderStore;
window.addToCart = addToCart;
window.placeOrder = placeOrder;
