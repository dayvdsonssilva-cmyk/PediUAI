// src/auth.js - Versão simples e estável
import { getSupa } from './supabase.js';
import { goTo } from './utils.js';
import { state } from './config.js';

export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass = document.getElementById('lp')?.value;

  if (!email || !pass) {
    alert("Preencha e-mail e senha");
    return;
  }

  try {
    const supa = getSupa();

    const { data: estab, error } = await supa
      .from('estabelecimentos')
      .select('*')
      .eq('email', email)
      .eq('pass', pass)
      .maybeSingle();

    if (error || !estab) {
      alert("E-mail ou senha incorretos");
      return;
    }

    state.currentUser = estab;
    localStorage.setItem('pw_current_user', JSON.stringify(estab));

    alert(`✅ Login realizado!\nBem-vindo, ${estab.nome}`);
    goTo('s-dash');

  } catch (e) {
    console.error(e);
    alert("Erro ao fazer login");
  }
}

export function loginDemo() {
  state.currentUser = { id: 'demo', nome: 'Burguer do Zé', slug: 'demo' };
  goTo('s-dash');
}

window.doLogin = doLogin;
window.loginDemo = loginDemo;
