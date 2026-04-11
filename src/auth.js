// src/auth.js - Versão corrigida e estável
import { getSupa } from './supabase.js';
import { goTo, showNotif } from './utils.js';
import { state } from './config.js';

// ── LOGIN ──────────────────────────────────────────────────
export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass = document.getElementById('lp')?.value;

  if (!email || !pass) {
    showNotif('⚠️ Atenção', 'Preencha e-mail e senha');
    return;
  }

  const btn = document.querySelector('[onclick="doLogin()"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Entrando...';
  }

  try {
    const supa = getSupa();
    
    // Login com Supabase Auth
    const { data, error } = await supa.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) throw new Error('E-mail ou senha incorretos');

    // Busca os dados do estabelecimento
    const { data: estab } = await supa
      .from('estabelecimentos')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!estab) throw new Error('Conta encontrada, mas estabelecimento não configurado');

    // Salva no estado global
    state.currentUser = estab;
    localStorage.setItem('pw_current_user', JSON.stringify(estab));

    showNotif('✅ Login realizado!', `Bem-vindo, ${estab.nome}`);
    goTo('s-dash');

    // Inicializa dashboard se existir
    if (typeof initDashboard === 'function') initDashboard();

  } catch (e) {
    console.error(e);
    showNotif('❌ Erro no login', e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }
}

// ── CADASTRO (mantido simples por enquanto) ─────────────────
export async function doRegister() {
  showNotif('⚙️ Em desenvolvimento', 'Cadastro completo em breve...');
  // Vamos implementar depois com mais calma
}

// Torna global
window.doLogin = doLogin;
window.doRegister = doRegister;
