// /api/webhook.js
// Webhook do Mercado Pago — chamado automaticamente após pagamento

export default async function handler(req, res) {

  // ── Apenas POST é aceito ──────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const body = req.body;

    console.log('[Webhook] Notificação recebida:', JSON.stringify(body));

    // ── O MP envia type = "payment" quando um pagamento acontece ─────────────
    if (body.type !== 'payment') {
      // Outros eventos (subscription, etc.) — apenas confirmar recebimento
      return res.status(200).json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return res.status(400).json({ error: 'payment id ausente' });
    }

    // ── Busca os detalhes reais do pagamento na API do MP ────────────────────
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    });

    if (!mpRes.ok) {
      console.error('[Webhook] Erro ao buscar pagamento no MP:', await mpRes.text());
      return res.status(500).json({ error: 'erro ao consultar MP' });
    }

    const payment = await mpRes.json();

    console.log('[Webhook] Status do pagamento:', payment.status);
    console.log('[Webhook] Metadata:', payment.metadata);

    // ── Processa conforme status ──────────────────────────────────────────────
    switch (payment.status) {

      case 'approved': {
        // Pagamento aprovado — ativar loja no seu banco de dados
        const { email, plan, billing } = payment.metadata || {};

        if (!email) {
          console.warn('[Webhook] Pagamento aprovado sem email no metadata');
          break;
        }

        console.log(`[Webhook] ✅ Pagamento aprovado! Ativando loja: ${email} | Plano: ${plan} | Ciclo: ${billing}`);

        // ── Aqui você ativa a conta no seu banco (ex: Supabase, Firebase, etc.)
        // Exemplo com fetch para uma rota interna de ativação:
        //
        // await fetch(`${process.env.BASE_URL}/api/activate-store`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_SECRET },
        //   body: JSON.stringify({ email, plan, billing }),
        // });

        // ── Ou diretamente no banco (exemplo com Supabase): ──────────────────
        //
        // import { createClient } from '@supabase/supabase-js'
        // const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
        // await supabase.from('users').update({ status: 'active', plan, billing })
        //   .eq('email', email)

        break;
      }

      case 'pending':
      case 'in_process': {
        console.log('[Webhook] ⏳ Pagamento pendente — aguardando confirmação bancária');
        // Deixar conta como "pending" até aprovação
        break;
      }

      case 'rejected':
      case 'cancelled': {
        const { email } = payment.metadata || {};
        console.log(`[Webhook] ❌ Pagamento recusado/cancelado para: ${email}`);
        // Opcional: notificar o usuário por email
        break;
      }

      case 'refunded':
      case 'charged_back': {
        const { email } = payment.metadata || {};
        console.log(`[Webhook] 🔄 Reembolso/chargeback para: ${email}`);
        // Suspender conta se necessário
        break;
      }

      default:
        console.log(`[Webhook] Status desconhecido: ${payment.status}`);
    }

    // ── Sempre responde 200 para o MP não reenviar a notificação ─────────────
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('[Webhook] Erro inesperado:', err);
    // Mesmo com erro interno, responde 200 para evitar reenvios infinitos do MP
    return res.status(200).json({ received: true });
  }
}

// ─── VARIÁVEIS DE AMBIENTE NECESSÁRIAS (.env) ──────────────────────────────
// MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu-token-aqui
// BASE_URL=https://seudominio.com.br
// INTERNAL_SECRET=uma-chave-secreta-qualquer   ← opcional, para rotas internas
