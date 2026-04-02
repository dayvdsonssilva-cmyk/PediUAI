// ==================== src/main.js ====================

// Importa todos os módulos
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

console.log('🚀 PediUAI - Sistema carregado com sucesso!');

// ====================== INICIALIZAÇÃO ======================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📌 DOM Content Loaded');

    // Inicializa dados demo se necessário
    if (typeof initDemoData === 'function') {
        initDemoData();
    }

    // Verifica sessão e roteamento
    const path = window.location.pathname;
    const isStorePath = /\/restaurante\/([\w-]+)/.test(path);

    if (isStorePath) {
        await initRoutingAsync();
    } else {
        // Tela normal (landing, login, dashboard, etc)
        if (typeof initApp === 'function') initApp();
    }

    // Inicializa o sistema de delivery
    setDeliveryType('delivery');

    console.log('✅ Aplicação inicializada completamente');
});

// Função auxiliar de roteamento (mantida do seu código original)
async function initRoutingAsync() {
    const path = window.location.pathname;
    const pathMatch = path.match(/\/restaurante\/([\w-]+)/);

    if (!pathMatch) return;

    const slug = pathMatch[1];

    if (slug === 'demo') {
        openDemo();
        return;
    }

    // Tenta carregar do localStorage primeiro
    const localUser = getUsers().find(u => u.slug === slug && u.status === 'active');

    if (localUser) {
        currentUser = localUser;
        currentStoreSlug = slug;
        goTo('s-store');
        return;
    }

    // Carrega da Supabase
    goTo('s-store');
    document.getElementById('sn').textContent = 'Carregando...';
    
    let loja = null;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
        loja = await carregarLojaSupa(slug);
        if (loja) break;
        await new Promise(r => setTimeout(r, 600));
    }
}

console.log('📦 main.js carregado e pronto');
