// src/supabase.js
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let supabaseClient = null;

export function getSupa() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

export async function carregarLojaSupa(slug) {
  const db = getSupa();
  if (!db) return null;
  try {
    const { data } = await db
      .from('estabelecimentos')
      .select('*')
      .eq('slug', slug)
      .single();
    return data;
  } catch (e) {
    console.log("Erro ao carregar loja:", e);
    return null;
  }
}
