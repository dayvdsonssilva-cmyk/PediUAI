// /api/create-checkout.js
// Serverless function — Vercel / Node.js
// Integração com Mercado Pago para criação de assinatura

const PLANS = {
  basico: {
    monthly: { price: 39.90, title: 'PEDIWAY Básico — Mensal' },
    annual:  { price: 29.90, title: 'PEDIWAY Básico — Anual'  },
  },
  ultra: {
    monthly: { price: 99.90, title: 'PEDIWAY Ultra — Mensal' },
    annual:  { price: 79.90, title: 'PEDIWAY Ultra — Anual'  },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, billing, email, name } = req.body;

  if (!plan || !billing || !email) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: plan, billing, email' });
  }

  const planData = PLANS[plan]?.[billing];
  if (!planData) {
    return res.status(400).json({ error: 'Plano ou ciclo de cobrança inválido' });
  }

  try {
    // Criar preferência de pagamento no Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: planData.title,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: planData.price,
          },
        ],
        payer: { email, name },
        back_urls: {
          success: `${process.env.BASE_URL}/pagamento/sucesso`,
          failure: `${process.env.BASE_URL}/pagamento/erro`,
          pending: `${process.env.BASE_URL}/pagamento/pendente`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.BASE_URL}/api/webhook`,
        metadata: { plan, billing, email },
      }),
    });

    if (!mpResponse.ok) {
      const err = await mpResponse.json();
      console.error('Mercado Pago error:', err);
      return res.status(500).json({ error: 'Erro ao criar preferência no Mercado Pago' });
    }

    const mpData = await mpResponse.json();

    return res.status(200).json({
      init_point: mpData.init_point,         // URL de pagamento (produção)
      sandbox_init_point: mpData.sandbox_init_point, // URL de pagamento (sandbox)
      preference_id: mpData.id,
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// ─── VARIÁVEIS DE AMBIENTE NECESSÁRIAS (.env) ──────────────────────────────
// MERCADOPAGO_ACCESS_TOKEN=APP_USR-...   ← seu Access Token do MP
// BASE_URL=https://seudominio.com.br      ← URL base da aplicação
