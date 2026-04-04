// src/main.js
// Entry point do Vite — importa CSS e todos os módulos
// As funções são expostas em window.* para compatibilidade com os onclick="" do HTML.
// Conforme o projeto crescer, migre os handlers para addEventListener() e remova os globals.

import './style.css'

import { goTo, closeModal, togglePwVis, maskDoc, maskWpp, maskPhone,
         previewLogo, applyCropTransform, cancelCrop, confirmCrop } from './modules/ui.js'

import { doLogin, doRegister, loginDemo, fazerLogout, initAuth } from './modules/auth.js'

import { setBilling, selectPlan, goToMercadoPago } from './modules/payment.js'

import { initDashboard, switchTab, switchTabFin,
         toggleLojaAberta, copyLink, openDemo, refreshStats } from './modules/dashboard.js'

import { orderActions } from './modules/orders.js'

import { saveSettings, salvarOpcaoEntrega, salvarHorarios,
         selecionarTempo, selColor, updateSettingsLogo } from './modules/settings.js'

// ── Exporta para window (handlers inline do HTML) ──────────────────────────
Object.assign(window, {
  // ui
  goTo, closeModal, togglePwVis, maskDoc, maskWpp, maskPhone,
  previewLogo, applyCropTransform, cancelCrop, confirmCrop,

  // auth
  doLogin, doRegister, loginDemo, fazerLogout,

  // payment
  setBilling, selectPlan, goToMercadoPago,

  // dashboard
  switchTab, switchTabFin, toggleLojaAberta, copyLink, openDemo,

  // settings
  saveSettings, salvarOpcaoEntrega, salvarHorarios,
  selecionarTempo, selColor, updateSettingsLogo,
})

// Ações de pedido acessíveis via onclick no card de pedidos
window.__orders = orderActions

// ── Lazy imports (só carregam quando necessário) ──────────────────────────
// menu.js, store.js, checkout.js, financial.js, flash.js, game.js, ceo.js
// são importados dinamicamente pelos módulos que os utilizam (ex: dashboard.js)
// Isso reduz o bundle inicial e melhora o LCP.

// ── Inicialização ─────────────────────────────────────────────────────────
initAuth(async (user) => {
  const { initDashboard: init } = await import('./modules/dashboard.js')
  const { supabase } = await import('./lib/supabase.js')

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!store) return goTo('s-payment')
  if (store.status === 'pending')  return goTo('s-pending')
  if (store.status === 'inactive') return goTo('s-inactive')

  window.__store = store
  await init(store)
  goTo('s-dash')
})

// ── Lazy load de módulos pelo botão de aba (evita carregar tudo de início) ─
document.addEventListener('click', async (e) => {
  const tb = e.target.closest('.tb')
  if (!tb) return

  const onclick = tb.getAttribute('onclick') || ''

  if (onclick.includes('t-menu')) {
    const { initMenu } = await import('./modules/menu.js')
    initMenu(window.__store)
  }
  if (onclick.includes('t-flash')) {
    const { initFlash } = await import('./modules/flash.js')
    initFlash(window.__store)
  }
  if (onclick.includes('t-settings')) {
    const { loadSettings } = await import('./modules/settings.js')
    loadSettings(window.__store)
  }
})
