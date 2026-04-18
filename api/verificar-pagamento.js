// api/verificar-pagamento.js
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
const SUPA_URL = process.env.SUPA_URL        || 'https://nmttkjmfazcipefeakkx.supabase.co';
const SUPA_SVC = process.env.SUPA_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID obrigatório' });

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` }
    });
    if (!mpRes.ok) return res.status(mpRes.status).json({ error: 'Erro ao consultar MP' });

    const data = await mpRes.json();
    console.log('[verificar-pagamento]', id, data.status, data.status_detail);

    // Se aprovado, ativa o plano
    if (data.status === 'approved' && SUPA_SVC) {
      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(SUPA_URL, SUPA_SVC);
      const meta = data.metadata || {};
      const extRef = data.external_reference || '';
      const estabId = meta.estab_id || extRef.split('__')[0];
      const plano   = meta.plano   || extRef.split('__')[1];
      if (estabId && plano) {
        const venc = new Date();
        venc.setDate(venc.getDate() + 30);
        await supa.from('estabelecimentos').update({
          plano,
          pagamento_status:      'pago',
          assinatura_vencimento: venc.toISOString().slice(0, 10),
        }).eq('id', estabId);
      }
    }

    return res.status(200).json({
      status:        data.status,
      status_detail: data.status_detail,
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
