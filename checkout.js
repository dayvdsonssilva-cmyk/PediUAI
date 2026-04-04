// src/modules/payment.js

const PLANS = {
  basico: {
    monthly: { price: 39.90, label: 'R$ 39,90', annual: null },
    annual:  { price: 29.90, label: 'R$ 29,90', annual: 'cobrado anualmente: R$ 358,80' },
  },
  ultra: {
    monthly: { price: 99.90, label: 'R$ 99,90', annual: null },
    annual:  { price: 79.90, label: 'R$ 79,90', annual: 'cobrado anualmente: R$ 958,80' },
  },
}

let selectedPlan    = null   // 'basico' | 'ultra'
let selectedBilling = 'monthly'  // 'monthly' | 'annual'

// ── Alterna ciclo de cobrança ─────────────────────────────────────────────
export function setBilling(type, el) {
  selectedBilling = type
  document.querySelectorAll('.billing-opt').forEach(o => o.classList.remove('active'))
  el.classList.add('active')
  updatePriceDisplay()
}

// ── Seleciona plano ───────────────────────────────────────────────────────
export function selectPlan(plan) {
  selectedPlan = plan

  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'))
  document.getElementById(`plan-${plan}`)?.classList.add('selected')

  const data = PLANS[plan][selectedBilling]
  const info  = document.getElementById('plan-selected-info')
  const title = document.getElementById('psi-title')
  const desc  = document.getElementById('psi-desc')

  if (info && title && desc) {
    title.textContent = plan === 'basico' ? 'Plano Básico selecionado' : 'Plano Ultra selecionado ⭐'
    desc.textContent  = `${data.label}/mês${data.annual ? ' · ' + data.annual : ''}`
    info.style.display = 'block'
  }
}

// ── Atualiza preços na tela conforme o ciclo ──────────────────────────────
function updatePriceDisplay() {
  for (const plan of ['basico', 'ultra']) {
    const data   = PLANS[plan][selectedBilling]
    const priceEl  = document.getElementById(`price-${plan}`)
    const annualEl = document.getElementById(`annual-${plan}`)

    if (priceEl)  priceEl.textContent = data.label
    if (annualEl) {
      annualEl.textContent = data.annual || ''
      annualEl.style.display = data.annual ? 'block' : 'none'
    }
  }
  // Atualiza card selecionado se já havia seleção
  if (selectedPlan) selectPlan(selectedPlan)
}

// ── Redireciona para Mercado Pago ─────────────────────────────────────────
export async function goToMercadoPago() {
  if (!selectedPlan) return alert('Selecione um plano antes de prosseguir.')

  const email = window.__pendingEmail || ''  // definido após o registro
  const name  = window.__pendingName  || ''

  const btn = document.getElementById('pay-btn')
  if (btn) { btn.disabled = true; btn.textContent = 'Aguarde...' }

  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan, billing: selectedBilling, email, name }),
    })

    if (!res.ok) throw new Error('Erro ao criar preferência')

    const { init_point, sandbox_init_point } = await res.json()

    // Em produção usa init_point, em dev usa sandbox
    const url = import.meta.env.DEV ? sandbox_init_point : init_point
    window.location.href = url

  } catch (err) {
    console.error('[Payment]', err)
    alert('Erro ao iniciar pagamento. Tente novamente.')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Pagar com Mercado Pago 💳' }
  }
}
