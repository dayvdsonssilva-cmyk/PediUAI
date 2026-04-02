// ==================== src/main.js ====================
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

console.log('🚀 PEDIWAY carregado com sucesso!');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📌 DOM pronto');

    if (typeof initDemoData === 'function') initDemoData();

    const path = window.location.pathname;
    const isStorePath = /\/restaurante\/[\w-]+/.test(path);

    if (!isStorePath) {
        const sess = SESSION?.get();
        if (sess) {
            const users = getUsers();
            const user = users.find(u => u.id === sess.id || u.email === sess.email);
            if (user && user.status === 'active') {
                currentUser = user;
                currentStoreSlug = user.slug;
                goTo('s-dash');
                return;
            }
        }
    }

    await initRoutingAsync();
    setDeliveryType('delivery');
});

async function initRoutingAsync() {
    // ... (sua função original mantida)
    const path = window.location.pathname;
    const pathMatch = path.match(/\/restaurante\/([\w-]+)/);
    if (!pathMatch) return;

    const slug = pathMatch[1];
    if (slug === 'demo') {
        openDemo();
        return;
    }

    // resto da sua lógica de roteamento...
    // (cole aqui o resto da função initRoutingAsync que você já tinha)
}
