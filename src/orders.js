// src/orders.js - Versão corrigida com realtime e som controlado
import { state } from './config.js';
import { showNotif, saveCurrentUser } from './utils.js';
import { getSupa } from './supabase.js';

let currentAudio = null;

export function tocarSomNovoPedido() {
  if (currentAudio) currentAudio.pause();
  
  currentAudio = new Audio('/sounds/new-order.mp3');
  currentAudio.volume = 0.7;
  currentAudio.play().catch(() => {});
}

export function pararSomNotificacao() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function renderOrdersList() {
  console.log("📋 Renderizando pedidos...");
  // Aqui você pode colocar o código de renderização que já tinha
}

export function iniciarRealtimePedidos() {
  const supa = getSupa();
  if (!supa || !state.currentUser?.id) return;

  supa.channel('realtime-pedidos')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
      filter: `establishment_id=eq.${state.currentUser.id}`
    }, (payload) => {
      console.log('🛎 Novo pedido recebido!', payload.new);
      
      const novo = {
        id: '#' + String(Date.now()).slice(-4),
        client: payload.new.client_name || 'Cliente',
        total: Number(payload.new.total || 0),
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
window.renderOrdersList = renderOrdersList;
window.tocarSomNovoPedido = tocarSomNovoPedido;
window.pararSomNotificacao = pararSomNotificacao;
window.iniciarRealtimePedidos = iniciarRealtimePedidos;
