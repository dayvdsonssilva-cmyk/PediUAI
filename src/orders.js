// src/orders.js
import { state } from './config.js';
import { showNotif, saveCurrentUser } from './utils.js';
import { getSupa } from './supabase.js';

let currentAudio = null;
let realtimeChannel = null;

export function tocarSomNovoPedido() {
  if (currentAudio) currentAudio.pause();
  
  currentAudio = new Audio('/sounds/new-order.mp3');
  currentAudio.volume = 0.75;
  currentAudio.play().catch(() => {});
}

export function pararSomNotificacao() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function renderOrdersList() {
  // seu código de renderização...
  console.log("Pedidos renderizados");
}

// ====================== REALTIME ======================
export function iniciarRealtimePedidos() {
  const supa = getSupa();
  if (!supa || !state.currentUser?.id) return;

  if (realtimeChannel) supa.removeChannel(realtimeChannel);

  realtimeChannel = supa.channel('pedidos-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
      filter: `establishment_id=eq.${state.currentUser.id}`
    }, (payload) => {
      const p = payload.new;
      const novo = {
        id: '#' + String(Date.now()).slice(-4),
        client: p.client_name,
        items: typeof p.items === 'string' ? JSON.parse(p.items) : p.items,
        total: Number(p.total),
        status: 'new',
        time: 'agora'
      };

      if (!state.currentUser.orders) state.currentUser.orders = [];
      state.currentUser.orders.unshift(novo);

      saveCurrentUser();
      renderOrdersList();
      tocarSomNovoPedido();
      showNotif('🛎 Novo Pedido!', `${novo.client} - R$ ${novo.total}`);
    })
    .subscribe();
}

// Torna global
window.tocarSomNovoPedido = tocarSomNovoPedido;
window.pararSomNotificacao = pararSomNotificacao;
window.iniciarRealtimePedidos = iniciarRealtimePedidos;
window.renderOrdersList = renderOrdersList;
