// src/orders.js - Versão completa com Realtime
import { state } from './config.js';
import { showNotif, saveCurrentUser } from './utils.js';
import { getSupa } from './supabase.js';

let realtimeChannel = null;

// Renderiza a lista de pedidos
export function renderOrdersList() {
  const container = document.getElementById('new-orders-container') || document.getElementById('orders-list');
  if (!container) return;

  const orders = state.currentUser?.orders || [];
  const newOrders = orders.filter(o => o.status === 'new');

  // Atualiza contador de novos pedidos
  const countEl = document.getElementById('new-orders-count');
  if (countEl) countEl.textContent = newOrders.length > 0 ? ` (${newOrders.length})` : '';

  if (newOrders.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">Nenhum novo pedido no momento</div>';
  } else {
    container.innerHTML = newOrders.map((order, idx) => `
      <div class="order-card" style="background:#fff;border:2px solid #FF6B00;border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="font-weight:700;color:#FF6B00;">${order.id} - ${order.client}</div>
        <div style="font-size:0.9rem;color:#666;">${order.items ? order.items.map(i => `${i.qty}x ${i.name}`).join(', ') : ''}</div>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button onclick="acceptOrder(${idx})" style="background:#FF6B00;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;flex:1;">✅ Aceitar</button>
          <button onclick="rejectOrder(${idx})" style="background:#eee;color:#333;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;flex:1;">Recusar</button>
        </div>
      </div>
    `).join('');
  }
}

// Aceitar pedido
window.acceptOrder = function(idx) {
  if (!state.currentUser?.orders) return;
  state.currentUser.orders[idx].status = 'preparing';
  saveCurrentUser();
  renderOrdersList();
  showNotif('✅ Pedido aceito', 'O cliente foi notificado');
};

// Recusar pedido
window.rejectOrder = function(idx) {
  if (!state.currentUser?.orders) return;
  if (confirm('Tem certeza que deseja recusar este pedido?')) {
    state.currentUser.orders[idx].status = 'rejected';
    saveCurrentUser();
    renderOrdersList();
    showNotif('❌ Pedido recusado', 'O cliente foi notificado');
  }
};

// ====================== REALTIME ======================
export function iniciarRealtimePedidos() {
  const supa = getSupa();
  if (!supa || !state.currentUser?.id) return;

  // Remove canal antigo se existir
  if (realtimeChannel) supa.removeChannel(realtimeChannel);

  realtimeChannel = supa
    .channel('pedidos-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
      filter: `establishment_id=eq.${state.currentUser.id}`
    }, (payload) => {
      console.log('🛎 Novo pedido recebido via realtime!', payload.new);

      const novoPedido = {
        id: '#' + String(Date.now()).slice(-4),
        client: payload.new.client_name,
        phone: payload.new.client_phone,
        address: payload.new.address,
        items: typeof payload.new.items === 'string' ? JSON.parse(payload.new.items) : payload.new.items,
        total: Number(payload.new.total),
        status: 'new',
        time: 'agora'
      };

      if (!state.currentUser.orders) state.currentUser.orders = [];
      state.currentUser.orders.unshift(novoPedido);

      saveCurrentUser();
      renderOrdersList();
      tocarSomNovoPedido();
      showNotif('🛎 Novo Pedido!', `${novoPedido.client} - R$ ${novoPedido.total}`);
    })
    .subscribe();

  console.log('📡 Realtime de pedidos ativado');
}

export function tocarSomNovoPedido() {
  const audio = new Audio('/sounds/new-order.mp3');
  audio.volume = 0.8;
  audio.play().catch(() => console.log("Som bloqueado pelo navegador"));
}

// Torna global
window.renderOrdersList = renderOrdersList;
window.iniciarRealtimePedidos = iniciarRealtimePedidos;
