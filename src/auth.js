// src/auth.js - Versão ultra simples para debug
import { getSupa } from './supabase.js';
import { goTo } from './utils.js';
import { state } from './config.js';

export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass = document.getElementById('lp')?.value;

  if (!email || !pass) {
    alert("Digite email e senha");
    return;
  }

  alert(`Tentando login com:\nEmail: ${email}\nSenha: ${pass}\n\nAguarde...`);

  try {
    const supa = getSupa();
    const { data, error } = await supa.auth.signInWithPassword({
      email: email,
      password: pass
    });

    if (error) {
      console.error("Erro auth:", error);
      alert("Erro: " + error.message);
      return;
    }

    console.log("✅ Login Supabase OK", data.user);

    // Busca o estabelecimento
    const { data: estab, error: estabError } = await supa
      .from('estabelecimentos')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (estabError || !estab) {
      alert("Conta encontrada, mas estabelecimento não configurado ainda.");
      return;
    }

    state.currentUser = estab;
    localStorage.setItem('pw_current_user', JSON.stringify(estab));

    alert(`✅ Login realizado com sucesso!\nBem-vindo, ${estab.nome}`);
    goTo('s-dash');

  } catch (e) {
    console.error(e);
    alert("Erro inesperado: " + e.message);
  }
}

export function loginDemo() {
  state.currentUser = { id: 'demo', nome: 'Burguer do Zé', slug: 'demo' };
  goTo('s-dash');
}

window.doLogin = doLogin;
window.loginDemo = loginDemo;
