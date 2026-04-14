// api/criar-pagamento.js
// Vercel Serverless Function — POST /api/criar-pagamento

import { createClient } from '@supabase/supabase-js';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN; // Variável de ambiente no Vercel
const SUPA_URL        = process.env.SUPA_URL || 'https://nmttkjmfazcipefeakkx.supabase.co';
const SUPA_SERVICE    = process.env.SUPA_SERVICE_KEY; // Service role key — mais poderosa

const PRECOS = { pro: 49, premium: 99 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, plano, estabId, cardData, cpf, email, nome } = req.body || {};

  if (!plano || !PRECOS[plano])    return res.status(400).json({ error: 'Plano inválido.' });
  if (!estabId)                    return res.status(400).json({ error: 'Estabelecimento não identificado.' });
  if (!MP_ACCESS_TOKEN)            return res.status(500).json({ error: 'Credenciais de pagamento não configuradas.' });

  const valor = PRECOS[plano];

  try {
    let body;

    if (type === 'card') {
      // Pagamento com cartão via Bricks
      body = {
        transaction_amount: valor,
        token:              cardData.token,
        installments:       cardData.installments,
        payment_method_id:  cardData.payment_method_id,
        issuer_id:          cardData.issuer_id,
        description:        `PEDIWAY — Plano ${plano.charAt(0).toUpperCase()+plano.slice(1)} (mensal)`,
        payer: {
          email: cardData.payer?.email,
          identification: {
            type:   cardData.payer?.identification?.type,
            number: cardData.payer?.identification?.number,
          },
        },
        metadata: { plano, estab_id: estabId },
        external_reference: `${estabId}__${plano}__${Date.now()}`,
        notification_url: `${process.env.SITE_URL || 'https://pediway.vercel.app'}/api/webhook-mp`,
      };

    } else if (type === 'pix') {
      body = {
        transaction_amount: valor,
        description:        `PEDIWAY — Plano ${plano} (mensal)`,
        payment_method_id:  'pix',
        payer: {
          email,
          identification: {
            type:   cpf.length === 11 ? 'CPF' : 'CNPJ',
            number: cpf,
          },
        },
        metadata: { plano, estab_id: estabId },
        external_reference: `${estabId}__${plano}__${Date.now()}`,
        notification_url: `${process.env.SITE_URL || 'https://pediway.vercel.app'}/api/webhook-mp`,
      };

    } else if (type === 'boleto') {
      body = {
        transaction_amount: valor,
        description:        `PEDIWAY — Plano ${plano} (mensal)`,
        payment_method_id:  'bolbradesco',
        payer: {
          email,
          first_name: nome.split(' ')[0],
          last_name:  nome.split(' ').slice(1).join(' ') || '-',
          identification: {
            type:   cpf.length === 11 ? 'CPF' : 'CNPJ',
            number: cpf,
          },
        },
        metadata: { plano, estab_id: estabId },
        external_reference: `${estabId}__${plano}__${Date.now()}`,
        notification_url: `${process.env.SITE_URL || 'https://pediway.vercel.app'}/api/webhook-mp`,
      };
    } else {
      return res.status(400).json({ error: 'Tipo de pagamento inválido.' });
    }

    // Chama API do Mercado Pago
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
        'X-Idempotency-Key': `${estabId}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok || mpData.status === 'rejected') {
      console.error('MP error:', mpData);
      return res.status(400).json({ error: mpData.message || 'Pagamento recusado.' });
    }

    // Se aprovado imediatamente (cartão), já ativa o plano
    if (mpData.status === 'approved') {
      await ativarPlano(estabId, plano);
    }

    // Retorna dados úteis para o frontend
    return res.status(200).json({
      id:             mpData.id,
      status:         mpData.status,
      qr_code:        mpData.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      boleto_url:     mpData.transaction_details?.external_resource_url,
      ticket_url:     mpData.transaction_details?.external_resource_url,
    });

  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Erro interno ao processar pagamento.' });
  }
}

// ── Ativa o plano no Supabase ─────────────────────────────────────────────────
async function ativarPlano(estabId, plano) {
  if (!SUPA_SERVICE) return;
  const supa = createClient(SUPA_URL, SUPA_SERVICE);
  const venc = new Date();
  venc.setDate(venc.getDate() + 30);
  await supa.from('estabelecimentos').update({
    plano,
    pagamento_status:      'pago',
    assinatura_vencimento: venc.toISOString().slice(0, 10),
    aberto:                true,
  }).eq('id', estabId);
}
