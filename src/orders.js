// â”€â”€â”€ ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function sLabel(s){return s==='new'?'Novo':s==='preparing'?'Preparando':s==='ready'?'Pronto':s==='rejected'?'Recusado':'Entregue';}
function renderOrdersList() {
  const orders=currentUser?.orders||[];
  const newOrders = orders.filter(o => o.status === 'new');
  const otherOrders = orders.filter(o => o.status !== 'new');
  
  // Atualiza count de novos pedidos
  const newCount = document.getElementById('new-orders-count');
  if(newCount) newCount.textContent = newOrders.length > 0 ? ` (${newOrders.length})` : '';
  
  // Renderiza novos pedidos (Ã¡rea grande)
  const newOrdersContainer = document.getElementById('new-orders-container');
  if(newOrdersContainer) {
    if(!newOrders.length) {
      newOrdersContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink3);font-weight:500">âœ… Nenhum novo pedido</div>';
    } else {
      newOrdersContainer.innerHTML = newOrders.map((o,i)=>{
        const realIdx = orders.indexOf(o);
        return `<div class="oc" style="background:var(--white);border:2px solid var(--brand);margin-bottom:1rem;padding:1.1rem;border-radius:var(--r);transition:all .2s" onmouseover="this.style.boxShadow='0 4px 12px rgba(232,65,10,.15)'" onmouseout="this.style.boxShadow='none'">
    <div class="oh"><div>
      <div class="oid" style="font-size:1rem;font-weight:800;color:var(--brand)">${o.id} â€” ${o.client}</div>
      <div class="ometa">${o.time} Â· ${o.delivery==='pickup'?'ðŸƒ Retirada':'ðŸ›µ '+o.address} Â· ðŸ“ž ${o.phone||'â€”'}</div>
    </div></div>
    <div class="oi" style="margin:0.7rem 0;font-size:.95rem;font-weight:600">${o.items.map(it=>`${it.qty}x ${it.name}`).join(' â€¢ ')}</div>
    <div class="of" style="border-top:1px solid var(--border);padding-top:.8rem;margin-top:.8rem">
      <div class="ot" style="font-size:1.4rem;font-weight:800;color:var(--brand)">R$ ${o.total.toFixed(2).replace('.',',')}</div>
      <div class="oacts" style="display:flex;gap:.5rem;margin-top:.8rem;flex-wrap:wrap">
        <button class="btn btn-brand" style="flex:1;font-size:.76rem;padding:.5rem .8rem;font-weight:700" onclick="markPreparing(${realIdx})">âœ… ACEITAR</button>
        <button class="btn" style="flex:1;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;font-size:.76rem;padding:.5rem .8rem;font-weight:700" onclick="recusarPedido(${realIdx})">âœ• RECUSAR</button>
        <button class="btn" style="border:1px solid var(--border);color:var(--ink2);font-size:.7rem;padding:.35rem .7rem;flex:1" onclick="viewReceipt(${realIdx})">ðŸ“„ Notinha</button>
      </div>
    </div>
  </div>`;
      }).join('');
    }
  }
  
  // Renderiza histÃ³rico (pedidos em preparo, pronto, recusado)
  document.getElementById('orders-count').textContent = otherOrders.length + ' pedido(s)';
  const list=document.getElementById('orders-list');
  if(!otherOrders.length){
    list.innerHTML='<div class="es"><div class="ei">ðŸ“­</div><p>Nenhum pedido no histÃ³rico</p></div>';
    return;
  }
  list.innerHTML=otherOrders.map((o,i)=>{
    const realIdx = orders.indexOf(o);
    return `<div class="oc">
    <div class="oh"><div><div class="oid">${o.id} â€” ${o.client}</div><div class="ometa">${o.time} Â· ${o.delivery==='pickup'?'ðŸƒ Retirada':'ðŸ›µ '+o.address} Â· ðŸ“ž ${o.phone||'â€”'}</div></div>
    <span class="sb s-${o.status}">${sLabel(o.status)}</span></div>
    <div class="oi">${o.items.map(it=>`${it.qty}x ${it.name}`).join(' â€¢ ')}</div>
    <div class="of"><div class="ot">R$ ${o.total.toFixed(2).replace('.',',')}</div>
    <div class="oacts">
      <button class="btn" style="border:1px solid var(--border);color:var(--ink2);font-size:.7rem;padding:.35rem .7rem" onclick="viewReceipt(${realIdx})">ðŸ“„ Notinha</button>
      ${o.status==='preparing'?`<button class="btn btn-brand" style="font-size:.7rem;padding:.35rem .7rem" onclick="markReady(${realIdx})">âœ… Pronto</button>`:''}
      ${o.status==='rejected'?`<span style="font-size:.72rem;color:#DC2626;font-weight:700">Pedido recusado</span>`:''}
    </div></div>
  </div>`;
  }).join('');
}
function renderOverviewOrders(){
  const orders=currentUser?.orders||[];
  const el=document.getElementById('ov-orders');
  const recent=orders.slice(0,2);
  if(!recent.length){el.innerHTML='<div class="es"><p>Nenhum pedido ainda</p></div>';return;}
  el.innerHTML=recent.map(o=>`<div class="oc" style="margin-bottom:.8rem">
    <div class="oh"><div><div class="oid">${o.id} â€” ${o.client}</div><div class="ometa">${o.time}</div></div><span class="sb s-${o.status}">${sLabel(o.status)}</span></div>
    <div class="oi">${o.items.map(it=>`${it.qty}x ${it.name}`).join(' â€¢ ')}</div>
    <div style="padding-top:.55rem;border-top:1px solid var(--border);margin-top:.45rem;font-family:'Poppins',sans-serif;font-weight:700">R$ ${o.total.toFixed(2).replace('.',',')}</div>
  </div>`).join('');
}
async function recusarPedido(i){
  if(!currentUser || !confirm('Recusar este pedido?')) return;
  pararSomNotificacao(); // para o som
  currentUser.orders[i].status='rejected';
  saveCurrentUser(); renderOrdersList(); renderOverviewOrders();
  const db = getSupa();
  const o = currentUser.orders[i];
  if (db && o.supaId) {
    await db.from('orders').update({status:'rejected'}).eq('id', o.supaId);
  }
  showNotif('âœ• Pedido recusado', o.client + ' foi notificado.');
}

async function markPreparing(i){
  if(!currentUser) return;
  pararSomNotificacao(); // aceito â€” para o som
  currentUser.orders[i].status='preparing';
  saveCurrentUser(); renderOrdersList(); renderOverviewOrders();
  const db = getSupa();
  const o = currentUser.orders[i];
  if (db && o.supaId) {
    await db.from('orders').update({status:'preparing'}).eq('id', o.supaId);
  }
}
async function markReady(i){
  if(!currentUser) return;
  currentUser.orders[i].status='ready';
  saveCurrentUser(); renderOrdersList(); renderOverviewOrders();
  showCSNotif('ready');
  // Atualiza no Supabase â€” cliente recebe em tempo real
  const db = getSupa();
  const o = currentUser.orders[i];
  if (db && o.supaId) {
    await db.from('orders').update({status:'ready'}).eq('id', o.supaId);
  }
}

function viewReceipt(i) {
  const o=currentUser?.orders[i]; if(!o) return;
  document.getElementById('receipt-content').innerHTML=buildReceipt(o);
  openModal('modal-receipt');
}
function buildReceipt(o) {
  const items=o.items.map(it=>`<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.3rem 0;gap:.8rem"><span>${it.qty}x ${it.name}</span><span>R$ ${(it.qty*it.price).toFixed(2).replace('.',',')}</span></div>`).join('');
  return `<div style="background:var(--white);border-radius:16px;padding:1.2rem;border:1px solid var(--border)">
    <div style="text-align:center;padding-bottom:.85rem;border-bottom:1px dashed var(--border);margin-bottom:.85rem"><span style="font-family:'Poppins',sans-serif;font-weight:800;font-size:1.15rem">PEDI<span style="color:var(--brand)">WAY</span></span><div style="font-size:.72rem;color:var(--ink3);margin-top:.2rem">${currentUser?.name||'Estabelecimento'}</div></div>
    <div style="font-size:.82rem;padding:.3rem 0;display:flex;justify-content:space-between;gap:.8rem"><span style="color:var(--ink3);font-weight:600">Nome</span><span style="font-weight:700;text-align:right">${o.client}</span></div>
    <div style="font-size:.82rem;padding:.3rem 0;display:flex;justify-content:space-between;gap:.8rem"><span style="color:var(--ink3);font-weight:600">Telefone</span><span style="text-align:right">${o.phone||'â€”'}</span></div>
    <div style="font-size:.82rem;padding:.3rem 0;display:flex;justify-content:space-between;gap:.8rem"><span style="color:var(--ink3);font-weight:600">Entrega</span><span style="text-align:right">${o.delivery==='pickup'?'ðŸƒ Retirada':'ðŸ›µ '+o.address}</span></div>
    <hr style="border:none;border-top:1px dashed var(--border);margin:.7rem 0">
    <div style="font-size:.68rem;color:var(--ink3);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Pedido</div>
    ${items}
    <hr style="border:none;border-top:1px dashed var(--border);margin:.7rem 0">
    <div style="display:flex;justify-content:space-between;font-family:'Poppins',sans-serif;font-weight:800;font-size:1rem"><span>Total</span><span style="color:var(--brand)">R$ ${o.total.toFixed(2).replace('.',',')}</span></div>
    <div style="font-size:.82rem;padding:.3rem 0;display:flex;justify-content:space-between;gap:.8rem;margin-top:.3rem"><span style="color:var(--ink3);font-weight:600">Pagamento</span><span>${o.payment}</span></div>
    <div style="text-align:center;margin-top:.85rem;padding-top:.85rem;border-top:1px dashed var(--border);font-size:.72rem;color:var(--ink3)">Pedido ${o.id} Â· ${new Date().toLocaleDateString('pt-BR')}<br>Obrigado pela preferÃªncia! ðŸ’›</div>
  </div>`;
}

// â”€â”€â”€ CLIENT STATUS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showCSNotif(status){
  const bar=document.getElementById('client-status-bar'); if(!bar) return;
  const waiting=document.getElementById('status-waiting');
  if(waiting) waiting.style.display='none';
  // Detecta se Ã© retirada pelo tipo de entrega do pedido atual
  const isPickup = _pedidoEntrega === 'pickup';
  if(status==='preparing'){
    bar.className='csb vis csb-prep';
    bar.innerHTML=`<span class="spinning" style="font-size:1.1rem">â³</span><div><div style="font-family:'Poppins',sans-serif;font-weight:700;font-size:.86rem;color:#3730A3">Pedido confirmado!</div><div style="font-size:.72rem;color:var(--ink3);margin-top:.1rem">Estamos preparando agora.</div></div>`;
    showNotif('Pedido confirmado!', 'Estamos preparando agora.');
  } else if (status === 'rejected') {
    bar.className='csb vis';
    bar.style.background='#FEF2F2'; bar.style.borderColor='#FECACA';
    bar.innerHTML=`<span style="font-size:1.1rem">âœ•</span><div><div style="font-family:'Poppins',sans-serif;font-weight:700;font-size:.86rem;color:#DC2626">Pedido recusado</div><div style="font-size:.72rem;color:var(--ink3);margin-top:.1rem">O estabelecimento nÃ£o pÃ´de aceitar seu pedido.</div></div>`;
    showNotif('âœ• Pedido recusado', 'O estabelecimento nÃ£o pÃ´de atender no momento.');
  } else {
    bar.className='csb vis csb-ready';
    const readyMsg = isPickup ? 'Pode vir retirar no estabelecimento.' : 'Seu pedido saiu para entrega.';
    const readyTitle = isPickup ? 'Pronto para retirada!' : 'Pedido a caminho!';
    bar.innerHTML=`<span style="font-size:1.1rem">âœ…</span><div><div style="font-family:'Poppins',sans-serif;font-weight:700;font-size:.86rem;color:var(--success)">${readyTitle}</div><div style="font-size:.72rem;color:var(--ink3);margin-top:.1rem">${readyMsg}</div></div>`;
    showNotif(readyTitle, readyMsg);
  }
}

