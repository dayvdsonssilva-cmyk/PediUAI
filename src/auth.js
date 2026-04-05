// src/auth.js
import { getSupa } from './supabase.js';
import { goTo } from './utils.js';

export async function doLogin() {
  const email = document.getElementById('le').value;
  const pass = document.getElementById('lp').value;
  
  alert("Login em desenvolvimento...\nEmail: " + email);
  // Vamos implementar de verdade depois
}

export function loginDemo() {
  alert("Demo carregada!");
  goTo('s-dash');
}

window.doLogin = doLogin;
window.loginDemo = loginDemo;
