# ── Supabase ──────────────────────────────────────────────────────────────────
# Encontre em: https://app.supabase.com → Settings → API
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── Mercado Pago ───────────────────────────────────────────────────────────────
# Não expor no frontend — usados apenas nas serverless functions (/api)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu-token-aqui
# Segredo para validar assinatura do webhook (MP > Integrações > Webhooks > Segredo)
MERCADOPAGO_WEBHOOK_SECRET=seu-segredo-aqui

# ── App ────────────────────────────────────────────────────────────────────────
# URL pública da aplicação (sem barra no final)
BASE_URL=https://pediway.com.br

# ── Notificações internas (opcional) ──────────────────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
INTERNAL_SECRET=uma-chave-aleatoria-para-rotas-internas

# ── CEO Panel ─────────────────────────────────────────────────────────────────
# Email do administrador da plataforma (validado no servidor, nunca no client)
CEO_EMAIL=seu-email@pediway.com.br
CEO_PASSWORD_HASH=$2b$12$...  # bcrypt hash da senha CEO
