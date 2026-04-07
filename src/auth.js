// ==================== src/auth.js ====================
import { getSupa } from './supabase.js';
import { goTo, showToast, gerarSlug } from './utils.js';

// ---- Validação CPF ----
function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}

// ---- Validação CNPJ ----
function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (c, n) => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += parseInt(c[i]) * p--; if (p < 2) p = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(cnpj, 12) === parseInt(cnpj[12]) && calc(cnpj, 13) === parseInt(cnpj[13]);
}

function validarDocumento(doc) {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}

// ---- Verificar slug disponível ----
async function slugDisponivel(slug) {
  const { data } = await getSupa()
    .from('estabelecimentos')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return !data;
}

// ---- Cadastro ----
export async function doRegister() {
  const nome   = document.getElementById('rn')?.value.trim();
  const doc    = document.getElementById('rdoc')?.value.trim();
  const email  = document.getElementById('re')?.value.trim();
  const pass   = document.getElementById('rp')?.value;

  if (!nome)           return showToast('Digite o nome do estabelecimento.', 'error');
  if (!doc)            return showToast('Digite o CPF ou CNPJ.', 'error');
  if (!validarDocumento(doc)) return showToast('CPF ou CNPJ inválido.', 'error');
  if (!email)          return showToast('Digite o e-mail.', 'error');
  if (!pass || pass.length < 6) return showToast('Senha deve ter mínimo 6 caracteres.', 'error');

  const btn = document.querySelector('[onclick="doRegister()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando conta...'; }

  try {
    // Cria usuário no Auth
    const { data: authData, error: authErr } = await getSupa().auth.signUp({ email, password: pass });
    if (authErr) throw new Error(authErr.message);

    const userId = authData.user?.id;
    const slugBase = gerarSlug(nome);
    let slug = slugBase;
    let tentativa = 1;

    // Garante slug único
    while (!(await slugDisponivel(slug))) {
      slug = `${slugBase}-${++tentativa}`;
    }

    // Salva estabelecimento
    const { error: dbErr } = await getSupa().from('estabelecimentos').insert({
      user_id:  userId,
      nome,
      slug,
      cpf_cnpj: doc.replace(/\D/g, ''),
      status:   'ativo',
      plano:    'basico',
    });
    if (dbErr) throw new Error(dbErr.message);

    // Mostra tela de sucesso
    goTo('s-sucesso');

  } catch (err) {
    showToast(err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Criar conta grátis →'; }
  }
}

// ---- Login ----
export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass  = document.getElementById('lp')?.value;

  if (!email || !pass) return showToast('Preencha e-mail e senha.', 'error');

  const btn = document.querySelector('[onclick="doLogin()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

  try {
    const { data, error } = await getSupa().auth.signInWithPassword({ email, password: pass });
    if (error) throw new Error('E-mail ou senha incorretos.');

    const { data: estab } = await getSupa()
      .from('estabelecimentos')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (estab) {
      window._estab = estab;
      localStorage.setItem('pw_estab', JSON.stringify(estab));
    }
    // Mesmo sem estabelecimento, deixa entrar
    goTo('s-dash');
    if (window.initDashboard) window.initDashboard();

  } catch (err) {
    showToast(err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
}
