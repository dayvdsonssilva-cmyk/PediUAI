// ==================== src/main.js ====================
import { goTo, openDemo, showToast, showTab, copiarLink } from './utils.js';
import { doLogin, doRegister } from './auth.js';
import { initDashboard } from './dashboard.js';
 
window.goTo       = goTo;
window.openDemo   = openDemo;
window.showToast  = showToast;
window.showTab    = showTab;
window.copiarLink = copiarLink;
window.doLogin    = doLogin;
window.doRegister = doRegister;
window.mascaraDoc = mascaraDoc;
window.togglePromo = togglePromo;
 
function mascaraDoc(input) {
  let v = input.value.replace(/\D/g,'');
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/,'$1.$2')
         .replace(/(\d{3})(\d)/,'$1.$2')
         .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  } else {
    v = v.replace(/(\d{2})(\d)/,'$1.$2')
         .replace(/(\d{3})(\d)/,'$1.$2')
         .replace(/(\d{3})(\d)/,'$1/$2')
         .replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  }
  input.value = v;
}
 
function togglePromo(cb) {
  const group = document.getElementById('preco-orig-group');
  if (group) group.style.display = cb.checked ? 'flex' : 'none';
}
 
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 PEDIWAY iniciado!');
  const session = localStorage.getItem('pw_estab');
  if (session) {
    window._estab = JSON.parse(session);
    initDashboard();
  }
  goTo('s-landing');
});
