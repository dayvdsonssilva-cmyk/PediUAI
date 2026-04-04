// ==================== src/main.js - VERSÃO LIMPA E FUNCIONANDO ====================

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

console.log('🚀 PEDIWAY - Sistema carregado com sucesso!');

// ====================== INICIALIZAÇÃO ======================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📌 Página carregada');

    // Inicializa dados de demonstração
    if (typeof initDemoData === 'function') {
        initDemoData();
    }

    const path = window.location.pathname;

    // Se for acesso a uma loja (/restaurante/...)
    if (path.includes('/restaurante/')) {
        await initRoutingAsync();
    } else {
        // Tela inicial (landing)
        if (typeof goTo === 'function') goTo('sl');
    }

    console.log('✅ Aplicação inicializada');
});

// Função de roteamento (mantida do seu código original)
async function initRoutingAsync() {
    const path = window.location.pathname;
    const match = path.match(/\/restaurante\/([\w-]+)/);
    
    if (!match) return;
    
    const slug = match[1];

    if (slug === 'demo') {
        if (typeof openDemo === 'function') openDemo();
        return;
    }

    // Tenta carregar a loja
    goTo('s-store');
    document.getElementById('sn').textContent = 'Carregando...';

    let loja = null;
    for (let i = 0; i < 3; i++) {
        loja = await carregarLojaSupa(slug);
        if (loja) break;
        await new Promise(r => setTimeout(r, 800));
    }

    if (loja) {
        currentUser = loja;
        currentStoreSlug = slug;
        if (typeof renderStore === 'function') renderStore();
    } else {
        document.getElementById('sn').textContent = 'Loja não encontrada';
    }
};
