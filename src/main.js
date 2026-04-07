// src/main.js
import { goTo, openDemo } from './utils.js';
import { doLogin, doRegister } from './auth.js';
import { initDashboard } from './dashboard.js';

window.goTo       = goTo;
window.openDemo   = openDemo;
window.doLogin    = doLogin;
window.doRegister = doRegister;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 PEDIWAY iniciado!');
  goTo('s-landing');
});
