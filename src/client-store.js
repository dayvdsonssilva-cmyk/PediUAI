// â”€â”€â”€ ABAS CLIENTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function togglePedidoDetalhe(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
}

function switchClientTab(tab) {
  document.getElementById('tab-cardapio')?.classList.toggle('active', tab === 'cardapio');
  document.getElementById('tab-meus-pedidos')?.classList.toggle('active', tab === 'meus-pedidos');
  document.getElementById('panel-cardapio')?.classList.toggle('active', tab === 'cardapio');
  document.getElementById('panel-meus-pedidos')?.classList.toggle('active', tab === 'meus-pedidos');
  if (tab === 'meus-pedidos') {
    renderMeusPedidos();
    // Debug: mostra quantos pedidos tem no localStorage
    const qtd = carregarPedidosCliente().length;
    console.log('Meus pedidos:', qtd, 'pedido(s) no localStorage');
  }
}
function salvarPedidoCliente(pedido) {
  try {
    if (!pedido || !pedido.id) return;
    const hist = carregarPedidosCliente(false); // sem filtro de expiraÃ§Ã£o
    // NÃ£o duplicar o mesmo pedido
    const jaExiste = hist.find(p => p.id === pedido.id || p.supaId === pedido.supaId);
    if (!jaExiste) {
      pedido.savedAt = pedido.savedAt || Date.now();
      hist.unshift(pedido);
    }
    localStorage.setItem('pw_hist_pedidos', JSON.stringify(hist.slice(0, 30)));
    console.log('Pedido salvo no histÃ³rico:', pedido.id, 'Total:', hist.length);
  } catch(e) { console.warn('Erro salvar pedido cliente:', e); }
}
function carregarPedidosCliente(filtrarExpirados = true) {
  try {
    const raw = localStorage.getItem('pw_hist_pedidos');
    if (!raw) return [];
    const todos = JSON.parse(raw);
    if (!filtrarExpirados) return todos;
    const umDia = 25 * 60 * 60 * 1000; // 25h para ter margem
    return todos.filter(p => (Date.now() - (p.savedAt||Date.now())) < umDia);
  } catch(e) { return []; }
}
function renderMeusPedidos() {
  const lista = document.getElementById('meus-pedidos-lista'); if (!lista) return;
  const pedidos = carregarPedidosCliente();
  if (!pedidos.length) { lista.innerHTML='<div style="text-align:center;padding:3rem 1rem"><div style="font-size:2.5rem;margin-bottom:.75rem">ðŸ“­</div><div style="font-weight:700">Nenhum pedido ainda</div><div style="font-size:.8rem;color:var(--ink3);margin-top:.3rem">FaÃ§a seu primeiro pedido!</div></div>'; return; }
  lista.innerHTML = pedidos.map(p => {
    const isPickup = p.delivery==='pickup';
    const isReady = p.status==='ready';
    const isPreparing = p.status==='preparing';
    const isRejected = p.status==='rejected';
    const stLabel = isRejected ? 'âœ• Pedido recusado' : isPreparing ? 'ðŸ³ Preparando...' :
      isReady ? (isPickup ? 'âœ… Pronto para retirada!' : 'ðŸ›µ Saiu para entrega!') :
      p.status==='done' ? 'ðŸ Entregue' : 'â³ Aguardando confirmaÃ§Ã£o';
    const stBg = isRejected?'#FEF2F2':isPreparing?'#eef2ff':isReady?'var(--success-bg)':'var(--brand-light)';
    const stCor = isRejected?'#DC2626':isPreparing?'#6366f1':isReady?'var(--success)':'var(--brand)';
    const itens = (p.items||[]).map(i=>`${i.emoji?i.emoji+' ':''}${i.qty}x ${i.name}`).join('  ');
    // EndereÃ§o da loja sÃ³ aparece quando for retirada E estiver pronto
    const endAddr = isReady && isPickup && p.lojaAddress
      ? `<div style="margin-top:.5rem;padding:.6rem .75rem;background:rgba(26,138,90,.08);border:1px solid rgba(26,138,90,.2);border-radius:8px;font-size:.78rem;color:var(--success)">
           <strong>ðŸ“ EndereÃ§o para retirada:</strong><br>${p.lojaAddress}
         </div>` : '';
    const pidx = pedidos.indexOf(p);
    const detailId = 'pedido-detail-' + pidx;
    return `<div style="background:var(--white);border:1.5px solid ${stCor};border-radius:var(--r);margin-bottom:.75rem;box-shadow:0 1px 6px rgba(0,0,0,.06);overflow:hidden">
      <!-- CabeÃ§alho clicÃ¡vel -->
      <div onclick="togglePedidoDetalhe('${detailId}')" style="padding:1rem;cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem">
          <div>
            <div style="font-weight:800;font-size:.9rem">${p.id||'#â€”'}</div>
            <div style="font-size:.7rem;color:var(--ink3);margin-top:.1rem">${p.lojaName||''} Â· ${p.time||'agora'}</div>
          </div>
          <span style="font-size:.7rem;font-weight:700;background:${stBg};color:${stCor};padding:.2rem .6rem;border-radius:100px;white-space:nowrap;flex-shrink:0">${stLabel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:800;color:var(--brand);font-size:.95rem">R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</div>
          <div style="font-size:.8rem;color:var(--ink3)">Toque para ver detalhes â–¼</div>
        </div>
      </div>
      <!-- Detalhes expandÃ­veis -->
      <div id="${detailId}" style="display:none;border-top:1px solid var(--border);padding:.85rem 1rem;background:var(--surface)">
        <div style="font-size:.75rem;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Itens do pedido</div>
        ${(p.items||[]).map(i=>`<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.25rem 0;border-bottom:1px solid var(--border)">
          <span>${i.qty}x ${i.name}</span>
          <span style="color:var(--brand);font-weight:700">R$ ${(Number(i.price||0)*i.qty).toFixed(2).replace('.',',')}</span>
        </div>`).join('')}
        <div style="display:flex;justify-content:space-between;margin-top:.6rem;font-weight:800;font-size:.9rem">
          <span>Total</span><span style="color:var(--brand)">R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</span>
        </div>
        <div style="margin-top:.5rem;font-size:.78rem;color:var(--ink3)">
          ðŸ’³ ${p.payment||'â€”'} &nbsp;Â·&nbsp; ${p.delivery==='pickup'?'ðŸƒ Retirada':'ðŸ›µ Entrega'}
        </div>
        ${endAddr}
      </div>
    </div>`;
  }).join('');
}

// â”€â”€â”€ REALTIME CLIENTE â€” escuta mudanÃ§as do SEU pedido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Esta funÃ§Ã£o roda SOMENTE no celular do cliente, apÃ³s fazer um pedido
let realtimeChannel = null;
let _pedidoEntrega = 'pickup'; // guarda tipo de entrega para usar na notif

async function assinarStatusPedido(orderId, tipoEntrega) {
  const db = getSupa(); if (!db || !orderId) return;
  _pedidoEntrega = tipoEntrega || 'pickup';
  // Cancela canal anterior
  if (realtimeChannel) { try { db.removeChannel(realtimeChannel); } catch(e){} realtimeChannel = null; }
  realtimeChannel = db
    .channel('cliente-pedido-' + orderId)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'orders',
      filter: `id=eq.${orderId}`
    }, (payload) => {
      const novoStatus = payload.new?.status;
      if (novoStatus === 'preparing') {
        // Atualiza histÃ³rico do cliente
        atualizarStatusPedidoCliente(orderId, 'preparing');
        notifCliente('ðŸ³ Pedido confirmado!', 'Estamos preparando agora. Aguarde!');
        showCSNotif('preparing');
      } else if (novoStatus === 'rejected') {
        atualizarStatusPedidoCliente(orderId, 'rejected');
        notifCliente('âœ• Pedido recusado', 'O estabelecimento nÃ£o pÃ´de aceitar seu pedido.');
        showCSNotif('rejected');
      } else if (novoStatus === 'ready') {
        const msg = _pedidoEntrega === 'pickup' ? 'Pode vir retirar no estabelecimento.' : 'Seu pedido saiu para entrega.';
        const titulo = _pedidoEntrega === 'pickup' ? 'Pronto para retirada!' : 'Pedido a caminho!';
        atualizarStatusPedidoCliente(orderId, 'ready');
        notifCliente(titulo, msg);
        showCSNotif('ready');
      }
    })
    .subscribe((status) => {
      console.log('Realtime cliente:', status);
    });
}


function atualizarStatusPedidoCliente(orderId, novoStatus) {
  try {
    const lista = carregarPedidosCliente(false); // busca todos, sem filtrar
    const idx = lista.findIndex(p => p.supaId === orderId || p.id === orderId);
    if (idx >= 0) {
      lista[idx].status = novoStatus;
      localStorage.setItem('pw_hist_pedidos', JSON.stringify(lista));
      // Se estiver na aba meus pedidos, re-renderiza
      if (document.getElementById('panel-meus-pedidos')?.classList.contains('active')) {
        renderMeusPedidos();
      }
    }
  } catch(e) {}
}
// â”€â”€â”€ STORE (CLIENT) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderStore() {
  const u = currentUser; if(!u) return;
  // Esconde botÃ£o voltar se nÃ£o for demo
  const backBtn = document.getElementById('demo-back-btn');
  if (backBtn) backBtn.style.display = (u.id === 'demo' && window._fromLanding) ? 'flex' : 'none';
  // Cor da marca no hero
  const heroBg = document.getElementById('s-hero-bg');
  if (heroBg) heroBg.style.background = u.colorGrad || u.color || '#1A1208';
  document.documentElement.style.setProperty('--brand', u.color||'#E8410A');
  // Logo no canto superior direito
  const logoEl = document.getElementById('store-logo-el');
  const seEl = document.getElementById('se');
  if (logoEl && u.logo) {
    logoEl.innerHTML = `<img src="${u.logo}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else if (seEl) {
    seEl.textContent = u.emoji || 'ðŸ”';
  }
  document.getElementById('sn').textContent = u.name;
  document.getElementById('sd').textContent = u.desc || '';
  // Pills dinÃ¢micas baseadas nas opÃ§Ãµes do estabelecimento
  // Pill de tempo dinÃ¢mico
  const pillTempo = document.getElementById('pill-tempo');
  if (pillTempo) pillTempo.textContent = 'â± ' + (u.prepTime || '30') + ' min';
  const pillEntrega = document.getElementById('pill-entrega');
  if (pillEntrega) {
    const temDel = u.deliveryEnabled !== false;
    const temPick = u.pickupEnabled !== false;
    if (temDel && temPick) pillEntrega.textContent = 'ðŸ“ Entrega e Retirada';
    else if (temDel) pillEntrega.textContent = 'ðŸ“ Entrega disponÃ­vel';
    else if (temPick) pillEntrega.textContent = 'ðŸ“ Apenas retirada';
    else pillEntrega.textContent = 'ðŸ“ Consulte o estabelecimento';
  }
  // Mostra aviso de fechado se loja nÃ£o estiver aberta
  const fechadoBanner = document.getElementById('loja-fechada-banner');
  const isOpen = u.isOpen !== false;
  if (fechadoBanner) fechadoBanner.style.display = isOpen ? 'none' : 'flex';
  renderFlashClient();
  pedirPermissaoNotificacao();
  // Restaura status do pedido pendente quando cliente volta ao cardÃ¡pio
  setTimeout(restaurarAssinaturaCliente, 1200);
  // Restaura assinatura Realtime para pedido ativo (quando cliente reabre o browser)
  restaurarAssinaturaCliente();
  const avail = (u.menuItems||[]).filter(i=>i.available);
  const cats = ['Todos',...new Set(avail.map(i=>i.cat))];
  document.getElementById('cat-tabs').innerHTML = cats.map((c,i)=>`<button class="cp ${i===0?'active':''}" onclick="filterCat('${c}',this)">${c}</button>`).join('');
  renderClientMenu('Todos');
  updateCartUI();
}

async function renderFlashClient(){
  // Carrega fresquinhos da coluna flash_items do estabelecimento
  if (currentUser?.id?.includes('-')) {
    try {
      const db = getSupa();
      if (db) {
        const { data: estab } = await db
          .from('estabelecimentos')
          .select('flash_items')
          .eq('id', currentUser.id)
          .single();
        if (estab?.flash_items) {
          const lista = typeof estab.flash_items === 'string'
            ? JSON.parse(estab.flash_items) : (estab.flash_items || []);
          // Filtra apenas nÃ£o expirados
          currentUser.flashItems = lista.filter(f => !f.expiresAt || f.expiresAt > Date.now());
          saveCurrentUser();
        }
      }
    } catch(e) { console.warn('Erro fresquinho:', e); }
  }
  const items=currentUser?.flashItems||[];
  const sec=document.getElementById('flash-client-sec');
  if(!items.length){if(sec)sec.style.display='none';return;}
  if(sec)sec.style.display='block';
  document.getElementById('flash-client-row').innerHTML=items.map((f,i)=>`<div class="fc" onclick="openFlash(${i})">
    ${f.url?`<img src="${f.url}" class="fc-th" onerror="this.style.display='none'">`: `<div class="fc-ph">${f.emoji}</div>`}
    <div class="fc-ov"></div>
  </div>`).join('');
}

function openFlash(idx){
  if(!currentUser?.flashItems?.length) return;
  flashIdx=idx;
  document.getElementById('modal-flash').style.display='block';
  document.body.style.overflow='hidden';
  renderFlashSlide();
}
function renderFlashSlide(){
  clearTimeout(flashTimer);
  const items=currentUser?.flashItems||[];
  const f=items[flashIdx]; if(!f){closeFlash();return;}
  const slides=document.getElementById('flash-slides');
  slides.innerHTML=f.url?(f.type==='video'?`<video src="${f.url}" autoplay playsinline loop controls style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"></video>`:`<img src="${f.url}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`): `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:8rem">${f.emoji}</div>`;
  const fsTitleEl = document.getElementById('fs-title');
  if (fsTitleEl) {
    fsTitleEl.textContent = f.title || '';
    fsTitleEl.style.display = f.title ? 'block' : 'none';
  }
  const prog=document.getElementById('fp-prog');
  prog.innerHTML=items.map((_,i)=>`<div class="fp-track"><div class="fp-fill" id="fp-${i}" style="width:${i<flashIdx?'100%':'0%'}"></div></div>`).join('');
  const fill=document.getElementById('fp-'+flashIdx);
  if(fill){fill.style.transition=`width ${FLASH_DUR}ms linear`;requestAnimationFrame(()=>{fill.style.width='100%';});}
  flashTimer=setTimeout(()=>flashNext(),FLASH_DUR);
}
function flashNext(){const items=currentUser?.flashItems||[];if(flashIdx<items.length-1){flashIdx++;renderFlashSlide();}else{closeFlash();}}
function flashPrev(){if(flashIdx>0){flashIdx--;renderFlashSlide();}}
function closeFlash(){clearTimeout(flashTimer);document.getElementById('modal-flash').style.display='none';document.body.style.overflow='';document.getElementById('flash-slides').innerHTML='';}

function renderClientMenu(cat){
  const list=document.getElementById('client-menu');
  const avail=(currentUser?.menuItems||[]).filter(i=>i.available);
  const filtered=cat==='Todos'?avail:avail.filter(i=>i.cat===cat);
  if(!filtered.length){list.innerHTML='<div class="es"><div class="ei">ðŸ½ï¸</div><p>Nenhum item nesta categoria</p></div>';return;}
  list.innerHTML=filtered.map((it,idx)=>`<div class="ci">
    <div class="ci-in">
      <div class="ci-med" onclick="openProductModal(${idx})">
        ${it.photo ? `<img src="${it.photo}" alt="${it.name}" onerror="this.style.display='none';this.nextElementSibling.style.opacity='1'">` : ''}
        <span class="ef" style="${it.photo?'opacity:0':''}; transition:.2s">${it.emoji||'ðŸ½ï¸'}</span>
      </div>
      <div class="ci-body">
        <div class="ci-name">${it.name}</div>
        <div class="ci-desc">${it.desc||''}</div>
        <div class="ci-foot"><div class="ci-price">R$ ${Number(it.price).toFixed(2).replace('.',',')}</div>
          <div class="ci-acts"><button class="smb" onclick="openProductModal(${idx})">Ver mais</button><button class="ab" onclick="addToCart(${idx},this)">+</button></div>
        </div>
      </div>
    </div>
  </div>`).join('');
}
function filterCat(cat,btn){document.querySelectorAll('.cp').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderClientMenu(cat);}

function openProductModal(idx){
  const avail=(currentUser?.menuItems||[]).filter(i=>i.available);
  const it=avail[idx]; if(!it) return;
  const id=it.id;
  const img=document.getElementById('pm-img');
  document.getElementById('pm-emoji').textContent=it.emoji;
  if(it.photo){let i=img.querySelector('img');if(!i){i=document.createElement('img');img.appendChild(i);}i.src=it.photo;i.style.cssText='width:100%;height:100%;object-fit:cover;position:absolute;inset:0';document.getElementById('pm-emoji').style.opacity='0';}
  else{const i=img.querySelector('img');if(i)i.remove();document.getElementById('pm-emoji').style.opacity='1';}
  document.getElementById('pm-cat').textContent=it.cat;
  document.getElementById('pm-name').textContent=it.name;
  document.getElementById('pm-desc').textContent=it.desc;
  document.getElementById('pm-price').textContent='R$ '+it.price.toFixed(2).replace('.',',');
  document.getElementById('pm-add').onclick=()=>{addToCartById(id,null);closeModal('modal-product');};
  openModal('modal-product');
}
function addToCart(idx,btn){
  const avail=(currentUser?.menuItems||[]).filter(i=>i.available);
  const it=avail[idx]; if(!it) return;
  addToCartById(it.id, btn);
}
function addToCartById(id,btn){
  const it=(currentUser?.menuItems||[]).find(i=>i.id===id); if(!it) return;
  const ex=cart.find(c=>c.id===id);
  if(ex) ex.qty++; else cart.push({...it,qty:1});
  updateCartUI();
  if(btn){btn.textContent='âœ“';btn.style.background='var(--success)';setTimeout(()=>{btn.textContent='+';btn.style.background='';},700);}
}
function updateCartUI(){
  const count=cart.reduce((s,c)=>s+c.qty,0), total=cart.reduce((s,c)=>s+c.qty*c.price,0);
  const fab=document.getElementById('cart-fab');
  fab.classList.toggle('vis',count>0);
  document.getElementById('cart-cnt').textContent=count;
  document.getElementById('cart-total-fab').textContent='R$ '+total.toFixed(2).replace('.',',');
}

// â”€â”€â”€ DELIVERY TYPE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setDeliveryType(type){
  deliveryType=type;
  document.getElementById('dt-delivery')?.classList.toggle('active',type==='delivery');
  document.getElementById('dt-pickup')?.classList.toggle('active',type==='pickup');
  const ab = document.getElementById('address-block');
  if (ab) ab.style.display=type==='delivery'?'block':'none';
  // Recalcula total com/sem taxa ao trocar tipo de entrega
  const subtotal = cart.reduce((s,c)=>s+c.qty*c.price,0);
  const taxa = type==='delivery' ? (currentUser?.deliveryFee||0) : 0;
  const taxaRow = document.getElementById('co-taxa-row');
  const taxaEl = document.getElementById('co-taxa');
  if (taxaRow) taxaRow.style.display = taxa>0 ? 'flex' : 'none';
  if (taxaEl) taxaEl.textContent = 'R$ '+taxa.toFixed(2).replace('.',',');
  const totalEl = document.getElementById('co-total');
  if (totalEl) totalEl.textContent = 'R$ '+(subtotal+taxa).toFixed(2).replace('.',',');
  const pickupBlock = document.getElementById('pickup-address-block');
  if (pickupBlock) {
    if (type === 'pickup') {
      pickupBlock.style.display = 'block';
      const endLoja = currentUser?.address || '';
      pickupBlock.innerHTML = `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:var(--rs);padding:.85rem 1rem;margin-bottom:.85rem">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">
          <span style="font-size:1.1rem">ðŸ“</span>
          <span style="font-weight:700;font-size:.85rem;color:#166534">Local de retirada</span>
        </div>
        ${endLoja
          ? `<div style="font-size:.82rem;color:#15803d;line-height:1.5">${endLoja}</div>`
          : `<div style="font-size:.78rem;color:#6b7280">O estabelecimento informarÃ¡ o endereÃ§o pelo WhatsApp.</div>`
        }
      </div>`;
    } else {
      pickupBlock.style.display = 'none';
    }
  }
}

// â”€â”€â”€ CHECKOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderCheckout(){
  const list=document.getElementById('cart-items'); if(!cart.length){list.innerHTML='<div class="es"><p>Carrinho vazio</p></div>';return;}
  // Mostra/oculta opÃ§Ãµes de acordo com configuraÃ§Ã£o do estabelecimento
  const temDel = currentUser?.deliveryEnabled !== false;
  const temPick = currentUser?.pickupEnabled !== false;
  const taxaFee = currentUser?.deliveryFee || 0;
  document.getElementById('dt-delivery').style.display = temDel ? '' : 'none';
  document.getElementById('dt-pickup').style.display = temPick ? '' : 'none';
  if (!temDel && temPick) setDeliveryType('pickup');
  if (temDel && !temPick) setDeliveryType('delivery');
  const taxaLabel = document.getElementById('taxa-label-checkout');
  if (taxaLabel) taxaLabel.textContent = taxaFee > 0 ? `Taxa: R$ ${taxaFee.toFixed(2).replace('.',',')}` : 'Entrega grÃ¡tis';
  list.innerHTML=cart.map((it,i)=>`<div class="cir"><div class="ce">${it.emoji||'ðŸ½ï¸'}</div><div class="cn">${it.name}</div><div class="qc"><button class="qb" onclick="changeQty(${i},-1)">âˆ’</button><span class="qn">${it.qty}</span><button class="qb" onclick="changeQty(${i},1)">+</button></div><div class="cprice">R$ ${(it.qty*Number(it.price)).toFixed(2).replace('.',',')}</div></div>`).join('');
  const subtotal = cart.reduce((s,c)=>s+c.qty*c.price,0);
  const taxa = (deliveryType === 'delivery') ? taxaFee : 0;
  const total = subtotal + taxa;
  const taxaEl = document.getElementById('co-taxa');
  const taxaRow = document.getElementById('co-taxa-row');
  if (taxaRow) taxaRow.style.display = taxa > 0 ? 'flex' : 'none';
  if (taxaEl) taxaEl.textContent = 'R$ ' + taxa.toFixed(2).replace('.',',');
  document.getElementById('co-total').textContent='R$ '+total.toFixed(2).replace('.',',');
}
function changeQty(i,d){cart[i].qty+=d;if(cart[i].qty<=0)cart.splice(i,1);renderCheckout();updateCartUI();}
function selPayment(el,m){document.querySelectorAll('.po').forEach(o=>o.classList.remove('selected'));el.classList.add('selected');selectedPayment=m;}
function placeOrder(){
  const name=document.getElementById('cl-name').value.trim();
  const phone=document.getElementById('cl-phone').value.trim();
  if(!name||!phone){alert('Preencha nome e telefone');return;}
  if(deliveryType==='delivery'&&!document.getElementById('cl-addr').value.trim()){alert('Preencha o endereÃ§o de entrega');return;}
  if(cart.length===0){alert('Carrinho vazio');return;}
  buildConfirmData();
  goTo('s-confirm-data');
}


function openWhatsApp(){
  const orders=currentUser?.orders||[]; const o=orders[0]; if(!o) return;
  const msg=encodeURIComponent(`OlÃ¡! Fiz um pedido pelo PEDIWAY ðŸŽ‰\n\nPedido ${o.id}\nNome: ${o.client}\nTelefone: ${o.phone}\nEntrega: ${o.delivery==='pickup'?'Retirada':'Entrega - '+o.address}\nItens: ${o.items.map(i=>`${i.qty}x ${i.name}`).join(', ')}\nPagamento: ${o.payment}\nTotal: R$ ${o.total.toFixed(2).replace('.',',')}`);
  window.open(`https://wa.me/${currentUser?.whatsapp||''}?text=${msg}`,'_blank');
}

