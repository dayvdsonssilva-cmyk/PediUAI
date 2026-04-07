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

// ── Slug único ─────────────────────────────────────────────
async function slugLivre(slug) {
  const { data } = await getSupa()
    .from('estabelecimentos').select('id').eq('slug', slug).maybeSingle();
  return !data;
}

// ── CADASTRO ───────────────────────────────────────────────
export async function doRegister() {
  const nome  = document.getElementById('rn')?.value.trim();
  const doc   = document.getElementById('rdoc')?.value.trim();
  const email = document.getElementById('re')?.value.trim();
  const pass  = document.getElementById('rp')?.value;

  if (!nome)           return showToast('Digite o nome do estabelecimento.', 'error');
  if (!doc)            return showToast('Digite o CPF ou CNPJ.', 'error');
  if (!docValido(doc)) return showToast('CPF ou CNPJ invalido.', 'error');
  if (!email)          return showToast('Digite o e-mail.', 'error');
  if (!pass || pass.length < 6) return showToast('Senha minima: 6 caracteres.', 'error');

  const btn = document.querySelector('[onclick="doRegister()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }

  try {
    // 1. Cria o usuário
    const { data: authData, error: authErr } = await getSupa().auth.signUp({ email, password: pass });
    if (authErr) throw new Error(authErr.message);

    // 2. Faz login imediato para garantir sessão ativa
    const { data: loginData, error: loginErr } = await getSupa().auth.signInWithPassword({ email, password: pass });
    if (loginErr) throw new Error('Conta criada mas erro ao ativar sessao. Tente fazer login.');

    // 3. Pega o user_id da sessão ativa (100% confiável)
    const userId = loginData?.user?.id;
    if (!userId) throw new Error('Sessao invalida. Tente fazer login.');

    // 4. Garante slug único
    let slug = gerarSlug(nome);
    let t = 1;
    while (!(await slugLivre(slug))) slug = `${gerarSlug(nome)}-${++t}`;

    // 5. Insere o estabelecimento com sessão ativa
    const { error: dbErr } = await getSupa().from('estabelecimentos').insert({
      user_id:  userId,
      nome,
      slug,
      cpf_cnpj: doc.replace(/\D/g,''),
      status:   'ativo',
      plano:    'basico',
    });

    if (dbErr) throw new Error('Erro ao salvar: ' + dbErr.message);

    goTo('s-sucesso');

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Criar conta gratis'; }
  }
}

// ── LOGIN ──────────────────────────────────────────────────
export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass  = document.getElementById('lp')?.value;

  if (!email || !pass) return showToast('Preencha e-mail e senha.', 'error');

  const btn = document.querySelector('[onclick="doLogin()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

  try {
    const { data, error } = await getSupa().auth.signInWithPassword({ email, password: pass });
    if (error) throw new Error('E-mail ou senha incorretos.');

    const userId = data?.user?.id;
    if (!userId) throw new Error('Erro na sessao. Tente novamente.');

    const { data: estab } = await getSupa()
      .from('estabelecimentos')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (estab) {
      window._estab = estab;
      localStorage.setItem('pw_estab', JSON.stringify(estab));
    }

    goTo('s-dash');
    if (window.initDashboard) window.initDashboard();

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
}
