import { state } from './config.js';
import { showNotif, saveCurrentUser, openModal } from './utils.js';
import { getSupa } from './supabase.js';
import { pararSomNotificacao } from './ui.js';

export function sLabel(s) {
  return s === 'new' ? 'Novo' : s === 'preparing' ? 'Preparando' : s === 'ready' ? 'Pronto' : s === 'rejected' ? 'Recusado' : 'Entregue';
}

export function renderOrdersList() {
  const orders = state.currentUser?.orders || [];
  const newOrders = orders.filter(o => o.status === 'new');
  const otherOrders = orders.filter(o => o.status !== 'new');

  const newCount = document.getElementById('new-orders-count');
  if (newCount) newCount.textContent = newOrders.length > 0 ? ` (${newOrders.length})` : '';

  const newOrdersContainer = document.getElementById('new-orders-container');
  if (newOrdersContainer) {
    if (!newOrders.length) {
      newOrdersContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink3);font-weight:500">\u2705 Nenhum novo pedido</div>';
    } else {
      newOrdersContainer.innerHTML = newOrders.map((o) => {
        const realIdx = orders.indexOf(o);
        return `<div class="oc" style="background:var(--white);border:2px solid var(--brand);margin-bottom:1rem;padding:1.1rem;border-radius:var(--r);transition:all .2s" onmouseover="this.style.boxShadow='0 4px 12px rgba(232,65,10,.15)'" onmouseout="this.style.boxShadow='none'">
    <div class="oh"><div>
      <div class="oid" style="font-size:1rem;font-weight:800;color:var(--brand)">${o.id} \u2013 ${o.client}</div>
      <div class="ometa">${o.time} \u00B7 ${o.delivery === 'pickup' ? '\u{1F3C3} Retirada' : '\u{1F6F5} ' + o.address} \u00B7 \u{1F4DE} ${o.phone || '\u2013'}</div>
    </div></div>
    <div class="oi" style="margin:0.7rem 0;font-size:.95rem;font-weight:600">${o.items.map(it => `${it.qty}x ${it.name}`).join(' \u2022 ')}</div>
    <div class="of" style="border-top:1px solid var(--border);padding-top:.8rem;margin-top:.8rem">
      <div class="ot" style="font-size:1.4rem;font-weight:800;color:var(--brand)">R$ ${o.total.toFixed(2).replace('.', ',')}</div>
      <div class="oacts" style="display:flex;gap:.5rem;margin-top:.8rem;flex-wrap:wrap">
        <button class="btn btn-brand" style="flex:1;font-size:.76rem;padding:.5rem .8rem;font-weight:700" onclick="markPreparing(${realIdx})">\u2705 ACEITAR</button>
        <button class="btn" style="flex:1;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;font-size:.76rem;padding:.5rem .8rem;font-weight:700" onclick="recusarPedido(${realIdx})">\u2715 RECUSAR</button>
        <button class="btn" style="border:1px solid var(--border);color:var(--ink2);font-size:.7rem;padding:.35rem .7rem;flex:1" onclick="viewReceipt(${realIdx})">\u{1F4C4} Notinha</button>
      </div>
    </div>
  </div>`;
      }).join('');
    }
  }

  document.getElementById('orders-count').textContent = otherOrders.length + ' pedido(s)';
  const list = document.getElementById('orders-list');
  if (!otherOrders.length) {
    list.innerHTML = '<div class="es"><div class="ei">\u{1F4ED}</div><p>Nenhum pedido no hist\u00F3rico</p></div>';
    return;
  }
  list.innerHTML = otherOrders.map((o) => {
    const realIdx = orders.indexOf(o);
    return `<div class="oc">
    <div class="oh"><div><div class="oid">${o.id} \u2013 ${o.client}</div><div class="ometa">${o.time} \u00B7 ${o.delivery === 'pickup' ? '\u{1F3C3} Retirada' : '\u{1F6F5} ' + o.address} \u00B7 \u{1F4DE} ${o.phone || '\u2013'}</div></div>
    <span class="sb s-${o.status}">${sLabel(o.status)}</span></div>
    <div class="oi">${o.items.map(it => `${it.qty}x ${it.name}`).join(' \u2022 ')}</div>
    <div class="of"><div class="ot">R$ ${o.total.toFixed(2).replace('.', ',')}</div>
    <div class="oacts">
      <button class="btn" style="border:1px solid var(--border);color:var(--ink2);font-size:.7rem;padding:.35rem .7rem" onclick="viewReceipt(${realIdx})">\u{1F4C4} Notinha</button>
      ${o.status === 'preparing' ? `<button class="btn btn-brand" style="font-size:.7rem;padding:.35rem .7rem" onclick="markReady(${realIdx})">\u2705 Pronto</button>` : ''}
      ${o.status === 'rejected' ? '<span style="font-size:.72rem;color:#DC2626;font-weight:700">Pedido recusado</span>' : ''}
    </div></div>
  </div>`;
  }).join('');
}

export function renderOverviewOrders() {
  const orders = state.currentUser?.orders || [];
  const el = document.getElementById('ov-orders');
  const recent = orders.slice(0, 2);
  if (!recent.length) { el.innerHTML = '<div class="es"><p>Nenhum pedido ainda</p></div>'; return; }
  el.innerHTML = recent.map(o => `<div class="oc" style="margin-bottom:.8rem">
    <div class="oh"><div><div class="oid">${o.id} \u2013 ${o.client}</div><div class="ometa">${o.time}</div></div><span class="sb s-${o.status}">${sLabel(o.status)}</span></div>
    <div class="oi">${o.items.map(it => `${it.qty}x ${it.name}`).join(' \u2022 ')}</div>
    <div style="padding-top:.55rem;border-top:1px solid var(--border);margin-top:.45rem;font-family:'Poppins',sans-serif;font-weight:700">R$ ${o.total.toFixed(2).replace('.', ',')}</div>
  </div>`).join('');
}

export async function recusarPedido(i) {
  if (!state.currentUser || !confirm('Recusar este pedido?')) return;
  pararSomNotificacao();
  state.currentUser.orders[i].status = 'rejected';
  saveCurrentUser(); renderOrdersList(); renderOverviewOrders();
  const db = getSupa();
  const o = state.currentUser.orders[i];
  if (db && o.supaId) {
    await db.from('orders').update({ status: 'rejected' }).eq('id', o.supaId);
  }
  showNotif('\u2715 Pedido recusado', o.client + ' foi notificado.');
}

export async function markPreparing(i) {
  if (!state.currentUser) return;
  pararSomNotificacao();
  state.currentUser.orders[i].status = 'preparing';
  saveCurrentUser(); renderOrdersList(); renderOverviewOrders();
  const db = getSupa();
  const o = state.currentUser.orders[i];
  if (db && o.supaId) {
    await db.from('orders').update({ status: 'preparing' }).eq('id', o.supaId);
  }
}

export async function markReady(i) {
  if (!state.currentUser) return;
  state.currentUser.orders[i].status = 'ready';
  saveCurrentUser(); renderOrdersList(); renderOverviewOrders();
  const { showCSNotif } = await import('./ui.js');
  showCSNotif('ready');
  const db = getSupa();
  const o = state.currentUser.orders[i];
  if (db && o.supaId) {
    await db.from('orders').update({ status: 'ready' }).eq('id', o.supaId);
  }
}

export function viewReceipt(i) {
  const o = state.currentUser?.orders[i]; if (!o) return;
  document.getElementById('receipt-content').innerHTML = buildReceipt(o);
  openModal('modal-receipt');
}

export function buildReceipt(o) {
  const items = o.items.map(it => `<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.3rem 0;gap:.8rem"><span>${it.qty}x ${it.name}</span><span>R$ ${(it.qty * it.price).toFixed(2).replace('.', ',')}</span></div>`).join('');
  return `<div style="background:var(--white);border-radius:16px;padding:1.2rem;border:1px solid var(--border)">
    <div style="text-align:center;padding-bottom:.85rem;border-bottom:1px dashed var(--border);margin-bottom:.85rem"><span style="font-family:'Poppins',sans-serif;font-weight:800;font-size:1.15rem">PEDI<span style="color:var(--brand)">WAY</span></span><div style="font-size:.72rem;color:var(--ink3);margin-top:.2rem">${state.currentUser?.name || 'Estabelecimento'}</div></div>
    <div style="font-size:.82rem;padding:.3rem 0;display:flex;justify-content:space-between;gap:.8rem"><span style="color:var(--ink3);font-weight:600">Nome</span><span style="font-weight:700;text-align:right">${o.client}</span></div>
    <div style="font-size:.82rem;padding:.3rem 0;display:flex;justify-content:space-between;gap:.8rem"><span style="color:var(--ink3);font-weight:600">Telefone</span><span style="text-align:right">${o.phone || '\u2013'}</span></div>
    <div style="font-size:.82rem;padding:.3rem 0;display:flex;justify-content:space-between;gap:.8rem"><span style="color:var(--ink3);font-weight:600">Entrega</span><span style="text-align:right">${o.delivery === 'pickup' ? '\u{1F3C3} Retirada' : '\u{1F6F5} ' + o.address}</span></div>
    <hr style="border:none;border-top:1px dashed var(--border);margin:.7rem 0">
    <div style="font-size:.68rem;color:var(--ink3);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Pedido</div>
    ${items}
    <hr style="border:none;border-top:1px dashed var(--border);margin:.7rem 0">
    <div style="display:flex;justify-content:space-between;font-family:'Poppins',sans-serif;font-weight:800;font-size:1rem"><span>Total</span><span style="color:var(--brand)">R$ ${o.total.toFixed(2).replace('.', ',')}</span></div>
    <div style="font-size:.82rem;padding:.3rem 0;display:flex;justify-content:space-between;gap:.8rem;margin-top:.3rem"><span style="color:var(--ink3);font-weight:600">Pagamento</span><span>${o.payment}</span></div>
    <div style="text-align:center;margin-top:.85rem;padding-top:.85rem;border-top:1px dashed var(--border);font-size:.72rem;color:var(--ink3)">Pedido ${o.id} \u00B7 ${new Date().toLocaleDateString('pt-BR')}<br>Obrigado pela prefer\u00EAncia! \u{1F49B}</div>
  </div>`;
}

export { showCSNotif } from './ui.js';
