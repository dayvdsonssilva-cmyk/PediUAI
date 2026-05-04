// src/auth.js
import { getSupa } from './supabase.js';
import { goTo, showToast, gerarSlug } from './utils.js';

// ── Validação CPF ──────────────────────────────────────────
function validarCPF(c) {
  c = c.replace(/\D/g, '');
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
  c = c.replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = n => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += +c[i] * p--; if (p < 2) p = 9; }
    const r = s % 11; return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +c[12] && calc(13) === +c[13];
}

function docValido(d) {
  const n = d.replace(/\D/g, '');
  return n.length === 11 ? validarCPF(n) : n.length === 14 ? validarCNPJ(n) : false;
}

// ── Máscara de telefone ────────────────────────────────────
window.mascaraTel = function (inp) {
  let v = inp.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d*)$/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d*)$/, '($1) $2');
  else if (v.length > 0) v = '(' + v;
  inp.value = v;
};

// ── Toggle mostrar/ocultar senha ──────────────────────────
window.toggleSenha = function (inputId, btnId) {
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
  const tel = document.getElementById('rtel')?.value.trim();
  const nome = document.getElementById('rn')?.value.trim();
  const cidade = document.getElementById('rcidade')?.value.trim() || null;
  const doc = document.getElementById('rdoc')?.value.trim();
  const email = document.getElementById('re')?.value.trim();
  const pass = document.getElementById('rp')?.value;

  if (!nomeP) return showToast('Digite seu nome completo.', 'error');
  if (!tel || tel.replace(/\D/g, '').length < 10) return showToast('Digite um WhatsApp válido com DDD.', 'error');
  if (!nome) return showToast('Digite o nome do estabelecimento.', 'error');
  if (!cidade) return showToast('Digite a cidade do estabelecimento.', 'error');
  if (!doc) return showToast('Digite o CPF ou CNPJ.', 'error');
  if (!docValido(doc)) return showToast('CPF ou CNPJ inválido.', 'error');
  if (!email) return showToast('Digite o e-mail.', 'error');
  if (!pass || pass.length < 6) return showToast('Senha mínima: 6 caracteres.', 'error');

  const btn = document.querySelector('[onclick="doRegister()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }

  try {
    const { data: authData, error: authErr } = await getSupa().auth.signUp({ email, password: pass });
    if (authErr) throw new Error(authErr.message);

    // Usa a sessão do signUp diretamente (evita erro "Email not confirmed")
    let userId = authData?.user?.id || authData?.session?.user?.id;

    // Fallback: tenta login explícito se signUp não retornou sessão
    if (!userId) {
      const { data: loginData, error: loginErr } = await getSupa().auth.signInWithPassword({ email, password: pass });
      if (loginErr) throw new Error('Conta criada! Verifique seu e-mail e faça login.');
      userId = loginData?.user?.id;
    }

    if (!userId) throw new Error('Sessão inválida. Tente fazer login.');

    let slug = gerarSlug(nome);
    if (!slug || slug.length < 2) slug = 'loja';
    let t = 0;
    while (!(await slugLivre(slug))) {
      t++;
      slug = gerarSlug(nome) + '-' + t;
      if (t > 99) { slug = gerarSlug(nome) + '-' + Date.now(); break; }
    }

    const telSoNumeros = tel.replace(/\D/g, '');
    const { error: dbErr } = await getSupa().from('estabelecimentos').insert({
      user_id: userId,
      nome,
      slug,
      cidade,
      cpf_cnpj: doc.replace(/\D/g, ''),
      nome_responsavel: nomeP,
      telefone: telSoNumeros,
      status: 'ativo',
      plano: 'basico',
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
  const pass = document.getElementById('lp')?.value;

  if (!email) return showToast('Digite o e-mail.', 'error');
  if (!pass) return showToast('Digite a senha.', 'error');

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

// ── RECUPERAÇÃO DE SENHA — 3 passos ──────────────────────
let _recEmailVerificado = null;

function recAtivarStep(n) {
  [1, 2, 3].forEach(i => {
    const d = document.getElementById('rec-passo' + i);
    const dot = document.getElementById('step-dot-' + i);
    if (d) d.style.display = i === n ? 'block' : 'none';
    if (dot) {
      dot.style.background = i < n ? '#16a34a' : i === n ? 'var(--red)' : '#2a2a2a';
      dot.style.color = i <= n ? '#fff' : '#555';
      dot.textContent = i < n ? '✓' : String(i);
    }
    if (i < 3) {
      const line = document.getElementById('step-line-' + i);
      if (line) line.style.background = i < n ? '#16a34a' : '#2a2a2a';
    }
  });
}

window.recVoltar = function (passo) { recAtivarStep(passo); };

// Passo 1: valida e-mail (só verifica se está preenchido)
window.recPasso1 = function () {
  const email = document.getElementById('rec-email')?.value.trim();
  if (!email || !email.includes('@')) return showToast('Digite um e-mail válido.', 'error');
  _recEmailVerificado = email;
  recAtivarStep(2);
};

// Passo 2: verifica telefone completo no banco
window.recPasso2 = async function () {
  const tel = document.getElementById('rec-tel')?.value.trim();
  const tel9 = tel.replace(/\D/g, '');

  if (!tel9 || tel9.length < 10) return showToast('Digite o WhatsApp completo com DDD.', 'error');

  const btn = document.querySelector('[onclick="recPasso2()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }

  try {
    // Busca estab com telefone EXATO
    const { data: estabs, error: dbErr } = await getSupa()
      .from('estabelecimentos')
      .select('id, user_id, telefone')
      .eq('telefone', tel9);

    if (dbErr) throw new Error('Erro ao verificar: ' + dbErr.message);
    if (!estabs || estabs.length === 0) {
      throw new Error('WhatsApp não corresponde à conta. Verifique o número e tente novamente.');
    }

    // Envia e-mail de reset via Supabase Auth
    const { error: resetErr } = await getSupa().auth.resetPasswordForEmail(_recEmailVerificado, {
      redirectTo: window.location.origin,
    });
    if (resetErr) throw new Error('Erro ao processar: ' + resetErr.message);

    // Avança para o passo 3 (nova senha)
    recAtivarStep(3);

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar identidade →'; }
  }
};

window.salvarNovaSenha = async function () {
  const nova = document.getElementById('rec-nova')?.value;
  const conf = document.getElementById('rec-conf')?.value;

  if (!nova || nova.length < 6) return showToast('Senha mínima: 6 caracteres.', 'error');
  if (nova !== conf) return showToast('As senhas não coincidem.', 'error');

  const btn = document.querySelector('[onclick="salvarNovaSenha()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    // updateUser funciona quando o usuário tem sessão (via link do e-mail ou sessão ativa)
    const { error } = await getSupa().auth.updateUser({ password: nova });
    if (error) throw new Error('Erro ao atualizar: ' + error.message);

    showToast('✅ Senha atualizada! Faça login.', 'info');
    setTimeout(() => goTo('s-login'), 1800);

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔐 Salvar nova senha'; }
  }
};