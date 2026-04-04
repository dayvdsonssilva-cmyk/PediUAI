// src/modules/orders.js
import { supabase } from '../lib/supabase.js'
import { showNotif } from './ui.js'

let storeId       = null
let subscription  = null

const STATUS_LABELS = {
  new:      { label: 'Novo',       cls: 's-new'  },
  preparing:{ label: 'Preparando', cls: 's-prep' },
  ready:    { label: 'Pronto',     cls: 's-ready'},
  done:     { label: 'Entregue',   cls: 's-done' },
  rejected: { label: 'Recusado',   cls: 's-done' },
}

// ── Inicializa listener em tempo real ─────────────────────────────────────
export async function initOrders(store) {
  storeId = store.id

  await loadOrders()

  // Encerra subscription anterior se houver
  subscription?.unsubscribe()

  subscription = supabase
    .channel(`orders:${storeId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: `store_id=eq.${storeId}`,
    }, (payload) => {
      handleOrderChange(payload)
    })
    .subscribe()
}

// ── Carrega pedidos iniciais ───────────────────────────────────────────────
async function loadOrders() {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!data) return

  const newOrders  = data.filter(o => o.status === 'new')
  const histOrders = data.filter(o => o.status !== 'new')

  renderNewOrders(newOrders)
  renderHistoryOrders(histOrders)
  updateOrdersCount(newOrders.length, histOrders.length)
}

// ── Reage a mudanças em tempo real ────────────────────────────────────────
function handleOrderChange(payload) {
  if (payload.eventType === 'INSERT') {
    showNotif('🔔 Novo pedido!', `#${payload.new.id_display} — R$ ${payload.new.total?.toFixed(2)}`)
    playBeep()
  }
  loadOrders() // recarrega a lista completa
}

// ── Renderização ──────────────────────────────────────────────────────────
function renderNewOrders(orders) {
  const container = document.getElementById('new-orders-container')
  if (!container) return

  if (!orders.length) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--ink3);font-size:.84rem">Nenhum pedido novo no momento ☕</div>'
    return
  }

  container.innerHTML = orders.map(o => orderCard(o, true)).join('')
}

function renderHistoryOrders(orders) {
  const container = document.getElementById('orders-list')
  if (!container) return
  container.innerHTML = orders.length
    ? orders.map(o => orderCard(o, false)).join('')
    : '<div style="text-align:center;padding:2rem;color:var(--ink3);font-size:.84rem">Sem histórico ainda</div>'
}

function orderCard(order, isNew) {
  const status = STATUS_LABELS[order.status] ?? { label: order.status, cls: 's-new' }
  const items  = JSON.parse(order.items || '[]')
  const itemsStr = items.map(i => `${i.qty}x ${i.name}`).join(', ')
  const date   = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })

  return `
  <div class="oc">
    <div class="oh">
      <div>
        <div class="oid">#${order.id_display}</div>
        <div class="ometa">${order.customer_name} · ${date}</div>
      </div>
      <span class="sb ${status.cls}">${status.label}</span>
    </div>
    <div class="oi">${itemsStr}</div>
    ${order.obs ? `<div style="font-size:.76rem;color:var(--ink3);margin-bottom:.65rem">📝 ${order.obs}</div>` : ''}
    <div class="of">
      <span class="ot">R$ ${order.total?.toFixed(2).replace('.', ',')}</span>
      <div class="oacts">
        ${isNew ? `
          <button class="btn btn-outline" style="font-size:.74rem;padding:.3rem .75rem" onclick="window.__orders.reject('${order.id}')">Recusar</button>
          <button class="btn btn-brand" style="font-size:.74rem;padding:.3rem .75rem" onclick="window.__orders.accept('${order.id}')">✓ Aceitar</button>
        ` : `
          ${order.status === 'preparing' ? `<button class="btn btn-outline" style="font-size:.74rem;padding:.3rem .75rem" onclick="window.__orders.markReady('${order.id}')">Marcar como pronto</button>` : ''}
          ${order.status === 'ready' ? `<button class="btn btn-brand" style="font-size:.74rem;padding:.3rem .75rem" onclick="window.__orders.markDone('${order.id}')">✓ Entregue</button>` : ''}
        `}
      </div>
    </div>
  </div>`
}

// ── Ações de pedido (expostas via window.__orders) ────────────────────────
export const orderActions = {
  async accept(id) {
    await supabase.from('orders').update({ status: 'preparing' }).eq('id', id)
  },
  async reject(id) {
    await supabase.from('orders').update({ status: 'rejected' }).eq('id', id)
  },
  async markReady(id) {
    await supabase.from('orders').update({ status: 'ready' }).eq('id', id)
  },
  async markDone(id) {
    await supabase.from('orders').update({ status: 'done' }).eq('id', id)
  },
}

function updateOrdersCount(newCount, histCount) {
  const nc = document.getElementById('new-orders-count')
  const oc = document.getElementById('orders-count')
  if (nc) nc.textContent = newCount ? `${newCount} novo${newCount > 1 ? 's' : ''}` : ''
  if (oc) oc.textContent = histCount ? `${histCount} no histórico` : ''
}

// ── Som de notificação ────────────────────────────────────────────────────
function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    osc.connect(ctx.destination)
    osc.frequency.value = 880
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {}
}
