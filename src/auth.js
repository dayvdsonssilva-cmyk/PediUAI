// src/auth.js - Versão mínima para teste
import { getSupa } from './supabase.js';
import { goTo } from './utils.js';
import { state } from './config.js';

export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass = document.getElementById('lp')?.value;

  if (!email || !pass) {
    alert("Preencha email e senha");
    return;
  }

  alert(`Tentando login...\nEmail: ${email}`);

  try {
    const supa = getSupa();

    // Busca direta simples (igual ao sistema antigo)
    const { data: estab, error } = await supa
      .from('estabelecimentos')
      .select('*')
      .eq('email', email)
      .eq('pass', pass)
      .maybeSingle();

    if (error || !estab) {
      alert("E-mail ou senha incorretos\nVerifique se a senha está certa.");
      return;
    }

    state.currentUser = estab;
    localStorage.setItem('pw_current_user', JSON.stringify(estab));

    alert(`✅ Login OK!\nBem-vindo, ${estab.nome}`);
    goTo('s-dash');

  } catch (e) {
    console.error(e);
    alert("Erro: " + e.message);
  }
}

export function loginDemo() {
  state.currentUser = { id: 'demo', nome: 'Burguer do Zé', slug: 'demo' };
  goTo('s-dash');
}

// Torna global
window.doLogin = doLogin;
window.loginDemo = loginDemo;
