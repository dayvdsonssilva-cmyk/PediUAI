// src/auth.js - Versão corrigida com exportações
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
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Entrando...';
  }

  try {
    const supa = getSupa();
    const { data, error } = await supa.auth.signInWithPassword({ email, password: pass });

    if (error) throw new Error('E-mail ou senha incorretos');

    const { data: estab } = await supa
      .from('estabelecimentos')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!estab) throw new Error('Estabelecimento não encontrado');

    state.currentUser = estab;
    localStorage.setItem('pw_current_user', JSON.stringify(estab));

    alert(`✅ Bem-vindo, ${estab.nome || 'Estabelecimento'}!`);
    goTo('s-dash');

  } catch (e) {
    console.error(e);
    alert("E-mail ou senha incorretos");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }
}

export async function doRegister() {
  alert("Cadastro em desenvolvimento...\nEm breve vamos implementar completamente.");
  // goTo('s-payment'); // descomente quando quiser ir para pagamento
}

export function loginDemo() {
  state.currentUser = { id: 'demo', nome: 'Burguer do Zé', slug: 'demo' };
  goTo('s-dash');
}

// Torna global para HTML
window.doLogin = doLogin;
window.doRegister = doRegister;
window.loginDemo = loginDemo;
