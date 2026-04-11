// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client = null;

export function getSupa() {
  if (!_client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ Chaves do Supabase não foram encontradas no .env");
      console.error("Verifique se o arquivo .env existe e tem as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY");
      return null;
    }

    _client = createClient(supabaseUrl, supabaseAnonKey);
    console.log("✅ Supabase conectado com sucesso!");
  }
  return _client;
}

// Função para debug (chame ela para testar)
export function checkSupabaseConnection() {
  const client = getSupa();
  if (client) {
    console.log("✅ Conexão com Supabase OK!");
  } else {
    console.error("❌ Falha na conexão com Supabase");
  }
}
