// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://nmttkjmfazcipefeakkx.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdHRram1mYXpjaXBlZmVha2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM3NjQsImV4cCI6MjA5MDI4OTc2NH0.MMTX_6iQJk7Uv3HPSk0m32_BihvqsWhHJ_qiRkw0WYo';

let _c = null;
export function getSupa() {
  if (!_c) _c = createClient(URL, KEY);
  return _c;
}
