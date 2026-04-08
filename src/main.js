// src/main.js
import { goTo, openDemo, openDemoCliente, showToast, showTab, copiarLink, gerarSlug } from './utils.js';
import { doLogin, doRegister } from './auth.js';
import { initDashboard } from './dashboard.js';

window.goTo            = goTo;
window.openDemo        = openDemo;
window.openDemoCliente = openDemoCliente;
window.showToast       = showToast;
window.showTab         = showTab;
window.copiarLink      = copiarLink;
window.doLogin         = doLogin;
window.doRegister      = doRegister;

window.mascaraDoc = function(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    v = v.replace(/(\d{2})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1/$2')
         .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
  input.value = v;
};

window.mascaraWhatsInput = function(input) {
  let v = input.value.replace(/\D/g,'');
  if (v.length > 11) v = v.slice(0,11);
  if (v.length <= 10) {
    v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }
  input.value = v;
};

window.togglePromo = function(cb) {
  const g = document.getElementById('preco-orig-group');
  if (g) g.style.display = cb.checked ? 'flex' : 'none';
};

window.atualizarCfgLink = function(val) {
  const slug = val.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const el = document.getElementById('cfg-link-preview');
  if (el) el.textContent = `pediway.vercel.app/${slug || 'meu-link'}`;
};

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('pw_estab');

  if (saved) {
    try {
      window._estab = JSON.parse(saved);
    } catch(e) {
      localStorage.removeItem('pw_estab');
    }
  }

  // Se tinha uma tela salva (ex: dashboard) e tem sessao, vai direto
  const telaSalva = localStorage.getItem('pw_tela_atual');
  if (telaSalva === 's-dash' && window._estab) {
    goTo('s-dash');
    initDashboard();
  } else {
    goTo('s-landing');
  }
});
