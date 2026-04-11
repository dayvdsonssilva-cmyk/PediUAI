// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl   = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey   = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client = null;

export function getSupa() {
  if (!_client) {
    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Chaves do Supabase não encontradas no .env");
      return null;
    }
    _client = createClient(supabaseUrl, supabaseKey);
  }
  return _client;
}

// Função para debug
export function checkSupabaseConnection() {
  const client = getSupa();
  if (client) {
    console.log("✅ Supabase conectado com sucesso!");
  } else {
    console.error("❌ Falha ao conectar com Supabase - verifique as chaves no .env");
  }
}
