// src/main.js
import { goTo, openDemo, showToast } from './utils.js';
import { doLogin, doRegister } from './auth.js';
import { initDashboard } from './dashboard.js';

// Expõe globalmente para os onclick do HTML
window.goTo       = goTo;
window.openDemo   = openDemo;
window.doLogin    = doLogin;
window.doRegister = doRegister;
window.showToast  = showToast;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 PEDIWAY iniciado!');
  initDashboard();
  goTo('s-landing');
});
