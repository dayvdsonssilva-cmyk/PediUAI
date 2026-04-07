// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client = null;

export function getSupa() {
  if (!_client) _client = createClient(SUPA_URL, SUPA_KEY);
  return _client;
}
