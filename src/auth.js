// src/auth.js
import { getSupa } from './supabase.js';
import { goTo, showToast, gerarSlug } from './utils.js';

// ── Validação CPF ──────────────────────────────────────────
function validarCPF(c) {
  c = c.replace(/\D/g,'');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== +c[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === +c[10];
}

// ── Validação CNPJ ─────────────────────────────────────────
function validarCNPJ(c) {
  c = c.replace(/\D/g,'');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = n => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += +c[i] * p--; if (p < 2) p = 9; }
    const r = s % 11; return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +c[12] && calc(13) === +c[13];
}

function docValido(d) {
  const n = d.replace(/\D/g,'');
  return n.length === 11 ? validarCPF(n) : n.length === 14 ? validarCNPJ(n) : false;
}

// ── Máscara de telefone ────────────────────────────────────
window.mascaraTel = function(inp) {
  let v = inp.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 10)     v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d*)$/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d*)$/, '($1) $2');
  else if (v.length > 0) v = '(' + v;
  inp.value = v;
};

// ── Toggle mostrar/ocultar senha ──────────────────────────
window.toggleSenha = function(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!inp) return;
  const mostrando = inp.type === 'text';
  inp.type = mostrando ? 'password' : 'text';
  if (btn) btn.textContent = mostrando ? '\u{1F441}' : '\u{1F648}';
};

// ── Slug único ─────────────────────────────────────────────
async function slugLivre(slug) {
  const { data } = await getSupa()
    .from('estabelecimentos').select('id').eq('slug', slug).maybeSingle();
  return !data;
}

// ── CADASTRO ───────────────────────────────────────────────
export async function doRegister() {
  const nomeP = document.getElementById('rnome')?.value.trim();
  const tel   = document.getElementById('rtel')?.value.trim();
  const nome  = document.getElementById('rn')?.value.trim();
  const doc   = document.getElementById('rdoc')?.value.trim();
  const email = document.getElementById('re')?.value.trim();
  const pass  = document.getElementById('rp')?.value;

  if (!nomeP)          return showToast('Digite seu nome completo.', 'error');
  if (!tel || tel.replace(/\D/g,'').length < 10) return showToast('Digite um WhatsApp válido com DDD.', 'error');
  if (!nome)           return showToast('Digite o nome do estabelecimento.', 'error');
  if (!doc)            return showToast('Digite o CPF ou CNPJ.', 'error');
  if (!docValido(doc)) return showToast('CPF ou CNPJ inválido.', 'error');
  if (!email)          return showToast('Digite o e-mail.', 'error');
  if (!pass || pass.length < 6) return showToast('Senha mínima: 6 caracteres.', 'error');

  const btn = document.querySelector('[onclick="doRegister()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }

  try {
    const { data: authData, error: authErr } = await getSupa().auth.signUp({ email, password: pass });
    if (authErr) throw new Error(authErr.message);

    const { data: loginData, error: loginErr } = await getSupa().auth.signInWithPassword({ email, password: pass });
    if (loginErr) throw new Error('Conta criada mas erro ao ativar sessão. Tente fazer login.');

    const userId = loginData?.user?.id;
    if (!userId) throw new Error('Sessão inválida. Tente fazer login.');

    let slug = gerarSlug(nome);
    if (!slug || slug.length < 2) slug = 'loja';
    let t = 0;
    while (!(await slugLivre(slug))) {
      t++;
      slug = gerarSlug(nome) + '-' + t;
      if (t > 99) { slug = gerarSlug(nome) + '-' + Date.now(); break; }
    }

    const telSoNumeros = tel.replace(/\D/g,'');
    const { error: dbErr } = await getSupa().from('estabelecimentos').insert({
      user_id:          userId,
      nome,
      slug,
      cpf_cnpj:         doc.replace(/\D/g,''),
      nome_responsavel: nomeP,
      telefone:         telSoNumeros,
      status:           'ativo',
      plano:            'basico',
    });

    if (dbErr) {
      if (dbErr.message?.includes('duplicate') || dbErr.code === '23505') {
        throw new Error('Este link de loja já está em uso. Tente um nome diferente.');
      }
      throw new Error('Erro ao salvar: ' + dbErr.message);
    }

    goTo('s-sucesso');

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Criar conta grátis'; }
  }
}

// ── LOGIN ──────────────────────────────────────────────────
export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass  = document.getElementById('lp')?.value;

  if (!email) return showToast('Digite o e-mail.', 'error');
  if (!pass)  return showToast('Digite a senha.', 'error');

  const btn = document.querySelector('[onclick="doLogin()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

  try {
    const { data: authData, error: authErr } = await getSupa().auth.signInWithPassword({ email, password: pass });

    if (authErr) {
      const msg = authErr.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        throw new Error('E-mail ou senha incorretos. Verifique e tente novamente.');
      }
      if (msg.includes('Email not confirmed')) {
        throw new Error('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.');
      }
      if (msg.includes('Too many requests')) {
        throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      }
      throw new Error('Erro ao entrar: ' + msg);
    }

    const userId = authData?.user?.id;
    if (!userId) throw new Error('Sessão inválida. Tente novamente.');

    const { data: estab, error: dbErr } = await getSupa()
      .from('estabelecimentos').select('*').eq('user_id', userId).maybeSingle();

    if (dbErr) throw new Error('Erro ao carregar dados da loja: ' + dbErr.message);

    if (!estab) {
      showToast('Conta encontrada! Complete o cadastro da sua loja.', 'info');
      goTo('s-register');
      return;
    }

    window._estab = estab;
    localStorage.setItem('pw_estab', JSON.stringify(estab));
    localStorage.setItem('pw_tela_atual', 's-dash');
    goTo('s-dash');
    if (window.initDashboard) await window.initDashboard();

  } catch (e) {
    console.error('doLogin error:', e);
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
}

// ── RECUPERAÇÃO DE SENHA ───────────────────────────────────
window.verificarRecuperacao = async function() {
  const email = document.getElementById('rec-email')?.value.trim();
  const tel4  = document.getElementById('rec-tel4')?.value.trim();

  if (!email)                                    return showToast('Digite seu e-mail.', 'error');
  if (!tel4 || tel4.length !== 4 || !/^\d{4}$/.test(tel4)) {
    return showToast('Digite exatamente os 4 últimos dígitos do WhatsApp.', 'error');
  }

  const btn = document.querySelector('[onclick="verificarRecuperacao()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }

  try {
    // Busca estabelecimento cujo telefone termina com os 4 dígitos
    const { data: estabs, error: dbErr } = await getSupa()
      .from('estabelecimentos')
      .select('id, user_id, telefone, nome')
      .ilike('telefone', '%' + tel4);

    if (dbErr) throw new Error('Erro ao verificar: ' + dbErr.message);
    if (!estabs || estabs.length === 0) {
      throw new Error('Não encontramos uma conta com esses dados. Verifique o e-mail e os 4 dígitos do WhatsApp.');
    }

    // Envia e-mail de redefinição de senha via Supabase
    const { error: resetErr } = await getSupa().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (resetErr) throw new Error('Erro ao enviar e-mail: ' + resetErr.message);

    // Mostra passo 2
    document.getElementById('rec-passo1').style.display = 'none';
    document.getElementById('rec-passo2').style.display = 'block';

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Verificar'; }
  }
};

window.salvarNovaSenha = async function() {
  const nova = document.getElementById('rec-nova')?.value;
  const conf = document.getElementById('rec-conf')?.value;

  if (!nova || nova.length < 6) return showToast('Senha mínima: 6 caracteres.', 'error');
  if (nova !== conf)            return showToast('As senhas não coincidem.', 'error');

  const btn = document.querySelector('[onclick="salvarNovaSenha()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    const { error } = await getSupa().auth.updateUser({ password: nova });
    if (error) throw new Error('Erro ao atualizar: ' + error.message);

    showToast('Senha atualizada! Faça login.', 'info');
    setTimeout(() => goTo('s-login'), 1500);

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar nova senha'; }
  }
};
