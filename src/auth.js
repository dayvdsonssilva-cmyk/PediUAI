// src/auth.js - Versão simples e confiável
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

  const btn = document.querySelector('[onclick="doLogin()"]');
  if (btn) btn.textContent = 'Verificando...';

  try {
    const supa = getSupa();

    // Busca direta (como era no sistema antigo)
    const { data: estab, error } = await supa
      .from('estabelecimentos')
      .select('*')
      .eq('email', email)
      .eq('pass', pass)          // mude para 'password_plain' se for o nome da coluna
      .maybeSingle();

    if (error || !estab) {
      alert("E-mail ou senha incorretos");
      return;
    }

    state.currentUser = estab;
    localStorage.setItem('pw_current_user', JSON.stringify(estab));

    alert(`✅ Login OK!\nBem-vindo, ${estab.nome}`);
    goTo('s-dash');

    if (typeof initDashboard === 'function') initDashboard();

  } catch (e) {
    console.error(e);
    alert("Erro ao fazer login");
  } finally {
    if (btn) btn.textContent = 'Entrar';
  }
}

export function loginDemo() {
  state.currentUser = { id: 'demo', nome: 'Burguer do Zé', slug: 'demo' };
  goTo('s-dash');
}

window.doLogin = doLogin;
window.loginDemo = loginDemo;
