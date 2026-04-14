// api/criar-pagamento.js — Vercel Serverless Function

import { createClient } from '@supabase/supabase-js';

const MP_TOKEN   = process.env.MP_ACCESS_TOKEN;
const SUPA_URL   = process.env.SUPA_URL        || 'https://nmttkjmfazcipefeakkx.supabase.co';
const SUPA_SVC   = process.env.SUPA_SERVICE_KEY;
const SITE_URL   = process.env.SITE_URL         || 'https://pediway.vercel.app';
const PRECOS     = { pro: 49, premium: 99 };

export default async function handler(req, res) {
  // CORS headers (caso necessário)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // Verifica variáveis de ambiente
  if (!MP_TOKEN) {
    return res.status(500).json({
      error: 'MP_ACCESS_TOKEN não configurado. Adicione nas variáveis de ambiente do Vercel.',
    });
  }

  const { type, plano, estabId, formData, doc, email, nome } = req.body || {};

  if (!plano || !PRECOS[plano]) return res.status(400).json({ error: 'Plano inválido.' });
  if (!estabId)                  return res.status(400).json({ error: 'Estabelecimento não identificado.' });

  const valor = PRECOS[plano];
  const extRef = `${estabId}__${plano}__${Date.now()}`;
  const notifUrl = `${SITE_URL}/api/webhook-mp`;

  try {
    let body;

    if (type === 'card') {
      // Log da estrutura recebida (remover em produção)
      console.log('[criar-pagamento] formData recebido:', JSON.stringify(formData));
      console.log('[criar-pagamento] selectedPaymentMethod:', JSON.stringify(req.body.selectedPaymentMethod));

      // Token pode estar em formData.token ou selectedPaymentMethod.token
      const spMethod = req.body.selectedPaymentMethod || {};
      const token    = formData?.token || spMethod?.token;
      const pmId     = formData?.payment_method_id || spMethod?.payment_method_id || spMethod?.id;
      const issuer   = formData?.issuer_id || spMethod?.issuer_id;
      const inst     = formData?.installments || 1;
      const payer    = formData?.payer || {};

      if (!token) {
        console.error('[criar-pagamento] Token não encontrado. formData:', JSON.stringify(formData));
        return res.status(400).json({
          error: 'Token do cartão não gerado. Use o cartão de teste: 4009175332027601 (CVV: 123, Validade: 11/25)'
        });
      }

      body = {
        transaction_amount: valor,
        token,
        installments:      inst,
        payment_method_id: pmId,
        issuer_id:         issuer,
        description:       `PEDIWAY — Plano ${plano} (mensal)`,
        payer: {
          email:          payer.email,
          identification: payer.identification,
        },
        metadata:           { plano, estab_id: estabId },
        external_reference: extRef,
        notification_url:   notifUrl,
      };

    } else if (type === 'pix') {
      if (!doc || !email) return res.status(400).json({ error: 'CPF/CNPJ e e-mail obrigatórios.' });
      body = {
        transaction_amount: valor,
        description:        `PEDIWAY — Plano ${plano} (mensal)`,
        payment_method_id:  'pix',
        payer: {
          email,
          identification: { type: doc.length === 11 ? 'CPF' : 'CNPJ', number: doc },
        },
        metadata:           { plano, estab_id: estabId },
        external_reference: extRef,
        notification_url:   notifUrl,
      };

    } else if (type === 'boleto') {
      if (!doc || !email || !nome) return res.status(400).json({ error: 'Dados incompletos para boleto.' });
      body = {
        transaction_amount: valor,
        description:        `PEDIWAY — Plano ${plano} (mensal)`,
        payment_method_id:  'bolbradesco',
        payer: {
          email,
          first_name: nome.split(' ')[0],
          last_name:  nome.split(' ').slice(1).join(' ') || '-',
          identification: { type: doc.length === 11 ? 'CPF' : 'CNPJ', number: doc },
        },
        metadata:           { plano, estab_id: estabId },
        external_reference: extRef,
        notification_url:   notifUrl,
      };
    } else {
      return res.status(400).json({ error: 'Tipo de pagamento inválido.' });
    }

    // ── Chama API do Mercado Pago ──────────────────────────────────────────────
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method:  'POST',
      headers: {
        'Authorization':    `Bearer ${MP_TOKEN}`,
        'Content-Type':     'application/json',
        'X-Idempotency-Key': extRef,
      },
      body: JSON.stringify(body),
    });

    const mpData = await mpRes.json();

    // Log para debug no Vercel
    console.log('[MP] status:', mpData.status, '| status_detail:', mpData.status_detail, '| id:', mpData.id);

    if (!mpRes.ok) {
      console.error('[MP] Erro:', JSON.stringify(mpData));
      const detail = mpData.cause?.[0]?.description || mpData.message || 'Pagamento não processado.';
      return res.status(400).json({ error: detail });
    }

    if (mpData.status === 'rejected') {
      const detail = mpData.status_detail || 'Pagamento recusado. Verifique os dados e tente novamente.';
      return res.status(400).json({ error: detalharRejeicao(detail) });
    }

    // ── Aprova imediatamente (cartão) → ativa plano ────────────────────────────
    if (mpData.status === 'approved' && SUPA_SVC) {
      await ativarPlano(estabId, plano);
    }

    return res.status(200).json({
      id:             mpData.id,
      status:         mpData.status,
      status_detail:  mpData.status_detail,
      qr_code:        mpData.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      boleto_url:     mpData.transaction_details?.external_resource_url,
    });

  } catch (e) {
    console.error('[criar-pagamento] catch:', e);
    return res.status(500).json({ error: 'Erro interno: ' + (e?.message || 'desconhecido') });
  }
}

// ── Traduz motivos de rejeição do MP ─────────────────────────────────────────
function detalharRejeicao(detail) {
  const map = {
    'cc_rejected_insufficient_amount':    'Saldo insuficiente no cartão.',
    'cc_rejected_bad_filled_security_code':'Código de segurança (CVV) incorreto.',
    'cc_rejected_bad_filled_date':        'Data de validade incorreta.',
    'cc_rejected_bad_filled_other':       'Dados do cartão incorretos. Verifique e tente novamente.',
    'cc_rejected_call_for_authorize':     'Cartão requer autorização. Contate seu banco.',
    'cc_rejected_card_disabled':          'Cartão desabilitado. Contate seu banco.',
    'cc_rejected_duplicated_payment':     'Pagamento duplicado detectado.',
    'cc_rejected_high_risk':              'Pagamento recusado por risco. Tente outro cartão.',
    'cc_rejected_max_attempts':           'Muitas tentativas. Tente novamente mais tarde.',
  };
  return map[detail] || `Pagamento recusado (${detail}). Tente outro cartão.`;
}

// ── Ativa o plano no Supabase ──────────────────────────────────────────────────
async function ativarPlano(estabId, plano) {
  if (!SUPA_SVC) { console.warn('[ativarPlano] SUPA_SERVICE_KEY não configurada'); return; }
  try {
    const supa = createClient(SUPA_URL, SUPA_SVC);
    const venc = new Date();
    venc.setDate(venc.getDate() + 30);
    const { error } = await supa.from('estabelecimentos').update({
      plano,
      pagamento_status:      'pago',
      assinatura_vencimento: venc.toISOString().slice(0, 10),
      aberto:                true,
    }).eq('id', estabId);
    if (error) console.error('[ativarPlano] erro Supabase:', error);
    else console.log('[ativarPlano] plano', plano, 'ativado para', estabId);
  } catch (e) {
    console.error('[ativarPlano] catch:', e);
  }
}
