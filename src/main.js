// src/main.js
import { goTo, openDemo, showToast, showTab, copiarLink, salvarConfig, atualizarSlugPreview, atualizarLinkDash } from './utils.js';
import { doLogin, doRegister } from './auth.js';
import { initDashboard } from './dashboard.js';

window.goTo                 = goTo;
window.openDemo             = openDemo;
window.showToast            = showToast;
window.showTab              = showTab;
window.copiarLink           = copiarLink;
window.salvarConfig         = salvarConfig;
window.atualizarSlugPreview = atualizarSlugPreview;
window.atualizarLinkDash    = atualizarLinkDash;
window.doLogin              = doLogin;
window.doRegister           = doRegister;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 PEDIWAY iniciado!');
  initDashboard();
  goTo('s-landing');
});
