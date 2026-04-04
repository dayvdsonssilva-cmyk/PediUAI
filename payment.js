// src/lib/supabase.js
// Instância única do cliente Supabase — importe daqui em todos os módulos
// As variáveis VITE_* são injetadas pelo Vite em build time (seguro para o frontend)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[PEDIWAY] Variáveis de ambiente Supabase ausentes.\n' +
    'Copie .env.example → .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
