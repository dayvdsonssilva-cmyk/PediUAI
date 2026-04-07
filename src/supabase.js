// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _c = null;
export function getSupa() {
  if (!_c) _c = createClient(URL, KEY);
  return _c;
}
