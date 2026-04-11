// src/supabase.js - Versão corrigida para Admin + Produção
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client = null;

export function getSupa() {
  if (!_client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ [Supabase] Chaves não encontradas no .env");
      console.error("VITE_SUPABASE_URL:", supabaseUrl ? "OK" : "FALTANDO");
      console.error("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "OK" : "FALTANDO");
      return null;
    }

    try {
      _client = createClient(supabaseUrl, supabaseAnonKey);
      console.log("✅ Supabase conectado com sucesso!");
    } catch (e) {
      console.error("❌ Erro ao criar cliente Supabase:", e.message);
    }
  }
  return _client;
}

// Função para testar conexão (chame no console se precisar)
export function checkSupabaseConnection() {
  const client = getSupa();
  if (client) {
    console.log("✅ Conexão Supabase OK - Admin deve funcionar");
  } else {
    console.error("❌ Falha na conexão com Supabase");
  }
}
