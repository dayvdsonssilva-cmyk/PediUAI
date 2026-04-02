import { state, getUsers, setUsers, getSolicitations, setSolicitations } from './config.js';
import { isEmail, isValidDoc, digits, wppParaSalvar, gerarSlug, showNotif, saveCurrentUser, SESSION } from './utils.js';
import { getSupa } from './supabase.js';

export async function doLogin() {
  const email = document.getElementById('le').value.trim();
  const pass = document.getElementById('lp').value;
  const errEl = document.getElementById('lerr');
  if (!isEmail(email)) { errEl.classList.add('show'); document.getElementById('le').classList.add('err'); return; }
  errEl.classList.remove('show'); document.getElementById('le').classList.remove('err');

  const db = getSupa();
  let user = null;

  if (db) {
    try {
      const { data: supa } = await db
        .from('estabelecimentos')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (supa && (supa.pass === pass || supa.password_plain === pass)) {
        user = {
          id: supa.id,
          name: supa.name,
          desc: supa.descricao || '',
          emoji: supa.emoji || '🍔',
          color: supa.color || '#E8410A',
          slug: supa.slug,
          logo: supa.logo_url || null,
          email: supa.email,
          pass: pass,
          whatsapp: supa.whatsapp || '',
          plan: supa.plan_type || 'ultra',
          status: supa.status,
          orders: [], menuItems: [], flashItems: [], welcome: 'Seja bem-vindo!'
        };
        const users = getUsers();
        const idx = users.findIndex(u => u.email === email);
        if (idx >= 0) users[idx] = { ...users[idx], ...user };
        else users.push(user);
        setUsers(users);
      }
    } catch (e) { console.warn('Login Supabase erro:', e); }
  }

  if (!user) {
    const users = getUsers();
    user = users.find(u => u.email === email && u.pass === pass);
  }

  if (!user) { errEl.textContent = 'E-mail ou senha incorretos'; errEl.classList.add('show'); return; }
  if (user.status === 'pending') { alert('Seu cadastro ainda está em análise. Aguarde a aprovação.'); return; }
  if (user.status === 'inactive') {
    state.currentUser = user; state.currentStoreSlug = user.slug;
    SESSION.save(user);
    const { goTo } = await import('./ui.js');
    goTo('s-inactive'); return;
  }
  state.currentUser = user;
  state.currentStoreSlug = user.slug;
  SESSION.save(user);
  const { goTo } = await import('./ui.js');
  goTo('s-dash');
}

export function loginDemo() {
  const users = getUsers();
  const demo = users.find(u => u.id === 'demo');
  if (demo) {
    state.currentUser = demo;
    state.currentStoreSlug = 'demo';
    import('./ui.js').then(({ goTo }) => goTo('s-dash'));
  } else {
    alert('Loja de teste não encontrada. Recarregue a página.');
  }
}

export function doRegister() {
  let ok = true;
  const show = (id, inputId, cond) => {
    const e = document.getElementById(id); const i = inputId ? document.getElementById(inputId) : null;
    e.classList.toggle('show', !cond); if (i) i.classList.toggle('err', !cond);
    if (!cond) ok = false;
  };
  show('rnerr', 'rn', document.getElementById('rn').value.trim().length > 1);
  show('rdocerr', 'rdoc', isValidDoc(document.getElementById('rdoc').value));
  show('remailerr', 'remail', isEmail(document.getElementById('remail').value));
  show('rpasserr', 'rpass', document.getElementById('rpass').value.length >= 6);
  if (!ok) return;

  const logoData = document.getElementById('logo-preview').src || null;
  window._pendingReg = {
    name: document.getElementById('rn').value.trim(),
    email: document.getElementById('remail').value.trim(),
    pass: document.getElementById('rpass').value,
    doc: document.getElementById('rdoc').value,
    wp: wppParaSalvar(document.getElementById('rwpp').value),
    desc: document.getElementById('rdesc').value,
    logo: logoData && logoData.startsWith('data:') ? logoData : null,
  };

  const slug = gerarSlug(window._pendingReg.name);
  const reg = window._pendingReg;
  const newUser = {
    id: Date.now().toString(), name: reg.name,
    desc: reg.desc || '', emoji: '🍔', color: '#E8410A',
    slug, logo: reg.logo || null, email: reg.email, pass: reg.pass,
    whatsapp: digits(reg.wp || '5511999999999'),
    plan: 'ultra',
    status: 'pending', dueDate: '', payMethod: '',
    since: new Date().toISOString().slice(0, 10),
    doc: reg.doc || '', orders: [], menuItems: [], flashItems: [], welcome: 'Seja bem-vindo!'
  };
  const solics = getSolicitations();
  solics.push({ ...newUser, submittedAt: new Date().toLocaleDateString('pt-BR') });
  setSolicitations(solics);

  const db = getSupa();
  if (db) {
    db.from('estabelecimentos').insert({
      name: newUser.name, doc: newUser.doc || '', email: newUser.email,
      pass: newUser.pass, password_plain: newUser.pass,
      whatsapp: newUser.whatsapp || '', descricao: newUser.desc || '',
      slug: newUser.slug, emoji: '🍔', color: '#E8410A',
      plan_type: 'ultra', status: 'pending',
      logo_url: newUser.logo || null, created_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) console.warn('Cadastro Supabase erro:', error.message);
    });
  }

  window._pendingReg = null;
  document.getElementById('pend-email').textContent = reg.email;
  import('./ui.js').then(({ goTo }) => goTo('s-pending'));
}
