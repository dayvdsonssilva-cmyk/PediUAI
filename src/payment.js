// src/payment.js
import { showToast, goTo } from './utils.js';
import { getSupa } from './supabase.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function assinar(planId) {
  const btnId = `btn-${planId}`;
  const btn   = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = 'Aguarde...'; }

  try {
    // Pega sessão do usuário logado
    const { data: { session } } = await getSupa().auth.getSession();
    const email           = session?.user?.email ?? 'teste@pediway.com';
    const establishmentId = session?.user?.id    ?? 'demo';

    const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-subscription`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ planId, email, establishmentId }),
    });

    const { init_point, error } = await res.json();

    if (error) throw new Error(error);

    // Redireciona pro checkout do Mercado Pago
    window.location.href = init_point;

  } catch (err) {
    console.error(err);
    showToast('Erro ao iniciar pagamento. Tente novamente.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Assinar agora'; }
  }
}

// Verifica status ao voltar do MP
export function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');

  if (status === 'success') {
    showToast('🎉 Assinatura ativada com sucesso!');
    // Limpa a URL
    window.history.replaceState({}, '', '/');
    goTo('s-dash');
  }
}

window.assinar = assinar;
