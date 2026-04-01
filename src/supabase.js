let _supa = null;
function getSupa() {
  if (_supa) return _supa;
  // Tenta window.supabase (CDN padrÃ£o)
  if (window.supabase?.createClient) {
    _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    return _supa;
  }
  // Fallback: supabase como variÃ¡vel global direta
  if (typeof supabase !== 'undefined' && supabase?.createClient) {
    _supa = supabase.createClient(SUPA_URL, SUPA_KEY);
    return _supa;
  }
  return null;
}
async function carregarLojaSupa(slug) {
  const db = getSupa();
  if (!db) {
    console.warn('Supabase nÃ£o inicializado ainda');
    return null;
  }
  try {
    // Tenta buscar sem filtro de status primeiro (RLS jÃ¡ protege)
    // Usa select explÃ­cito para evitar problema com coluna descricao reservada
    const { data: loja, error: lojaErr } = await db
      .from('estabelecimentos')
      .select('id, name, email, slug, emoji, color, logo_url, whatsapp, plan_type, status, pass, password_plain, descricao, address, flash_items, prep_time, delivery_enabled, pickup_enabled, delivery_fee, is_open, horarios')
      .eq('slug', slug)
      .maybeSingle();

    if (lojaErr) {
      console.warn('Erro Supabase loja:', lojaErr.message);
      // Tenta sem o campo desc (compatibilidade)
      const { data: loja2, error: err2 } = await db
        .from('estabelecimentos')
        .select('id, name, email, slug, emoji, color, logo_url, whatsapp, plan_type, status, pass, password_plain')
        .eq('slug', slug)
        .maybeSingle();
      if (err2 || !loja2) { console.warn('Fallback erro:', err2?.message); return null; }
      return await montarLojaObj(db, loja2, null);
    }

    if (!loja) {
      console.warn('Loja nÃ£o encontrada no Supabase para slug:', slug);
      return null;
    }

    if (loja.status === 'inactive') {
      // Loja existe mas estÃ¡ inativa â€” retorna objeto especial para mostrar tela
      return { inactive: true, name: loja.name, slug: loja.slug };
    }

    return await montarLojaObj(db, loja, loja.descricao || '');

  } catch(e) {
    console.warn('Erro carregarLojaSupa:', e.message || e);
    return null;
  }
}

async function montarLojaObj(db, loja, descVal) {
  // Busca itens do cardÃ¡pio
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
    emoji: loja.emoji || 'ðŸ”',
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
      } catch(e) { return []; }
    })(),
    welcome: 'Seja bem-vindo!',
    menuItems: (itens || []).map(i => ({
      id: i.id, name: i.name,
      desc: i.descricao || '',
      price: Number(i.price),
      cat: i.category || 'Geral',
      emoji: i.emoji || 'ðŸ”',
      photo: i.photo_url || null,
      available: i.available,
      supaId: i.id
    }))
  };
}
async function salvarPedidoSupa(lojaId, pedido) {
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
    return data?.id || null; // retorna ID para assinar o Realtime
  } catch(e) { 
    console.error('Pedido supa erro:', e?.message || e);
    return null;
  }
}

// â”€â”€â”€ REALTIME ESTABELECIMENTO â€” novos pedidos em tempo real â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let realtimeEstabChannel = null;

let _realtimeReady = false; // flag: canal pronto para receber

function iniciarRealtimePedidos() {
  const db = getSupa();
  if (!db || !currentUser?.id || !currentUser.id.includes('-')) {
    // Supabase ainda nÃ£o pronto â€” tenta novamente em 1s
    setTimeout(iniciarRealtimePedidos, 1000);
    return;
  }
  // Cancela canal anterior
  if (realtimeEstabChannel) { try { db.removeChannel(realtimeEstabChannel); } catch(e){} realtimeEstabChannel = null; }

  // Canal de pedidos
  realtimeEstabChannel = db
    .channel('pedidos-estab-' + currentUser.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'orders',
      filter: `establishment_id=eq.${currentUser.id}`
    }, (payload) => {
      const p = payload.new;
      tocarSomNovoPedido(p.id);
      // Evita duplicar pedido que jÃ¡ estÃ¡ na lista
      if (currentUser.orders?.some(o => o.supaId === p.id)) return;
      const novoPedido = {
        supaId: p.id,
        id: '#' + String(++orderCounter).padStart(4,'0'),
        client: p.client_name, phone: p.client_phone,
        address: p.address, delivery: p.delivery_type,
        items: (() => { try { return typeof p.items === 'string' ? JSON.parse(p.items) : (Array.isArray(p.items) ? p.items : []); } catch(e) { return []; } })(),
        payment: p.payment_method, total: Number(p.total),
        status: p.status, time: 'agora', ts: Date.now()
      };
      if (!currentUser.orders) currentUser.orders = [];
      currentUser.orders.unshift(novoPedido);
      saveCurrentUser();
      renderOrdersList();
      renderOverviewOrders();
      showNotif('ðŸ”” Novo pedido!', p.client_name + ' Â· R$ ' + Number(p.total).toFixed(2).replace('.',','));
      // Anima a Ã¡rea de novos pedidos
      const newContainer = document.getElementById('new-orders-container');
      if(newContainer) {
        newContainer.style.animation = 'none';
        setTimeout(() => { newContainer.style.animation = 'pulse 0.5s ease-out'; }, 10);
      }
      const st = document.getElementById('st-today');
      if (st) st.textContent = String(Number(st.textContent||0) + 1);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        _realtimeReady = true;
        // Busca pedidos perdidos durante a conexÃ£o (primeiros segundos)
        verificarPedidosPerdidos();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        _realtimeReady = false;
        setTimeout(() => iniciarRealtimePedidos(), 3000);
      }
    });

  // Canal de cardÃ¡pio â€” atualiza em tempo real quando outro device faz mudanÃ§as
  if (window._menuChannel) { try { db.removeChannel(window._menuChannel); } catch(e){} }
  window._menuChannel = db.channel('menu-estab-' + currentUser.id)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'menu_items',
      filter: `establishment_id=eq.${currentUser.id}`
    }, async () => {
      try {
        const { data: itensSupa } = await db
          .from('menu_items').select('*')
          .eq('establishment_id', currentUser.id)
          .order('category');
        if (itensSupa) {
          currentUser.menuItems = itensSupa.map(i => ({
            supaId: i.id, id: i.id, name: i.name,
            desc: i.descricao || '', price: Number(i.price),
            cat: i.category || 'Geral', emoji: i.emoji || '\U0001f354',
            photo: i.photo_url || null, available: i.available
          }));
          saveCurrentUser();
          _sincronizarCardapio();
        }
      } catch(e) { console.warn('Erro RT cardapio:', e); }
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setTimeout(() => { if (currentUser?.id?.includes('-')) iniciarRealtimePedidos(); }, 4000);
      }
    });

// Busca pedidos salvos nos Ãºltimos 2 minutos que possam ter chegado
// antes do Realtime estar pronto (resolve o problema do primeiro pedido)
async function verificarPedidosPerdidos() {
  const db = getSupa();
  if (!db || !currentUser?.id?.includes('-')) return;
  try {
    const doisMinAtras = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: novos } = await db
      .from('orders').select('*')
      .eq('establishment_id', currentUser.id)
      .gte('created_at', doisMinAtras)
      .order('created_at', { ascending: false });
    if (!novos?.length) return;
    const existentes = new Set((currentUser.orders||[]).map(o => o.supaId));
    let temNovo = false;
    novos.forEach(p => {
      if (!existentes.has(p.id)) {
        currentUser.orders = currentUser.orders || [];
        tocarSomNovoPedido(p.id);
        currentUser.orders.unshift({
          supaId: p.id, id: '#' + String(++orderCounter).padStart(4,'0'),
          client: p.client_name, phone: p.client_phone,
          address: p.address, delivery: p.delivery_type,
          items: (() => { try { return typeof p.items === 'string' ? JSON.parse(p.items) : (p.items||[]); } catch(e){return[];} })(),
          payment: p.payment_method, total: Number(p.total),
          status: p.status, time: 'agora', ts: Date.now()
        });
        temNovo = true;
      }
    });
    if (temNovo) { saveCurrentUser(); renderOrdersList(); renderOverviewOrders(); }
  } catch(e) {}
}

  // Polling de seguranÃ§a â€” verifica novos pedidos a cada 30s como fallback
  if (window._pollPedidos) clearInterval(window._pollPedidos);
  window._pollPedidos = setInterval(async () => {
    if (!currentUser?.id?.includes('-')) return;
    const db2 = getSupa(); if (!db2) return;
    try {
      const ultimoTs = currentUser.orders?.[0]?.ts || 0;
      const { data: novos } = await db2
        .from('orders').select('*')
        .eq('establishment_id', currentUser.id)
        .eq('status', 'new')
        .gt('created_at', new Date(ultimoTs || Date.now() - 60000).toISOString())
        .order('created_at', { ascending: false });
      if (novos && novos.length > 0) {
        const jaTem = new Set((currentUser.orders||[]).map(o => o.supaId));
        novos.forEach(p => {
          if (!jaTem.has(p.id)) {
            tocarSomNovoPedido();
            const np = {
              supaId: p.id, id: '#' + String(++orderCounter).padStart(4,'0'),
              client: p.client_name, phone: p.client_phone,
              address: p.address, delivery: p.delivery_type,
              items: (() => { try { return typeof p.items==='string'?JSON.parse(p.items):(p.items||[]); } catch(e){return[];} })(),
              payment: p.payment_method, total: Number(p.total),
              status: p.status, time: 'agora', ts: new Date(p.created_at).getTime()
            };
            currentUser.orders.unshift(np);
            showNotif('ðŸ”” Novo pedido!', p.client_name + ' Â· R$ ' + Number(p.total).toFixed(2).replace('.',','));
          }
        });
        saveCurrentUser();
        renderOrdersList();
        renderOverviewOrders();
      }
    } catch(e) {}
  }, 30000); // a cada 30 segundos
}


