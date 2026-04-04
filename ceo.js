// src/modules/store.js
// Vitrine do cliente — cardápio público
import { supabase } from '../lib/supabase.js'
import { goTo } from './ui.js'

export async function loadStore(slugOrId) {
  const { data: store } = await supabase
    .from('stores')
    .select('*, menu_items(*), flashes(*)')
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
    .single()

  if (!store) { goTo('sl'); return }

  window.__clientStore = store

  // Popula hero
  document.getElementById('sn').textContent = store.name
  document.getElementById('sd').textContent = store.description || ''
  document.getElementById('se').textContent = store.emoji || '🍽️'

  if (!store.is_open) {
    document.getElementById('loja-fechada-banner').style.display = 'flex'
  }

  renderClientMenu(store.menu_items || [])
  renderFlashSection(store.flashes || [])
}

function renderClientMenu(items) {
  // Agrupa por categoria
  const byCategory = items.reduce((acc, item) => {
    if (!item.available) return acc
    const cat = item.category || 'Outros'
    acc[cat] = acc[cat] || []
    acc[cat].push(item)
    return acc
  }, {})

  // Tabs de categoria
  const catEl = document.getElementById('cat-tabs')
  if (catEl) {
    catEl.innerHTML = Object.keys(byCategory).map((cat, i) =>
      `<button class="ct ${i===0?'active':''}" onclick="filterCat('${cat}', this)">${cat}</button>`
    ).join('')
  }

  // Items
  const menuEl = document.getElementById('client-menu')
  if (menuEl) {
    menuEl.innerHTML = Object.entries(byCategory).map(([cat, catItems]) =>
      `<div class="cat-section" data-cat="${cat}">
        <div class="cat-title">${cat}</div>
        ${catItems.map(item => clientItemCard(item)).join('')}
      </div>`
    ).join('')
  }
}

function clientItemCard(item) {
  const img = item.photos?.[0]
    ? `<img src="${item.photos[0]}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`
    : `<div style="font-size:2rem">${item.emoji || '🍽️'}</div>`

  return `<div class="ci" onclick="window.__store_view.openItem('${item.id}')">
    <div class="ci-info">
      <div class="ci-name">${item.name}</div>
      <div class="ci-desc">${item.description || ''}</div>
      <div class="ci-price">R$ ${item.price.toFixed(2).replace('.', ',')}</div>
    </div>
    <div class="ci-med"><div class="ci-med-inner">${img}</div></div>
  </div>`
}

function renderFlashSection(flashes) {
  const active = flashes.filter(f => {
    const expiresAt = new Date(f.created_at).getTime() + 4 * 60 * 60 * 1000
    return Date.now() < expiresAt
  })
  const sec = document.getElementById('flash-client-sec')
  if (sec) sec.style.display = active.length ? 'block' : 'none'
}

export function switchClientTab(tab) {
  document.querySelectorAll('.mp-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.mp-panel').forEach(p => p.classList.remove('active'))
  document.getElementById(`tab-${tab}`)?.classList.add('active')
  document.getElementById(`panel-${tab}`)?.classList.add('active')
}

export function goBackFromStore() {
  goTo('s-store')
}

export function openWhatsApp() {
  const store = window.__clientStore
  const wpp   = store?.whatsapp
  if (!wpp) return
  window.open(`https://wa.me/55${wpp}`, '_blank')
}

window.__store_view = {
  openItem(id) {
    const store = window.__clientStore
    const item  = store?.menu_items?.find(i => i.id === id)
    if (!item) return
    // popula modal e abre
    document.getElementById('pm-name').textContent  = item.name
    document.getElementById('pm-desc').textContent  = item.description || ''
    document.getElementById('pm-price').textContent = `R$ ${item.price.toFixed(2).replace('.', ',')}`
    document.getElementById('pm-cat').textContent   = item.category || ''
    document.getElementById('pm-emoji').textContent = item.emoji || '🍽️'

    const addBtn = document.getElementById('pm-add')
    if (addBtn) addBtn.onclick = () => {
      addToCart(item)
      import('./ui.js').then(m => m.closeModal('modal-product'))
    }

    import('./ui.js').then(m => m.openModal('modal-product'))
  }
}

// ── Carrinho ──────────────────────────────────────────────────────────────
let cart = []

export function addToCart(item) {
  const existing = cart.find(c => c.id === item.id)
  if (existing) existing.qty++
  else cart.push({ ...item, qty: 1 })
  updateCartFab()
}

function updateCartFab() {
  const fab    = document.getElementById('cart-fab')
  const cnt    = document.getElementById('cart-cnt')
  const total  = document.getElementById('cart-total-fab')
  const sum    = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const count  = cart.reduce((s, i) => s + i.qty, 0)

  if (fab)   fab.style.display = count ? 'flex' : 'none'
  if (cnt)   cnt.textContent   = count
  if (total) total.textContent = `R$ ${sum.toFixed(2).replace('.', ',')}`

  window.__cart = cart
}
