import { createClient } from '@supabase/supabase-js';
import { state, SUPA_URL, SUPA_KEY } from './config.js';

let _supa = null;

export function getSupa() {
  if (_supa) return _supa;
  _supa = createClient(SUPA_URL, SUPA_KEY);
  return _supa;
}

export async function carregarLojaSupa(slug) {
  const db = getSupa();
  if (!db) {
    console.warn('Supabase não inicializado ainda');
    return null;
  }
  try {
    const { data: loja, error: lojaErr } = await db
      .from('estabelecimentos')
      .select('id, name, email, slug, emoji, color, logo_url, whatsapp, plan_type, status, pass, password_plain, descricao, address, flash_items, prep_time, delivery_enabled, pickup_enabled, delivery_fee, is_open, horarios')
      .eq('slug', slug)
      .maybeSingle();

    if (lojaErr) {
      console.warn('Erro Supabase loja:', lojaErr.message);
      const { data: loja2, error: err2 } = await db
        .from('estabelecimentos')
        .select('id, name, email, slug, emoji, color, logo_url, whatsapp, plan_type, status, pass, password_plain')
        .eq('slug', slug)
        .maybeSingle();
      if (err2 || !loja2) { console.warn('Fallback erro:', err2?.message); return null; }
      return await montarLojaObj(db, loja2, null);
    }

    if (!loja) {
      console.warn('Loja não encontrada no Supabase para slug:', slug);
      return null;
    }

    if (loja.status === 'inactive') {
      return { inactive: true, name: loja.name, slug: loja.slug };
    }

    return await montarLojaObj(db, loja, loja.descricao || '');

  } catch (e) {
    console.warn('Erro carregarLojaSupa:', e.message || e);
    return null;
  }
}

export async function montarLojaObj(db, loja, descVal) {
  const { data: itens } = await db
    .from('menu_items')
    .select('*')
    .eq('establishment_id', loja.id)
    .eq('available', true)
    .order('category');

  return {
    id: loja.id,
    name: loja.name || 'Loja',
    desc: descVal !== null ? descVal : (loja.descricao || ''),
    emoji: loja.emoji || '🍔',
    color: loja.color || '#E8410A',
    slug: loja.slug,
    logo: loja.logo_url || null,
    email: loja.email || '',
    pass: loja.pass || loja.password_plain || '',
    whatsapp: loja.whatsapp || '',
    plan: 'ultra',
    status: 'active',
    address: loja.address || '',
    deliveryEnabled: loja.delivery_enabled !== false,
    pickupEnabled: loja.pickup_enabled !== false,
    deliveryFee: Number(loja.delivery_fee || 0),
    prepTime: loja.prep_time || '30',
    orders: [],
    flashItems: (() => {
      try {
        const fi = loja.flash_items;
        const lista = typeof fi === 'string' ? JSON.parse(fi) : (Array.isArray(fi) ? fi : []);
        return lista.filter(f => !f.expiresAt || f.expiresAt > Date.now());
      } catch (e) { return []; }
    })(),
    welcome: 'Seja bem-vindo!',
    menuItems: (itens || []).map(i => ({
      id: i.id, name: i.name,
      desc: i.descricao || '',
      price: Number(i.price),
      cat: i.category || 'Geral',
      emoji: i.emoji || '🍔',
      photo: i.photo_url || null,
      available: i.available,
      supaId: i.id
    }))
  };
}

export async function salvarPedidoSupa(lojaId, pedido) {
  const db = getSupa(); if (!db) return null;
  try {
    const { data, error } = await db.from('orders').insert({
      establishment_id: lojaId, client_name: pedido.client,
      client_phone: pedido.phone, address: pedido.address,
      delivery_type: pedido.delivery,
      items: JSON.stringify(pedido.items),
      payment_method: pedido.payment, total: pedido.total,
      status: 'new', created_at: new Date().toISOString()
    }).select().single();
    if (error) throw error;
    return data?.id || null;
  } catch (e) {
    console.error('Pedido supa erro:', e?.message || e);
    return null;
  }
}

export function iniciarRealtimePedidos() {
  const db = getSupa();
  if (!db || !state.currentUser?.id || !state.currentUser.id.includes('-')) {
    setTimeout(iniciarRealtimePedidos, 1000);
    return;
  }

  if (state.realtimeEstabChannel) {
    try { db.removeChannel(state.realtimeEstabChannel); } catch (e) {}
    state.realtimeEstabChannel = null;
  }

  state.realtimeEstabChannel = db
    .channel('pedidos-estab-' + state.currentUser.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'orders',
      filter: `establishment_id=eq.${state.currentUser.id}`
    }, async (payload) => {
      const p = payload.new;
      // lazy imports para evitar circular
      const { tocarSomNovoPedido } = await import('./ui.js');
      const { saveCurrentUser } = await import('./utils.js');
      const { renderOrdersList, renderOverviewOrders, showCSNotif } = await import('./orders.js');
      const { showNotif } = await import('./utils.js');

      tocarSomNovoPedido(p.id);
      if (state.currentUser.orders?.some(o => o.supaId === p.id)) return;
      const novoPedido = {
        supaId: p.id,
        id: '#' + String(++state.orderCounter).padStart(4, '0'),
        client: p.client_name, phone: p.client_phone,
        address: p.address, delivery: p.delivery_type,
        items: (() => { try { return typeof p.items === 'string' ? JSON.parse(p.items) : (Array.isArray(p.items) ? p.items : []); } catch (e) { return []; } })(),
        payment: p.payment_method, total: Number(p.total),
        status: p.status, time: 'agora', ts: Date.now()
      };
      if (!state.currentUser.orders) state.currentUser.orders = [];
      state.currentUser.orders.unshift(novoPedido);
      saveCurrentUser();
      renderOrdersList();
      renderOverviewOrders();
      showNotif('🔔 Novo pedido!', p.client_name + ' · R$ ' + Number(p.total).toFixed(2).replace('.', ','));
      const newContainer = document.getElementById('new-orders-container');
      if (newContainer) {
        newContainer.style.animation = 'none';
        setTimeout(() => { newContainer.style.animation = 'pulse 0.5s ease-out'; }, 10);
      }
      const st = document.getElementById('st-today');
      if (st) st.textContent = String(Number(st.textContent || 0) + 1);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        state._realtimeReady = true;
        verificarPedidosPerdidos();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        state._realtimeReady = false;
        setTimeout(() => iniciarRealtimePedidos(), 3000);
      }
    });

  if (window._menuChannel) { try { db.removeChannel(window._menuChannel); } catch (e) {} }
  window._menuChannel = db.channel('menu-estab-' + state.currentUser.id)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'menu_items',
      filter: `establishment_id=eq.${state.currentUser.id}`
    }, async () => {
      try {
        const { data: itensSupa } = await db
          .from('menu_items').select('*')
          .eq('establishment_id', state.currentUser.id)
          .order('category');
        if (itensSupa) {
          state.currentUser.menuItems = itensSupa.map(i => ({
            supaId: i.id, id: i.id, name: i.name,
            desc: i.descricao || '', price: Number(i.price),
            cat: i.category || 'Geral', emoji: i.emoji || '🍔',
            photo: i.photo_url || null, available: i.available
          }));
          const { saveCurrentUser } = await import('./utils.js');
          saveCurrentUser();
          const { _sincronizarCardapio } = await import('./dashboard.js');
          _sincronizarCardapio();
        }
      } catch (e) { console.warn('Erro RT cardapio:', e); }
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setTimeout(() => { if (state.currentUser?.id?.includes('-')) iniciarRealtimePedidos(); }, 4000);
      }
    });

  if (window._pollPedidos) clearInterval(window._pollPedidos);
  window._pollPedidos = setInterval(async () => {
    if (!state.currentUser?.id?.includes('-')) return;
    const db2 = getSupa(); if (!db2) return;
    try {
      const ultimoTs = state.currentUser.orders?.[0]?.ts || 0;
      const { data: novos } = await db2
        .from('orders').select('*')
        .eq('establishment_id', state.currentUser.id)
        .eq('status', 'new')
        .gt('created_at', new Date(ultimoTs || Date.now() - 60000).toISOString())
        .order('created_at', { ascending: false });
      if (novos && novos.length > 0) {
        const { tocarSomNovoPedido } = await import('./ui.js');
        const { saveCurrentUser, showNotif } = await import('./utils.js');
        const { renderOrdersList, renderOverviewOrders } = await import('./orders.js');
        const jaTem = new Set((state.currentUser.orders || []).map(o => o.supaId));
        novos.forEach(p => {
          if (!jaTem.has(p.id)) {
            tocarSomNovoPedido();
            const np = {
              supaId: p.id, id: '#' + String(++state.orderCounter).padStart(4, '0'),
              client: p.client_name, phone: p.client_phone,
              address: p.address, delivery: p.delivery_type,
              items: (() => { try { return typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []); } catch (e) { return []; } })(),
              payment: p.payment_method, total: Number(p.total),
              status: p.status, time: 'agora', ts: new Date(p.created_at).getTime()
            };
            state.currentUser.orders.unshift(np);
            showNotif('🔔 Novo pedido!', p.client_name + ' · R$ ' + Number(p.total).toFixed(2).replace('.', ','));
          }
        });
        saveCurrentUser();
        renderOrdersList();
        renderOverviewOrders();
      }
    } catch (e) {}
  }, 30000);
}

export async function verificarPedidosPerdidos() {
  const db = getSupa();
  if (!db || !state.currentUser?.id?.includes('-')) return;
  try {
    const doisMinAtras = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: novos } = await db
      .from('orders').select('*')
      .eq('establishment_id', state.currentUser.id)
      .gte('created_at', doisMinAtras)
      .order('created_at', { ascending: false });
    if (!novos?.length) return;
    const existentes = new Set((state.currentUser.orders || []).map(o => o.supaId));
    let temNovo = false;
    novos.forEach(p => {
      if (!existentes.has(p.id)) {
        state.currentUser.orders = state.currentUser.orders || [];
        state.currentUser.orders.unshift({
          supaId: p.id, id: '#' + String(++state.orderCounter).padStart(4, '0'),
          client: p.client_name, phone: p.client_phone,
          address: p.address, delivery: p.delivery_type,
          items: (() => { try { return typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []); } catch (e) { return []; } })(),
          payment: p.payment_method, total: Number(p.total),
          status: p.status, time: 'agora', ts: Date.now()
        });
        temNovo = true;
      }
    });
    if (temNovo) {
      const { saveCurrentUser } = await import('./utils.js');
      const { renderOrdersList, renderOverviewOrders } = await import('./orders.js');
      saveCurrentUser();
      renderOrdersList();
      renderOverviewOrders();
    }
  } catch (e) {}
}
