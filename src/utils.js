function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // remove acentos
    .replace(/\s+/g,'-')
    .replace(/[^a-z0-9-]/g,'')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'');
}

// initDemoData removida â€” sistema em produÃ§Ã£o, dados reais
function initDemoData() {
  // Demo disponÃ­vel apenas pelo botÃ£o "Ver demo" na landing
  // NÃ£o inicializa automaticamente para manter CEO zerado
  if (!LS.get('demo_init')) {
    const demoUser = {
      id: 'demo', name: 'Burguer do ZÃ©', desc: 'Os melhores burguers da cidade!',
      emoji: 'ðŸ”', color: '#E8410A', slug: 'demo', logo: null,
      email: 'demo@pediway.com.br', pass: '123456', whatsapp: '5511999999999',
      plan: 'ultra', status: 'active', dueDate: '', payMethod: '',
      since: new Date().toISOString().slice(0,10), doc: '12.345.678/0001-90',
      orders: [], flashItems: [], welcome: 'Seja bem-vindo! ðŸ”',
      menuItems: [
        {id:1,emoji:'ðŸ”',photo:null,name:'X-Burguer Especial',desc:'PÃ£o brioche, carne 180g, queijo cheddar, alface e molho especial.',cat:'Lanches',price:28.90,available:true},
        {id:2,emoji:'ðŸŸ',photo:null,name:'Batata Frita Grande',desc:'PorÃ§Ã£o generosa com sal grosso.',cat:'Acompanhamentos',price:14.90,available:true},
        {id:3,emoji:'ðŸ¥¤',photo:null,name:'Refrigerante 350ml',desc:'Coca-Cola, GuaranÃ¡ ou Fanta.',cat:'Bebidas',price:7.90,available:true},
      ],
    };
    let users = getUsers();
    // Demo NÃƒO aparece no CEO â€” separado da lista de clientes reais
    const demoIdx = users.findIndex(u => u.id === 'demo');
    if (demoIdx === -1) users.push(demoUser);
    else users[demoIdx] = demoUser;
    setUsers(users);
    LS.set('demo_init', true);
  }
}

// â”€â”€â”€ VALIDATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
function digits(v) { return v.replace(/\D/g,''); }
function isValidCPF(d) {
  d=digits(d); if(d.length!==11||/^(\d)\1+$/.test(d)) return false;
  let s=0; for(let i=0;i<9;i++) s+=+d[i]*(10-i);
  let r=s%11,c1=r<2?0:11-r;
  if(+d[9]!==c1) return false;
  s=0; for(let i=0;i<10;i++) s+=+d[i]*(11-i);
  r=s%11; return +d[10]===(r<2?0:11-r);
}
function isValidCNPJ(d) {
  d=digits(d); if(d.length!==14||/^(\d)\1+$/.test(d)) return false;
  const c=(n,arr)=>{ let s=0;arr.forEach((w,i)=>s+=+n[i]*w);let r=s%11;return r<2?0:11-r;};
  return +d[12]===c(d,[5,4,3,2,9,8,7,6,5,4,3,2])&&+d[13]===c(d,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
}
function isValidDoc(v) { const d=digits(v); return (d.length===11&&isValidCPF(d))||(d.length===14&&isValidCNPJ(d)); }
function maskDoc(el) {
  let v=digits(el.value);
  if(v.length<=11) v=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/,'$1.$2.$3-$4');
  else v=v.replace(/^(\d{2})(\d)/,'$1.$2').replace(/\.(\d{3})(\d)/,'.$1.$2').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/\/(\d{4})(\d{1,2})$/,'/$1-$2');
  el.value=v;
}
function maskPhone(el) {
  let v=digits(el.value);
  el.value=v.length<=10?v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3'):v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
}
function maskWpp(el) {
  // Remove tudo exceto dÃ­gitos
  let v = digits(el.value);
  // Remove 55 do inÃ­cio se o usuÃ¡rio digitar com cÃ³digo do paÃ­s
  if (v.startsWith('55') && v.length > 11) v = v.slice(2);
  // Formata como (DD) DDDDD-DDDD
  if (v.length <= 10) {
    el.value = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else {
    el.value = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  }
}
function wppParaSalvar(val) {
  // Converte "(35) 99999-9999" â†’ "5535999999999" para salvar/usar
  const d = digits(val);
  if (d.startsWith('55')) return d;
  return '55' + d;
}

// â”€â”€â”€ PERSIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SESSION = {
  save: (user) => { try { sessionStorage.setItem('pw_session', JSON.stringify({id:user.id,email:user.email,slug:user.slug})); } catch(e){} },
  get: () => { try { return JSON.parse(sessionStorage.getItem('pw_session')); } catch(e){ return null; } },
  clear: () => { try { sessionStorage.removeItem('pw_session'); } catch(e){} }
};

function saveCurrentUser(){
  if(!currentUser) return;
  const users=getUsers();
  const idx=users.findIndex(u=>u.id===currentUser.id);
  if(idx>=0) users[idx]=currentUser; else users.push(currentUser);
  setUsers(users);
  SESSION.save(currentUser); // persiste sessÃ£o
}

// â”€â”€â”€ UTILS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fazerLogout() {
  SESSION.clear();
  // Cancela polling e Realtime
  if (window._pollPedidos) { clearInterval(window._pollPedidos); window._pollPedidos = null; }
  if (realtimeEstabChannel) { try { getSupa()?.removeChannel(realtimeEstabChannel); } catch(e){} realtimeEstabChannel = null; }
  if (realtimeChannel) { try { getSupa()?.removeChannel(realtimeChannel); } catch(e){} realtimeChannel = null; }
  currentUser = null;
  currentStoreSlug = null;
  goTo('sl');
}

function togglePwVis(id, btn) {
  const input = document.getElementById(id);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? 'ðŸ™ˆ' : 'ðŸ‘';
}

function openModal(id){document.getElementById(id)?.classList.add('open');}
function closeModal(id){document.getElementById(id)?.classList.remove('open');}
function copyLink(){
  const slug = currentUser?.slug || 'demo';
  const link = window.location.origin + '/restaurante/' + slug;
  navigator.clipboard?.writeText(link).catch(()=>{
    const ta = document.createElement('textarea'); ta.value=link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
  const btn=event?.target; if(btn){const t=btn.textContent;btn.textContent='Copiado! âœ“';setTimeout(()=>btn.textContent=t,2500);}
  // Also update displayed link
  const lu=document.getElementById('dash-link'); if(lu) lu.textContent='pediway.com.br/restaurante/'+slug;
}
let notifTimer;
function showNotif(title,body){
  document.getElementById('notif-t').textContent=title;
  document.getElementById('notif-b').textContent=body;
  const n=document.getElementById('notif'); n.classList.add('show');
  clearTimeout(notifTimer); notifTimer=setTimeout(()=>n.classList.remove('show'),4500);
}

