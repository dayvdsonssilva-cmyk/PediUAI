// api/webhook-mp.js
// Vercel Serverless Function — POST /api/webhook-mp
// Recebe notificações automáticas do Mercado Pago

import { createClient } from '@supabase/supabase-js';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SUPA_URL        = process.env.SUPA_URL        || 'https://nmttkjmfazcipefeakkx.supabase.co';
const SUPA_SERVICE    = process.env.SUPA_SERVICE_KEY;

const PRECOS = { pro: 49, premium: 99 };

export default async function handler(req, res) {
  // MP faz GET para validar a URL
  if (req.method === 'GET') return res.status(200).send('OK');
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { type, data } = req.body || {};

  // Ignora notificações que não são de pagamento
  if (type !== 'payment' || !data?.id) return res.status(200).send('ignored');

  try {
    // Busca o pagamento no MP para confirmar autenticidade
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const pag = await mpRes.json();

    if (!mpRes.ok) {
      console.error('Webhook: erro ao buscar pagamento', pag);
      return res.status(200).send('error fetching');
    }

    const { status, metadata, external_reference } = pag;

    // Extrai estab_id e plano da referência ou metadata
    let estabId = metadata?.estab_id;
    let plano   = metadata?.plano;

    if (!estabId && external_reference) {
      const parts = external_reference.split('__');
      estabId = parts[0];
      plano   = parts[1];
    }

    if (!estabId || !plano) {
      console.warn('Webhook: sem estab_id ou plano', { estabId, plano });
      return res.status(200).send('missing refs');
    }

    // Atualiza o Supabase conforme o status
    const supa = createClient(SUPA_URL, SUPA_SERVICE);

    if (status === 'approved') {
      const venc = new Date();
      venc.setDate(venc.getDate() + 30);
      await supa.from('estabelecimentos').update({
        plano,
        pagamento_status:      'pago',
        assinatura_vencimento: venc.toISOString().slice(0, 10),
        aberto:                true,
      }).eq('id', estabId);
      console.log(`✅ Plano ${plano} ativado para ${estabId}`);

    } else if (['cancelled', 'rejected', 'refunded', 'charged_back'].includes(status)) {
      await supa.from('estabelecimentos').update({
        pagamento_status: 'cancelado',
      }).eq('id', estabId);
      console.log(`❌ Pagamento ${status} para ${estabId}`);

    } else if (status === 'pending' || status === 'in_process') {
      await supa.from('estabelecimentos').update({
        pagamento_status: 'pendente',
      }).eq('id', estabId);
      console.log(`⏳ Pagamento pendente para ${estabId}`);
    }

    return res.status(200).send('ok');

  } catch (e) {
    console.error('Webhook handler error:', e);
    return res.status(200).send('error'); // sempre 200 para o MP não retentar em loop
  }
}
