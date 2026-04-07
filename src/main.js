// ==================== src/main.js ====================
import { goTo, openDemo } from './utils.js';
import { doLogin, doRegister } from './auth.js';
import { initDashboard } from './dashboard.js';
 
// Expõe globalmente (chamados pelo HTML via onclick)
window.goTo       = goTo;
window.openDemo   = openDemo;
window.doLogin    = doLogin;
window.doRegister = doRegister;
 
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 PEDIWAY iniciado!');
  goTo('s-landing');
});
