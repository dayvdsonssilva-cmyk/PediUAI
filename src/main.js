// ==================== src/main.js - VERSÃO FUNCIONAL ====================

import './config.js';
import './utils.js';
import './supabase.js';
import './auth.js';
import './ui.js';
import './ui_body.js';
import './client-store.js';
import './orders.js';
import './dashboard.js';
import './payment.js';
import './game.js';

console.log('🚀 PEDIWAY carregado completamente!');

// Tornar funções globais para os onclicks do HTML funcionarem
window.goTo = window.goTo || function(screen) {
    if (typeof window.switchScreen === 'function') window.switchScreen(screen);
    else console.warn('goTo não encontrado');
};

window.openDemo = window.openDemo || function() {
    console.log('Demo aberto');
    if (typeof window.openDemo === 'function') window.openDemo();
};

// Inicialização principal
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM carregado - inicializando app');

    if (typeof initDemoData === 'function') initDemoData();
    if (typeof initApp === 'function') initApp();

    // Tela inicial
    setTimeout(() => {
        if (typeof goTo === 'function') goTo('sl');
    }, 300);
});

console.log('✅ Todas as funções carregadas');
