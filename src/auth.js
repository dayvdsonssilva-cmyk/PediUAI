// src/auth.js
import { getSupa } from './supabase.js';
import { goTo, showToast, gerarSlug } from './utils.js';

function validarCPF(c) {
  c = c.replace(/\D/g,'');
  if (c.length!==11||/^(\d)\1+$/.test(c)) return false;
  let s=0; for(let i=0;i<9;i++) s+=+c[i]*(10-i);
  let r=(s*10)%11; if(r===10||r===11) r=0; if(r!==+c[9]) return false;
  s=0; for(let i=0;i<10;i++) s+=+c[i]*(11-i);
  r=(s*10)%11; if(r===10||r===11) r=0; return r===+c[10];
}

function validarCNPJ(c) {
  c=c.replace(/\D/g,'');
  if(c.length!==14||/^(\d)\1+$/.test(c)) return false;
  const calc=(n)=>{let s=0,p=n-7;for(let i=0;i<n;i++){s+=+c[i]*p--;if(p<2)p=9;}const r=s%11;return r<2?0:11-r;};
  return calc(12)===+c[12]&&calc(13)===+c[13];
}

function docValido(d) {
  const n=d.replace(/\D/g,'');
  return n.length===11?validarCPF(n):n.length===14?validarCNPJ(n):false;
}

async function slugLivre(slug) {
  const {data}=await getSupa().from('estabelecimentos').select('id').eq('slug',slug).maybeSingle();
  return !data;
}

export async function doRegister() {
  const nome  = document.getElementById('rn')?.value.trim();
  const doc   = document.getElementById('rdoc')?.value.trim();
  const email = document.getElementById('re')?.value.trim();
  const pass  = document.getElementById('rp')?.value;

  if (!nome)              return showToast('Digite o nome do estabelecimento.','error');
  if (!doc)               return showToast('Digite o CPF ou CNPJ.','error');
  if (!docValido(doc))    return showToast('CPF ou CNPJ inválido.','error');
  if (!email)             return showToast('Digite o e-mail.','error');
  if (!pass||pass.length<6) return showToast('Senha mínima: 6 caracteres.','error');

  const btn = document.querySelector('[onclick="doRegister()"]');
  if (btn) { btn.disabled=true; btn.textContent='Criando...'; }

  try {
    const {data:auth, error:authErr} = await getSupa().auth.signUp({email, password:pass});
    if (authErr) throw new Error(authErr.message);

    let slug = gerarSlug(nome), t=1;
    while (!(await slugLivre(slug))) slug = `${gerarSlug(nome)}-${++t}`;

    const {error:dbErr} = await getSupa().from('estabelecimentos').insert({
      user_id: auth.user.id, nome, slug,
      cpf_cnpj: doc.replace(/\D/g,''), status:'ativo', plano:'basico',
    });
    if (dbErr) throw new Error(dbErr.message);

    goTo('s-sucesso');
  } catch(e) {
    showToast(e.message,'error');
    if (btn) { btn.disabled=false; btn.textContent='Criar conta grátis →'; }
  }
}

export async function doLogin() {
  const email = document.getElementById('le')?.value.trim();
  const pass  = document.getElementById('lp')?.value;
  if (!email||!pass) return showToast('Preencha e-mail e senha.','error');

  const btn = document.querySelector('[onclick="doLogin()"]');
  if (btn) { btn.disabled=true; btn.textContent='Entrando...'; }

  try {
    const {data, error} = await getSupa().auth.signInWithPassword({email, password:pass});
    if (error) throw new Error('E-mail ou senha incorretos.');

    const {data:estab} = await getSupa()
      .from('estabelecimentos').select('*')
      .eq('user_id', data.user.id).maybeSingle();

    if (estab) {
      window._estab = estab;
      localStorage.setItem('pw_estab', JSON.stringify(estab));
    }

    goTo('s-dash');
    if (window.initDashboard) window.initDashboard();
  } catch(e) {
    showToast(e.message,'error');
    if (btn) { btn.disabled=false; btn.textContent='Entrar'; }
  }
}
