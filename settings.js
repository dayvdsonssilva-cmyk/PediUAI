// src/modules/dashboard.js
import { supabase } from '../lib/supabase.js'
import { goTo } from './ui.js'

let currentStore = null

// ── Inicializa dashboard com dados da loja ────────────────────────────────
export async function initDashboard(store) {
  currentStore = store

  // Nome da loja na navbar
  const nameEl = document.getElementById('dash-sname')
  if (nameEl) nameEl.textContent = store.name

  // Link do cardápio
  const linkEl = document.getElementById('dash-link')
  const slug = store.slug || store.id
  if (linkEl) linkEl.textContent = `pediway.com.br/restaurante/${slug}`

  // Plano ativo
  const planEl = document.getElementById('st-plan')
  if (planEl) planEl.textContent = store.plan === 'ultra' ? 'Ultra' : 'Básico'

  // Carrega stats
  await refreshStats()

  // Carrega pedidos em tempo real
  const { initOrders } = await import('./orders.js')
  initOrders(store)

  // Tab de financeiro — só ultra
  const finTab = document.getElementById('tb-fin')
  if (finTab && store.plan !== 'ultra') finTab.classList.add('locked')

  // Status loja aberta/fechada
  const toggle = document.getElementById('toggle-loja-open')
  if (toggle) toggle.checked = store.is_open !== false
  syncLojaStatus(store.is_open !== false)
}

// ── Troca de abas do dashboard ────────────────────────────────────────────
export function switchTab(tabId) {
  document.querySelectorAll('.dash-content .tp').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tb').forEach(t => t.classList.remove('active'))

  const tab = document.getElementById(tabId)
  if (tab) tab.classList.add('active')

  // Ativa botão correspondente
  document.querySelectorAll('.tb').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(tabId)) btn.classList.add('active')
  })
}

export function switchTabFin() {
  if (!currentStore) return
  if (currentStore.plan !== 'ultra') {
    // Mostra banner de upgrade
    document.getElementById('fin-lock-banner')?.style.removeProperty('display')
    document.getElementById('fin-content')?.style.setProperty('display','none')
  } else {
    document.getElementById('fin-lock-banner')?.style.setProperty('display','none')
    document.getElementById('fin-content')?.style.removeProperty('display')
    import('./financial.js').then(m => m.loadFinancial(currentStore, 'hoje'))
  }
  switchTab('t-financeiro')
}

// ── Toggle loja aberta/fechada ────────────────────────────────────────────
export async function toggleLojaAberta() {
  const toggle = document.getElementById('toggle-loja-open')
  const isOpen = toggle?.checked ?? true

  syncLojaStatus(isOpen)

  if (!currentStore) return
  await supabase
    .from('stores')
    .update({ is_open: isOpen })
    .eq('id', currentStore.id)
}

function syncLojaStatus(isOpen) {
  const txt   = document.getElementById('loja-status-txt')
  const thumb = document.getElementById('thumb-loja')
  const ball  = document.getElementById('ball-loja')

  if (txt) txt.textContent = isOpen ? '🟢 Loja aberta' : '🔴 Loja fechada'
  if (thumb) thumb.style.background = isOpen ? 'var(--brand)' : '#ccc'
  if (ball)  ball.style.transform   = isOpen ? 'translateX(24px)' : 'translateX(0)'
}

// ── Copia link do cardápio ─────────────────────────────────────────────────
export function copyLink() {
  const slug = currentStore?.slug || currentStore?.id || 'demo'
  const url  = `https://pediway.com.br/restaurante/${slug}`
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('.cb')
    if (btn) { btn.textContent = 'Copiado!'; setTimeout(() => (btn.textContent = 'Copiar'), 2000) }
  })
}

// ── Stats (pedidos hoje / faturamento) ────────────────────────────────────
export async function refreshStats() {
  if (!currentStore) return

  const today = new Date().toISOString().split('T')[0]
  const { data: orders } = await supabase
    .from('orders')
    .select('total, status')
    .eq('store_id', currentStore.id)
    .gte('created_at', today)
    .eq('status', 'done')

  const count   = orders?.length ?? 0
  const revenue = orders?.reduce((s, o) => s + (o.total || 0), 0) ?? 0

  const todayEl = document.getElementById('st-today')
  const revEl   = document.getElementById('st-rev')
  const itemsEl = document.getElementById('st-items')

  if (todayEl) todayEl.textContent = count
  if (revEl)   revEl.textContent   = `R$ ${revenue.toFixed(2).replace('.', ',')}`

  if (itemsEl) {
    const { count: itemCount } = await supabase
      .from('menu_items')
      .select('id', { count: 'exact' })
      .eq('store_id', currentStore.id)
    itemsEl.textContent = itemCount ?? 0
  }
}

// ── Abre demo da loja ─────────────────────────────────────────────────────
export function openDemo() {
  import('./store.js').then(m => m.loadStore('demo'))
  goTo('s-store')
  const backBtn = document.getElementById('demo-back-btn')
  if (backBtn) backBtn.style.display = 'flex'
}
