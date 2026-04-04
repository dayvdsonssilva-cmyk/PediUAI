// src/modules/checkout.js
import { supabase } from '../lib/supabase.js'
import { goTo } from './ui.js'

let deliveryType = 'delivery'
let paymentMethod = 'Pix'

export function setDeliveryType(type) {
  deliveryType = type
  document.getElementById('dt-delivery')?.classList.toggle('active', type === 'delivery')
  document.getElementById('dt-pickup')?.classList.toggle('active',   type === 'pickup')
  document.getElementById('address-block')?.style.setProperty('display', type === 'delivery' ? 'block' : 'none')
  updateCheckoutTotal()
}

export function selPayment(el, method) {
  paymentMethod = method
  document.querySelectorAll('.po').forEach(p => p.classList.remove('selected'))
  el.classList.add('selected')
}

export function placeOrder() {
  const name  = document.getElementById('cl-name')?.value.trim()
  const phone = document.getElementById('cl-phone')?.value.trim()
  const addr  = deliveryType === 'delivery' ? document.getElementById('cl-addr')?.value.trim() : null

  if (!name || !phone || (deliveryType === 'delivery' && !addr)) {
    return alert('Preencha todos os campos obrigatórios.')
  }

  // Popula tela de confirmação
  const cart  = window.__cart || []
  const store = window.__clientStore
  const fee   = (deliveryType === 'delivery' && store?.delivery_fee) ? store.delivery_fee : 0
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0) + fee

  document.getElementById('confirm-data-items').innerHTML =
    cart.map(i => `${i.qty}x ${i.name} — R$ ${(i.price * i.qty).toFixed(2).replace('.', ',')}`).join('<br>')

  document.getElementById('confirm-data-total').textContent =
    `R$ ${total.toFixed(2).replace('.', ',')}`

  document.getElementById('confirm-data-delivery').innerHTML =
    deliveryType === 'delivery'
      ? `${name}<br>${phone}<br>${addr}${document.getElementById('cl-comp')?.value ? '<br>' + document.getElementById('cl-comp').value : ''}`
      : `${name}<br>${phone}<br>Retirada no local`

  document.getElementById('confirm-data-payment').textContent = paymentMethod

  goTo('s-confirm-data')
}

export async function confirmAndSendOrder() {
  const cart  = window.__cart || []
  const store = window.__clientStore
  if (!cart.length || !store) return

  const fee    = (deliveryType === 'delivery' && store.delivery_fee) ? store.delivery_fee : 0
  const total  = cart.reduce((s, i) => s + i.price * i.qty, 0) + fee
  const name   = document.getElementById('cl-name')?.value.trim()
  const phone  = document.getElementById('cl-phone')?.value.trim()
  const addr   = document.getElementById('cl-addr')?.value.trim()
  const obs    = document.getElementById('cl-obs')?.value.trim()

  const { data: order, error } = await supabase.from('orders').insert({
    store_id:      store.id,
    customer_name: name,
    customer_phone: phone,
    address:       addr,
    items:         JSON.stringify(cart),
    total,
    payment:       paymentMethod,
    delivery_type: deliveryType,
    obs,
    status:        'new',
  }).select().single()

  if (error) { console.error('[Checkout]', error); return alert('Erro ao enviar pedido.') }

  document.getElementById('conf-order-id').textContent = `#${order.id_display || order.id.slice(-4).toUpperCase()}`

  window.__cart = []
  goTo('s-confirm')

  import('./game.js').then(m => m.initGame())
  subscribeToOrderStatus(order.id)
}

async function subscribeToOrderStatus(orderId) {
  supabase
    .channel(`order-status:${orderId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      (payload) => {
        const labels = { preparing: '👨‍🍳 Preparando', ready: '✅ Pronto para entrega', done: '🎉 Entregue!' }
        const bar = document.getElementById('client-status-bar')
        const wait = document.getElementById('status-waiting')
        if (bar && labels[payload.new.status]) {
          bar.innerHTML = `<div class="csb-item active">${labels[payload.new.status]}</div>`
          bar.style.display = 'block'
          if (wait) wait.style.display = 'none'
        }
      })
    .subscribe()
}

function updateCheckoutTotal() {
  const cart  = window.__cart || []
  const store = window.__clientStore
  const fee   = (deliveryType === 'delivery' && store?.delivery_fee) ? store.delivery_fee : 0
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0) + fee

  document.getElementById('co-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`
  const feeRow = document.getElementById('co-taxa-row')
  const feeEl  = document.getElementById('co-taxa')
  if (feeRow) feeRow.style.display = fee ? 'flex' : 'none'
  if (feeEl)  feeEl.textContent = `R$ ${fee.toFixed(2).replace('.', ',')}`
}
