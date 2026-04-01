function el(id) { return document.getElementById(id); }

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializa demo
  initDemoData();
  // 2. Verifica se hÃ¡ sessÃ£o ativa (persiste no refresh)
  const path = window.location.pathname;
  const isStorePath = /\/restaurante\/[\w-]+/.test(path);
  if (!isStorePath) {
    const sess = SESSION.get();
    if (sess) {
      const users = getUsers();
      const user = users.find(u => u.id === sess.id || u.email === sess.email);
      if (user && user.status === 'active') {
        currentUser = user;
        currentStoreSlug = user.slug;
        goTo('s-dash');
        return;
      } else {
        SESSION.clear(); // sessÃ£o invÃ¡lida
      }
    }
  }
  // 3. Roteamento normal â€” await garante que o store carrega antes de qualquer outra coisa
  await initRoutingAsync();
  setDeliveryType('delivery');
});

async function initRoutingAsync() {
  const path = window.location.pathname;
  const pathMatch = path.match(/\/restaurante\/([\w-]+)/);
  if (!pathMatch) {
    // PÃ¡gina normal â€” nÃ£o Ã© link de loja
    return;
  }

  const slug = pathMatch[1];

  // Demo â€” sempre do localStorage
  if (slug === 'demo') {
    openDemo();
    return;
  }

  // 1. Tenta localStorage primeiro (instantÃ¢neo)
  const users = getUsers();
  const localUser = users.find(u => u.slug === slug && u.status === 'active')
    || users.find(u => u.slug.startsWith(slug) && u.status === 'active');
  if (localUser) {
    currentUser = localUser;
    currentStoreSlug = slug;
    goTo('s-store');
    return;
  }

  // 2. Abre a tela de loja mostrando "Carregando..."
  goTo('s-store');
  document.getElementById('sn').textContent = 'Carregando...';
  document.getElementById('sd').textContent = '';

  // 3. Aguarda Supabase estar pronto (atÃ© 3 tentativas)
  let loja = null;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (tentativa > 0) await new Promise(r => setTimeout(r, 600));
    loja = await carregarLojaSupa(slug);
    if (loja) break;
  }

  if (loja && loja.inactive) {
    // Loja existe mas estÃ¡ inativa
    document.getElementById('sn').textContent = loja.name || 'Loja';
    document.getElementById('sd').textContent = 'TEMPORARIAMENTE INATIVA';
  } else if (loja) {
    currentUser = loja;
    currentStoreSlug = slug;
    renderStore();
  } else {
    document.getElementById('sn').textContent = 'Loja nÃ£o encontrada';
    document.getElementById('sd').textContent = 'Verifique o link e tente novamente.';
    document.getElementById('sd').style.color = 'rgba(255,255,255,.5)';
  }
}

function confirmAndSendOrder() {
  const u = currentUser;
  if (!u) return;
  const name=document.getElementById('cl-name').value.trim();
  const phone=document.getElementById('cl-phone').value.trim();
  const addr=deliveryType==='delivery'?document.getElementById('cl-addr').value.trim():'Retirada no local';
  const subtotal=cart.reduce((s,c)=>s+c.qty*c.price,0);
  const taxaEntrega = deliveryType==='delivery' ? (u.deliveryFee||0) : 0;
  const total = subtotal + taxaEntrega;
  orderCounter++;
  localStorage.setItem('pw_order_counter', String(orderCounter));
  const order={
    id:'#' + String(orderCounter).padStart(4,'0'), client:name, phone, address:addr, delivery:deliveryType,
    items: cart.map(c=>({name:c.name, qty:c.qty, price:c.price})),
    payment:selectedPayment, total, status:'new', time:'agora', ts:Date.now()
  };
  u.orders=[order,...(u.orders||[])];
  saveCurrentUser();
  // NÃ£o mostra notif aqui â€” isso Ã© do lado do cliente, nÃ£o do estabelecimento
  // Salva no Supabase se loja veio do banco
  // Salva no Supabase e assina Realtime para notificar o cliente
  // Garante que temos UUID real antes de salvar
  const lojaIdParaSalvar = (u.id && u.id.includes('-')) ? u.id : null;
  if (lojaIdParaSalvar) {
    console.log('Salvando pedido no Supabase para loja:', lojaIdParaSalvar);
    salvarPedidoSupa(lojaIdParaSalvar, order).then(orderId => {
      if (orderId) {
        // Atualiza o ID exibido ao cliente com o ID real do Supabase
        // MantÃ©m o ID sequencial, salva apenas o supaId para rastreamento
        order.supaId = orderId;
        u.orders[0].supaId = orderId;
        saveCurrentUser();
        // Atualiza o pedido no histÃ³rico com o supaId real (sem mudar o ID visÃ­vel)
        try {
          const lista = carregarPedidosCliente(false);
          if (lista[0]) { lista[0].supaId = orderId; }
          localStorage.setItem('pw_hist_pedidos', JSON.stringify(lista));
        } catch(e) {}
        // Inicia escuta de status â€” SOMENTE no celular do cliente
        assinarStatusPedido(orderId, deliveryType);
      }
    });
  }
  // Salva no histÃ³rico do cliente ANTES de limpar carrinho
  const pedidoParaSalvar = {
    ...order,
    lojaAddress: u.address || '',
    lojaName: u.name || '',
    time: 'agora',
    savedAt: Date.now()
  };
  salvarPedidoCliente(pedidoParaSalvar);
  cart=[];
  updateCartUI();
  buildConfirmation(order);
  goTo('s-confirm');
  // Jogo sÃ³ inicia APÃ“S pedido enviado, com pequeno delay para animaÃ§Ã£o
  setTimeout(()=>startGame(), 1000);
}

// Alias para compatibilidade
function updateCartFab() { updateCartUI(); }

function buildConfirmation(order) {
  // Ãcone animado â€” moto (entrega) ou corrida (retirada)
  const icon = order.delivery === 'pickup' ? 'ðŸƒ' : 'ðŸ›µ';
  // Ã­cone removido da tela de confirmaÃ§Ã£o
  const orderIdEl = document.getElementById('conf-order-id');
  if (orderIdEl) orderIdEl.textContent = order.id;
  // Cor da loja na arte
  const art = document.getElementById('conf-art');
  if (art && currentUser?.color) {
    art.style.background = `linear-gradient(150deg, ${currentUser.color} 0%, ${currentUser.colorDark||'#B83208'} 100%)`;
  }
  // PartÃ­culas de confetti
  spawnParticles();
  // Status bar â€” volta para aguardando
  const bar = document.getElementById('client-status-bar');
  if (bar) { bar.className = 'csb'; bar.innerHTML = ''; }
  const waiting = document.getElementById('status-waiting');
  if (waiting) waiting.style.display = 'flex';
  // Jogo â€” reset para tela inicial
  const gmsg = document.getElementById('game-start-msg');
  const gover = document.getElementById('game-over');
  const gburger = document.getElementById('game-burger');
  if (gmsg) gmsg.style.display = 'flex';
  if (gover) gover.style.display = 'none';
  if (gburger) gburger.style.display = 'none';
  gameActive = false; clearInterval(gTimer); cancelAnimationFrame(gAnimFrame);
  gameScore = 0;
  const scoreEl = document.getElementById('g-score'); if (scoreEl) scoreEl.textContent = '0';
  const timerEl = document.getElementById('g-timer'); if (timerEl) timerEl.textContent = '20';
}

function buildConfirmData() {
  const total=cart.reduce((s,c)=>s+c.qty*c.price,0);
  const name=document.getElementById('cl-name').value;
  const phone=document.getElementById('cl-phone').value;
  const addr=deliveryType==='delivery'?document.getElementById('cl-addr').value:'Retirada no local';
  const items=cart.map(c=>`${c.qty}x ${c.name} â€” R$ ${(c.qty*c.price).toFixed(2).replace('.',',')}`);
  const cdItems=document.getElementById('confirm-data-items');
  const cdTotal=document.getElementById('confirm-data-total');
  const cdDel=document.getElementById('confirm-data-delivery');
  const cdPay=document.getElementById('confirm-data-payment');
  if(cdItems) cdItems.innerHTML=items.join('<br>');
  if(cdTotal) cdTotal.textContent='R$ '+total.toFixed(2).replace('.',',');
  const endLoja = currentUser?.address || '';
  const retiradaInfo = deliveryType==='pickup' && endLoja
    ? `<br><strong style="color:#166534">ðŸ“ Retirar em:</strong> <span style="color:#15803d">${endLoja}</span>`
    : deliveryType==='pickup' ? '<br><em style="color:var(--ink3)">EndereÃ§o serÃ¡ informado pelo WhatsApp</em>' : '';
  if(cdDel) cdDel.innerHTML=`<strong>Nome:</strong> ${name}<br><strong>Telefone:</strong> ${phone}<br><strong>Tipo:</strong> ${deliveryType==='pickup'?'Retirada':'Entrega'}${deliveryType==='delivery'?'<br><strong>EndereÃ§o:</strong> '+addr:''}${retiradaInfo}`;
  if(cdPay) cdPay.textContent=selectedPayment;
}



