// ==================== src/main.js - VERSÃO PARA BOTÕES FUNCIONAREM ====================

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

console.log('🚀 PEDIWAY carregado - Modo Botões Ativado');

// === TORNA TODAS AS FUNÇÕES GLOBAIS PARA OS BOTÕES HTML FUNCIONAREM ===
window.goTo = function(screen) {
    console.log('goTo chamado:', screen);
    if (typeof window.switchScreen === 'function') {
        window.switchScreen(screen);
    } else if (typeof window.goTo === 'function') {
        window.goTo(screen);
    }
};

window.openDemo = function() {
    console.log('Demo aberto');
    if (typeof window.openDemo === 'function') window.openDemo();
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM pronto - inicializando funções');

    if (typeof initDemoData === 'function') initDemoData();
    
    // Força tela inicial
    setTimeout(() => {
        if (typeof goTo === 'function') goTo('sl');
    }, 500);
});

console.log('✅ Todas funções globais carregadas');
