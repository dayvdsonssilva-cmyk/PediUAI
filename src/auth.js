// src/auth.js
import { getSupa } from './supabase.js';
import { goTo, showToast } from './utils.js';

export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass  = document.getElementById('lp')?.value;

  if (!email || !pass) return showToast('Preencha e-mail e senha.', 'error');

  showToast('Entrando...');

  // Descomente quando integrar Supabase:
  // const { error } = await getSupa().auth.signInWithPassword({ email, password: pass });
  // if (error) return showToast(error.message, 'error');

  goTo('s-dash');
}

export async function doRegister() {
  const name  = document.getElementById('rn')?.value.trim();
  const email = document.getElementById('re')?.value.trim();
  const pass  = document.getElementById('rp')?.value;

  if (!name || !email || !pass) return showToast('Preencha todos os campos.', 'error');
  if (pass.length < 6)          return showToast('Senha deve ter mínimo 6 caracteres.', 'error');

  showToast('Criando conta...');

  // Descomente quando integrar Supabase:
  // const { error } = await getSupa().auth.signUp({ email, password: pass, options: { data: { nome: name } } });
  // if (error) return showToast(error.message, 'error');

  goTo('s-dash');
}
