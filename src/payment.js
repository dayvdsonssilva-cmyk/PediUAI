// src/payment.js
export function goToMercadoPago() {
  alert("🔄 Redirecionando para o Mercado Pago...\n(Em desenvolvimento)");
}

export function selectPlan(plan) {
  console.log("Plano selecionado:", plan);
}

// Torna global
window.goToMercadoPago = goToMercadoPago;
window.selectPlan = selectPlan;
