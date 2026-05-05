// src/payment.js
import { showToast, goTo } from './utils.js';
import { getSupa } from './supabase.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function assinar(planId) {
  const PLANOS_VALIDOS = ['pro', 'premium', 'basico'];
  if (!planId || !PLANOS_VALIDOS.includes(planId)) {
    showToast('Plano inválido.', 'error');
    return;
  }

  const btnId = `btn-${planId}`;
  const btn   = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = 'Aguarde...'; }

  try {
    const { data: { session } } = await getSupa().auth.getSession();

    // Exige sessão ativa — não usa fallback para demo
    if (!session?.user?.email || !session?.user?.id) {
      showToast('Faça login para assinar um plano.', 'error');
      goTo('s-login');
      return;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-subscription`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        planId,
        email:           session.user.email,
        establishmentId: session.user.id,
      }),
    });

    if (!res.ok) {
      throw new Error('Erro ao processar. Tente novamente.');
    }

    const { init_point, error } = await res.json();
    if (error) throw new Error('Erro ao iniciar pagamento. Tente novamente.');
    if (!init_point) throw new Error('Resposta inválida do servidor.');

    // Valida que o redirect é para o Mercado Pago
    const url = new URL(init_point);
    if (!url.hostname.endsWith('mercadopago.com') && !url.hostname.endsWith('mercadopago.com.br')) {
      throw new Error('URL de pagamento inválida.');
    }

    window.location.href = init_point;

  } catch (err) {
    // Não expõe detalhes técnicos em produção
    if (import.meta.env.DEV) console.error('[assinar]', err);
    showToast(err.message || 'Erro ao iniciar pagamento. Tente novamente.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Assinar agora'; }
  }
}

// Verifica status ao voltar do MP — confirma no banco, não confia na URL
export async function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');

  if (!status) return;

  // Limpa os parâmetros da URL imediatamente
  window.history.replaceState({}, '', window.location.pathname);

  if (status !== 'approved' && status !== 'success') return;

  // Verifica status real no banco — nunca confia só na URL
  try {
    const { data: { session } } = await getSupa().auth.getSession();
    if (!session?.user?.id) return;

    const { data: estab } = await getSupa()
      .from('estabelecimentos')
      .select('plano, pagamento_status')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (estab?.pagamento_status === 'pago') {
      showToast('🎉 Assinatura ativada com sucesso!');
      goTo('s-dash');
    } else {
      // Pagamento ainda sendo processado
      showToast('Pagamento em processamento. Você será notificado.', 'info');
      goTo('s-dash');
    }
  } catch {
    goTo('s-dash');
  }
}

window.assinar = assinar;
