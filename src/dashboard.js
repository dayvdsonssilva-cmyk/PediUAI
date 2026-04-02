// â”€â”€â”€ DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function renderDashboard() {
  if (!currentUser) return;

  // Sincroniza dados do estabelecimento do Supabase (pega sempre a versÃ£o mais recente)
  const db = getSupa();
  if (db && currentUser.id?.includes('-')) {
    try {
      const { data: dadosSupa } = await db
        .from('estabelecimentos')
        .select('name, descricao, slug, emoji, color, logo_url, whatsapp, address, flash_items, prep_time, delivery_enabled, pickup_enabled, delivery_fee, is_open, horarios')
        .eq('id', currentUser.id)
        .single();
      if (dadosSupa) {
        // Atualiza dados locais com o que estÃ¡ no banco (respeita ediÃ§Ãµes de outros dispositivos)
        currentUser.name = dadosSupa.name || currentUser.name;
        currentUser.desc = dadosSupa.descricao || currentUser.desc;
        currentUser.slug = dadosSupa.slug || currentUser.slug;
        currentUser.emoji = dadosSupa.emoji || currentUser.emoji;
        currentUser.color = dadosSupa.color || currentUser.color;
        currentUser.logo = dadosSupa.logo_url || currentUser.logo;
        currentUser.whatsapp = dadosSupa.whatsapp || currentUser.whatsapp;
        currentUser.address = dadosSupa.address || currentUser.address;
        currentUser.prepTime = dadosSupa.prep_time || currentUser.prepTime || '30';
        if (dadosSupa.delivery_enabled !== undefined) currentUser.deliveryEnabled = dadosSupa.delivery_enabled;
        if (dadosSupa.pickup_enabled !== undefined) currentUser.pickupEnabled = dadosSupa.pickup_enabled;
        currentUser.deliveryFee = Number(dadosSupa.delivery_fee || 0);
        saveCurrentUser(); // persiste localmente
      }
    } catch(e) { console.warn('Sync Supabase erro:', e); }
  }

  const u = currentUser;
  document.getElementById('dash-sname').textContent = u.name;
  const slug = u.slug || 'demo';
  document.getElementById('dash-link').textContent = 'pediway.com.br/restaurante/' + slug;
  document.getElementById('st-items').textContent = (u.menuItems||[]).filter(i=>i.available).length;
  document.getElementById('st-plan').textContent = u.plan === 'ultra' ? 'Ultra' : 'BÃ¡sico';
  const isUltra = u.plan === 'ultra';
  const tbFin = document.getElementById('tb-fin');
  if (!isUltra) tbFin.classList.add('locked'); else tbFin.classList.remove('locked');
  document.getElementById('fin-lock-banner').style.display = isUltra ? 'none' : 'flex';
  document.getElementById('fin-content').style.display = isUltra ? 'block' : 'none';

  // Carrega pedidos do Supabase se a loja tem ID real (db jÃ¡ declarado acima)
  if (db && u.id && u.id.includes('-')) {
    try {
      const { data: pedidosSupa } = await db
        .from('orders').select('*')
        .eq('establishment_id', u.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (pedidosSupa && pedidosSupa.length > 0) {
        u.orders = pedidosSupa.map(p => ({
          supaId: p.id,
          id: '#' + String(++orderCounter).padStart(4,'0'),
          client: p.client_name, phone: p.client_phone,
          address: p.address, delivery: p.delivery_type,
          items: typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []),
          payment: p.payment_method, total: Number(p.total),
          status: p.status,
          time: formatarTempo(p.created_at), ts: new Date(p.created_at).getTime()
        }));
        saveCurrentUser();
      }
    } catch(e) { console.warn('Erro ao carregar pedidos:', e); }

    // Carrega itens do cardÃ¡pio do Supabase
    try {
      const { data: itensSupa } = await db
        .from('menu_items')
        .select('*')
        .eq('establishment_id', u.id)
        .order('category');
      if (itensSupa && itensSupa.length > 0) {
        u.menuItems = itensSupa.map(i => ({
          supaId: i.id, id: i.id,
          name: i.name, desc: i.descricao || '',
          price: Number(i.price), cat: i.category || 'Geral',
          emoji: i.emoji || 'ðŸ”', photo: i.photo_url || null,
          available: i.available
        }));
        saveCurrentUser();
      }
    } catch(e) { console.warn('Erro ao carregar cardÃ¡pio:', e); }
  }

  const orders = u.orders || [];
  const todayOrders = orders.filter(o => o.status !== 'done');
  document.getElementById('st-today').textContent = todayOrders.length;
  const rev = orders.reduce((s,o)=>s+o.total, 0);
  document.getElementById('st-rev').textContent = 'R$ ' + rev.toFixed(2).replace('.',',');

  // Abre na aba Pedidos por padrÃ£o
  switchTab('t-orders');
  carregarOpcoesEntrega();
  carregarTempo();
  carregarStatusLoja();
  carregarHorarios();
  renderMenuGrid(); renderOrdersList(); renderOverviewOrders(); renderFlashAdmin();
  updateStoreEmojiPicker();
  if (isUltra) renderFinanceiro('hoje');

  // Inicia escuta de novos pedidos â€” pequeno delay garante que Supabase estÃ¡ pronto
  setTimeout(iniciarRealtimePedidos, 500);
}

function formatarTempo(isoStr) {
  if (!isoStr) return 'agora';
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `hÃ¡ ${diff} min`;
  return `hÃ¡ ${Math.floor(diff/60)}h`;
}

function switchTab(id) {
  document.querySelectorAll('.tb').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tp').forEach(p=>p.classList.remove('active'));
  const panel = document.getElementById(id);
  if (panel) panel.classList.add('active');
  const tabs = ['t-orders','t-ov','t-menu','t-flash','t-financeiro','t-settings'];
  const btns = document.querySelectorAll('.tb');
  tabs.forEach((t,i)=>{if(btns[i]) btns[i].classList.toggle('active', t===id);});
}

function switchTabFin() {
  if (!currentUser) return;
  if (currentUser.plan !== 'ultra') {
    showNotif('Plano BÃ¡sico','Este recurso requer o Plano Ultra ðŸš€');
    return;
  }
  switchTab('t-financeiro');
}

// â”€â”€â”€ MENU ADMIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Sincroniza painel admin + vitrine cliente + tabs de categoria + contador
function _sincronizarCardapio() {
  renderMenuGrid();
  // Recalcula tabs de categorias
  const u = currentUser;
  const avail = (u?.menuItems || []).filter(i => i.available);
  const cats = ['Todos', ...new Set(avail.map(i => i.cat))];
  const catTabsEl = document.getElementById('cat-tabs');
  if (catTabsEl) {
    catTabsEl.innerHTML = cats.map((c, i) =>
      `<button class="cp ${i === 0 ? 'active' : ''}" onclick="filterCat('${c}',this)">${c}</button>`
    ).join('');
  }
  renderClientMenu('Todos');
  // Atualiza contador do painel
  const stItems = document.getElementById('st-items');
  if (stItems) stItems.textContent = avail.length;
}

function renderMenuGrid() {
  const items = (currentUser?.menuItems)||[];
  const grid = document.getElementById('menu-grid');
  if (!items.length) { grid.innerHTML = '<div class="es" style="grid-column:1/-1"><div class="ei">ðŸ½ï¸</div><p>Nenhum item ainda. Adicione o primeiro!</p></div>'; return; }
  grid.innerHTML = items.map((it,i) => `
    <div class="mc">
      <div class="mc-img">${it.photo?`<img src="${it.photo}" alt="">`:''}
        <span class="ef" style="${it.photo?'opacity:0':''}">${it.emoji}</span>
        <span class="mc-badge ${it.available?'av-y':'av-n'}">${it.available?'DisponÃ­vel':'Pausado'}</span>
      </div>
      <div class="mc-body">
        <div class="mc-cat">${it.cat}</div>
        <div class="mc-name">${it.name}</div>
        <div class="mc-desc">${it.desc}</div>
        <div class="mc-foot"><div class="mp">R$ ${it.price.toFixed(2).replace('.',',')}</div>
          <div class="macts">
            <button class="ib" onclick="toggleAvail(${i})">${it.available?'ðŸ‘':'ðŸš«'}</button>
            <button class="ib" onclick="editItem(${i})">âœï¸</button>
            <button class="ib d" onclick="delItem(${i})">ðŸ—‘</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}
function toggleAvail(i) {
  if(!currentUser) return;
  currentUser.menuItems[i].available = !currentUser.menuItems[i].available;
  saveCurrentUser();
  _sincronizarCardapio();
  const it = currentUser.menuItems[i];
  const idParaAtualizar = it.supaId || (String(it.id).includes('-') ? it.id : null);
  const db = getSupa();
  if (db) {
    const atualizar = {available: it.available};
    if (idParaAtualizar) {
      db.from('menu_items').update(atualizar).eq('id', idParaAtualizar)
        .then(({error}) => {
          if (!error) showNotif(it.available ? 'âœ… Item ativado' : 'ðŸš« Item pausado', it.name);
        });
    } else if (currentUser.id?.includes('-')) {
      db.from('menu_items').update(atualizar)
        .eq('establishment_id', currentUser.id).eq('name', it.name).then(()=>{});
    }
  }
}
function delItem(i) {
  if(!currentUser || !confirm('Remover este item do cardÃ¡pio?')) return;
  const it = currentUser.menuItems[i];
  const idParaDeletar = it.supaId || (String(it.id).includes('-') ? it.id : null);
  currentUser.menuItems.splice(i, 1);
  saveCurrentUser();
  _sincronizarCardapio();
  // Deleta no Supabase
  const db = getSupa();
  if (db) {
    if (idParaDeletar) {
      db.from('menu_items').delete().eq('id', idParaDeletar)
        .then(({error}) => {
          if (error) console.warn('Erro ao deletar item:', error.message);
          else showNotif('ðŸ—‘ Item removido', it.name + ' foi removido do cardÃ¡pio.');
        });
    } else if (currentUser.id?.includes('-')) {
      // Fallback: deleta pelo nome
      db.from('menu_items').delete()
        .eq('establishment_id', currentUser.id)
        .eq('name', it.name)
        .then(()=>{});
    }
  }
}

const allEmojis = ['ðŸ”','ðŸ•','ðŸŒ®','ðŸŒ¯','ðŸœ','ðŸ£','ðŸ—','ðŸ¥©','ðŸ§†','ðŸ¥—','ðŸ°','ðŸ§','ðŸ¦','ðŸ¥¤','ðŸ§ƒ','â˜•','ðŸŸ','ðŸ¥ª','ðŸ«•','ðŸ¥˜'];

function openAddItem() {
  editingItemIdx = null; selectedPhoto = null; selectedPhotos = []; selectedEmoji = 'ðŸ”';
  document.getElementById('modal-title').textContent = 'Adicionar item';
  ['i-name','i-desc','i-cat','i-price'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderPhotosGrid();
  buildItemEmojis(); openModal('modal-add');
}
function editItem(i) {
  editingItemIdx = i; const it = currentUser.menuItems[i];
  selectedPhoto = it.photo || null;
  selectedPhotos = Array.isArray(it.photos) && it.photos.length ? [...it.photos] : (it.photo ? [it.photo] : []);
  selectedEmoji = it.emoji;
  document.getElementById('modal-title').textContent = 'Editar item';
  document.getElementById('i-name').value = it.name;
  document.getElementById('i-desc').value = it.desc;
  document.getElementById('i-cat').value = it.cat;
  document.getElementById('i-price').value = it.price;
  renderPhotosGrid();
  buildItemEmojis(); openModal('modal-add');
}
function buildItemEmojis() {
  document.getElementById('item-ep').innerHTML = allEmojis.map(e=>`<button class="epb ${e===selectedEmoji?'sel':''}" onclick="selEmoji('${e}',this,'item-ep')">${e}</button>`).join('');
}
function selEmoji(e,btn,pickerId) {
  document.querySelectorAll(`#${pickerId} .epb`).forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel'); selectedEmoji = e;
}
// â”€â”€â”€ MÃšLTIPLAS FOTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function addPhotos(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const restante = 5 - selectedPhotos.length;
  if (restante <= 0) { showNotif('Limite atingido','MÃ¡ximo de 5 fotos por item.'); return; }
  files.slice(0, restante).forEach(file => {
    const r = new FileReader();
    r.onload = async e => {
      // Comprime cada foto antes de adicionar
      const compressed = await comprimirImagem(e.target.result, 800, 0.78);
      selectedPhotos.push(compressed);
      if (selectedPhotos.length === 1) selectedPhoto = compressed; // mantÃ©m compat
      renderPhotosGrid();
    };
    r.readAsDataURL(file);
  });
  input.value = '';
}

function removePhoto(idx) {
  selectedPhotos.splice(idx, 1);
  selectedPhoto = selectedPhotos[0] || null;
  renderPhotosGrid();
}

function renderPhotosGrid() {
  const grid = document.getElementById('photos-grid');
  const addBtn = document.getElementById('ph-add-btn');
  const count = document.getElementById('ph-count');
  if (!grid) return;

  grid.innerHTML = selectedPhotos.map((src, i) => `
    <div style="position:relative;border-radius:var(--rs);overflow:hidden;aspect-ratio:1;background:var(--surface);">
      <img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <button onclick="removePhoto(${i})" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">Ã—</button>
      ${i === 0 ? '<div style="position:absolute;bottom:3px;left:3px;background:var(--brand);color:#fff;font-size:.55rem;font-weight:700;padding:.1rem .3rem;border-radius:3px;">CAPA</div>' : ''}
    </div>`).join('');

  // Mostra/esconde botÃ£o de adicionar
  if (addBtn) addBtn.style.display = selectedPhotos.length >= 5 ? 'none' : '';
  if (count) {
    count.style.display = selectedPhotos.length > 0 ? '' : 'none';
    count.textContent = `${selectedPhotos.length}/5 foto${selectedPhotos.length !== 1 ? 's' : ''}`;
  }
}

function prevPhoto(input) {
  // legado â€” redireciona para addPhotos
  addPhotos(input);
}
async function saveItem() {
  const name = document.getElementById('i-name').value.trim();
  const price = parseFloat(document.getElementById('i-price').value);
  if(!name || !price) { alert('Preencha nome e preÃ§o'); return; }

  // Usa o array de fotos; primeira Ã© a capa
  const fotoFinal = selectedPhotos[0] || null;

  // Preserva o supaId do item sendo editado ANTES de substituir
  const supaIdAntigo = editingItemIdx !== null
    ? (currentUser.menuItems[editingItemIdx]?.supaId || currentUser.menuItems[editingItemIdx]?.id)
    : null;

  const it = {
    id: supaIdAntigo || Date.now(),
    supaId: supaIdAntigo || null,
    emoji: selectedEmoji,
    photo: fotoFinal,
    photos: [...selectedPhotos],
    name,
    desc: document.getElementById('i-desc').value,
    cat: document.getElementById('i-cat').value || 'Geral',
    price,
    available: true
  };

  if (!currentUser.menuItems) currentUser.menuItems = [];
  if (editingItemIdx !== null) currentUser.menuItems[editingItemIdx] = it;
  else currentUser.menuItems.push(it);

  saveCurrentUser();
  closeModal('modal-add');
  _sincronizarCardapio();

  // Garante UUID real do Supabase
  const db = getSupa();
  if (db && currentUser.email && !currentUser.id?.includes('-')) {
    const { data: estab } = await db.from('estabelecimentos').select('id').eq('email', currentUser.email).maybeSingle();
    if (estab) { currentUser.id = estab.id; saveCurrentUser(); }
  }

  if (db && currentUser.id?.includes('-')) {
    try {
      const supaItem = {
        establishment_id: currentUser.id,
        name: it.name,
        price: it.price,
        category: it.cat,
        emoji: it.emoji,
        photo_url: fotoFinal || null,
        photos: selectedPhotos.length ? JSON.stringify(selectedPhotos) : '[]',
        available: true,
        descricao: it.desc || ''
      };

      if (supaIdAntigo && String(supaIdAntigo).includes('-')) {
        const { error } = await db.from('menu_items').update(supaItem).eq('id', supaIdAntigo);
        if (error) console.warn('Erro ao editar item:', error.message);
        else showNotif('âœ… Item atualizado!', it.name + ' foi atualizado no cardÃ¡pio.');
      } else {
        const { data, error } = await db.from('menu_items').insert(supaItem).select().single();
        if (error) console.warn('Erro ao inserir item:', error.message);
        else if (data) {
          const idx = editingItemIdx !== null ? editingItemIdx : currentUser.menuItems.length - 1;
          currentUser.menuItems[idx].supaId = data.id;
          currentUser.menuItems[idx].id = data.id;
          saveCurrentUser();
          showNotif('âœ… Item adicionado!', it.name + ' estÃ¡ no cardÃ¡pio.');
        }
      }
    } catch(e) { console.warn('Erro saveItem:', e); }
  }
}

// Comprime imagem base64 para reduzir tamanho antes de salvar no Supabase
function comprimirImagem(base64, maxWidth, qualidade) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => resolve(base64); // fallback sem compressÃ£o
    img.src = base64;
  });
}

// â”€â”€â”€ FLASH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderFlashAdmin() {
  const items = currentUser?.flashItems||[];
  const grid = document.getElementById('flash-admin-grid');
  grid.innerHTML = items.map((f,i)=>`<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r);overflow:hidden">
    <div style="width:100%;height:85px;background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-size:2rem;position:relative;overflow:hidden">
      ${f.url?(f.type==='video'?`<video src="${f.url}" muted style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"></video>`:`<img src="${f.url}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`): `<span>${f.emoji}</span>`}</div>
    <div style="padding:.5rem"><button onclick="delFlash(${i})" style="float:right;background:none;border:none;cursor:pointer;font-size:.8rem;color:var(--ink3)">ðŸ—‘</button><div style="font-size:.72rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.title}</div><div style="font-size:.66rem;color:var(--ink3)">â± 4h restantes</div></div>
  </div>`).join('');
}
async function addFlash(input) {
  const file = input.files[0]; if(!file) return;
  if (!file.type.startsWith('image/')) { alert('Apenas imagens sÃ£o suportadas.'); return; }
  const r = new FileReader();
  r.onload = async (e) => {
    let url = e.target.result;
    // Comprime imagem
    url = await comprimirImagem(url, 1200, 0.82);
    const item = {
      id: Date.now(),
      type: 'image',
      emoji: 'âœ¨',
      title: '', // sem tÃ­tulo â€” layout limpo
      url,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000
    };
    if(!currentUser.flashItems) currentUser.flashItems = [];
    currentUser.flashItems.push(item);
    saveCurrentUser();
    renderFlashAdmin();
    // Se cliente estiver vendo a vitrine, atualiza o fresquinho lÃ¡ tambÃ©m
    if (document.getElementById('s-store')?.classList.contains('active')) {
      renderFlashClient();
    }
    // Salva no Supabase para aparecer em outros celulares
    await salvarFlashNoSupabase();
  };
  r.readAsDataURL(file);
}

function delFlash(i) {
  if(!currentUser) return;
  currentUser.flashItems.splice(i,1);
  saveCurrentUser();
  renderFlashAdmin();
  salvarFlashNoSupabase();
}

async function salvarFlashNoSupabase() {
  const db = getSupa();
  if (!db || !currentUser?.id?.includes('-')) return;
  try {
    // Filtra apenas os nÃ£o expirados
    const ativos = (currentUser.flashItems||[]).filter(f => !f.expiresAt || f.expiresAt > Date.now());
    // Salva sem o campo url para vÃ­deos (muito grande) â€” sÃ³ imagens
    const paraSubir = ativos.map(f => ({
      id: f.id, type: f.type, emoji: f.emoji,
      title: f.title, expiresAt: f.expiresAt,
      url: f.type === 'image' ? f.url : null // vÃ­deos ficam sÃ³ localmente
    }));
    await db.from('estabelecimentos')
      .update({ flash_items: JSON.stringify(paraSubir) })
      .eq('id', currentUser.id);
  } catch(e) { console.warn('Erro ao salvar fresquinho:', e); }
}


// â”€â”€â”€ FINANCEIRO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setPeriod(p,btn){document.querySelectorAll('.pb').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderFinanceiro(p);}
function renderFinanceiro(period) {
  const lbls={hoje:'Hoje',semana:'Esta semana',mes:'Este mÃªs','90':'90 dias'};
  const el=document.getElementById('fin-period-lbl'); if(el) el.textContent=lbls[period]||'Hoje';
  const orders=currentUser?.orders||[];
  const mul=period==='hoje'?1:period==='semana'?7:period==='mes'?30:90;
  const all=[...orders];
  for(let d=1;d<mul;d++) all.push(...orders.map(o=>({...o,id:o.id+'d'+d,time:`hÃ¡ ${d}d`})));
  const total=all.reduce((s,o)=>s+o.total,0), count=all.length, avg=count?total/count:0;
  const sf=document.getElementById('fin-stats');
  if(sf) sf.innerHTML=`<div class="sc"><div class="sc-lbl">Pedidos</div><div class="sc-val o">${count}</div></div><div class="sc"><div class="sc-lbl">Faturamento</div><div class="sc-val g">R$ ${total.toFixed(2).replace('.',',')}</div></div><div class="sc"><div class="sc-lbl">Ticket mÃ©dio</div><div class="sc-val">R$ ${avg.toFixed(2).replace('.',',')}</div></div><div class="sc"><div class="sc-lbl">Mais usado</div><div class="sc-val" style="font-size:.95rem">Pix</div></div>`;
  const fb=document.getElementById('fin-body');
  if(fb) fb.innerHTML=all.slice(0,20).map(o=>`<tr><td>${o.time}</td><td>${o.id}</td><td>${o.client}</td><td>${o.payment}</td><td style="color:var(--success);font-weight:700">R$ ${o.total.toFixed(2).replace('.',',')}</td></tr>`).join('');
  const cm={};
  all.forEach(o=>o.items.forEach(it=>{const cat=(currentUser?.menuItems||[]).find(m=>m.name===it.name)?.cat||'Outros';if(!cm[cat]) cm[cat]={qty:0,total:0};cm[cat].qty+=it.qty;cm[cat].total+=it.qty*it.price;}));
  const cb=document.getElementById('fin-cat');
  if(cb) cb.innerHTML=Object.entries(cm).sort((a,b)=>b[1].total-a[1].total).map(([cat,d])=>`<tr><td>${cat}</td><td>${d.qty}</td><td style="color:var(--success);font-weight:700">R$ ${d.total.toFixed(2).replace('.',',')}</td></tr>`).join('');
}

// â”€â”€â”€ SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateSettingsLogo(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    openCropModal(e.target.result, 'Ajustar logo da loja', true, (cropped) => {
      if (currentUser) {
        currentUser.logo = cropped; saveCurrentUser();
        // Salva no Supabase (base64 â€” funciona para logos pequenas)
        const db=getSupa();
        if(db && currentUser.id?.includes('-')) {
          db.from('estabelecimentos').update({logo_url: cropped}).eq('id',currentUser.id).then(()=>{});
        }
      }
      const img = document.getElementById('settings-logo-img');
      const emoji = document.getElementById('settings-logo-emoji');
      if (img) { img.src = cropped; img.style.display = 'block'; }
      if (emoji) emoji.style.display = 'none';
      showNotif('âœ… Logo atualizada!', 'Aparece no cardÃ¡pio dos seus clientes.');
    });
  };
  r.readAsDataURL(file);
}


// â”€â”€â”€ OPÃ‡Ã•ES DE ENTREGA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function selecionarTempo(btn) {
  document.querySelectorAll('.tempo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const val = btn.dataset.val;
  if (!currentUser) return;
  currentUser.prepTime = val;
  saveCurrentUser();
  // Salva no Supabase
  const db = getSupa();
  if (db && currentUser.id?.includes('-')) {
    db.from('estabelecimentos').update({ prep_time: val }).eq('id', currentUser.id).then(()=>{});
  }
  // Atualiza pill no cardÃ¡pio se estiver aberto
  atualizarPillsCardapio();
}

function carregarTempo() {
  const val = currentUser?.prepTime || '30';
  document.querySelectorAll('.tempo-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === String(val));
  });
}

function salvarOpcaoEntrega() {
  const temEntrega = document.getElementById('toggle-delivery')?.checked ?? true;
  const temRetirada = document.getElementById('toggle-pickup')?.checked ?? true;
  const taxa = parseFloat(document.getElementById('taxa-entrega')?.value || 0) || 0;
  atualizarToggle('toggle-delivery', 'thumb-delivery', 'ball-delivery');
  atualizarToggle('toggle-pickup', 'thumb-pickup', 'ball-pickup');
  const taxaBlock = document.getElementById('taxa-entrega-block');
  if (taxaBlock) taxaBlock.style.display = temEntrega ? 'block' : 'none';
  if (!currentUser) return;
  currentUser.deliveryEnabled = temEntrega;
  currentUser.pickupEnabled = temRetirada;
  currentUser.deliveryFee = taxa;
  saveCurrentUser();
  const db = getSupa();
  if (db && currentUser.id?.includes('-')) {
    db.from('estabelecimentos').update({
      delivery_enabled: temEntrega,
      pickup_enabled: temRetirada,
      delivery_fee: taxa
    }).eq('id', currentUser.id).then(({ error }) => {
      if (!error) showNotif('âœ… Salvo!', 'OpÃ§Ãµes de entrega atualizadas no cardÃ¡pio.');
    });
  }
  // Atualiza pills imediatamente no cardÃ¡pio (se estiver aberto)
  atualizarPillsCardapio();
}

function atualizarPillsCardapio() {
  if (!currentUser) return;
  const temDel = currentUser.deliveryEnabled !== false;
  const temPick = currentUser.pickupEnabled !== false;
  const pillEntrega = document.getElementById('pill-entrega');
  if (pillEntrega) {
    if (temDel && temPick) pillEntrega.textContent = 'ðŸ“ Entrega e Retirada';
    else if (temDel) pillEntrega.textContent = 'ðŸ“ Entrega';
    else if (temPick) pillEntrega.textContent = 'ðŸ“ Retirada no local';
    else pillEntrega.style.display = 'none';
  }
  // Atualiza pill de tempo
  const pillTempo = document.getElementById('pill-tempo');
  if (pillTempo) pillTempo.textContent = 'â± ' + (currentUser.prepTime || '30') + ' min';
}

function atualizarToggle(checkId, thumbId, ballId) {
  const chk = document.getElementById(checkId);
  const thumb = document.getElementById(thumbId);
  const ball = document.getElementById(ballId);
  if (!chk || !thumb) return;
  const on = chk.checked;
  thumb.style.background = on ? 'var(--brand)' : '#ccc';
  if (ball) ball.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
}

function carregarOpcoesEntrega() {
  const u = currentUser;
  if (!u) return;
  const chkDel = document.getElementById('toggle-delivery');
  const chkPick = document.getElementById('toggle-pickup');
  const taxaEl = document.getElementById('taxa-entrega');
  if (chkDel) chkDel.checked = u.deliveryEnabled !== false;
  if (chkPick) chkPick.checked = u.pickupEnabled !== false;
  if (taxaEl) taxaEl.value = u.deliveryFee || '';
  atualizarToggle('toggle-delivery', 'thumb-delivery', 'ball-delivery');
  atualizarToggle('toggle-pickup', 'thumb-pickup', 'ball-pickup');
  const taxaBlock = document.getElementById('taxa-entrega-block');
  if (taxaBlock) taxaBlock.style.display = (u.deliveryEnabled !== false) ? 'block' : 'none';
}

async function saveSettings() {
  if(!currentUser) return;
  const novoNome = document.getElementById('s-name').value.trim();
  const novoSlug = gerarSlug(novoNome);
  currentUser.name = novoNome;
  currentUser.desc = document.getElementById('s-desc').value;
  currentUser.welcome = document.getElementById('s-wel').value;
  currentUser.whatsapp = wppParaSalvar(document.getElementById('s-wp').value);
  currentUser.address = document.getElementById('s-addr')?.value || '';
  // Atualiza slug se o nome mudou
  if (novoSlug && novoSlug !== currentUser.slug) {
    currentUser.slug = novoSlug;
    // Atualiza link exibido
    const linkEl = document.getElementById('dash-link');
    if (linkEl) linkEl.textContent = 'pediway.com.br/restaurante/' + novoSlug;
  }
  saveCurrentUser();

  // Sincroniza com Supabase
  const db = getSupa();
  if (db && currentUser.id?.includes('-')) {
    try {
      await db.from('estabelecimentos').update({
        name: currentUser.name,
        descricao: currentUser.desc || '',
        whatsapp: currentUser.whatsapp || '',
        slug: currentUser.slug,
        emoji: currentUser.emoji || 'ðŸ”',
        color: currentUser.color || '#E8410A',
        logo_url: currentUser.logo || null,
        address: currentUser.address || ''
      }).eq('id', currentUser.id);
      // Se o slug mudou, o link antigo automaticamente nÃ£o funciona mais
      // pois o Supabase sÃ³ retorna lojas com o slug atual
      showNotif('âœ… Salvo!', 'ConfiguraÃ§Ãµes atualizadas! Link do cardÃ¡pio atualizado.');
    } catch(e) {
      console.warn('Erro ao salvar settings:', e);
      showNotif('âœ… Salvo localmente', 'Erro ao sincronizar â€” tente novamente.');
    }
  } else {
    showNotif('âœ… Salvo!', 'ConfiguraÃ§Ãµes atualizadas.');
  }
}
function selColor(c,cd,el,grad){
  document.querySelectorAll('.csw').forEach(s=>s.classList.remove('selected')); el.classList.add('selected');
  const corFinal = grad || c;
  document.documentElement.style.setProperty('--brand', c);
  document.documentElement.style.setProperty('--brand-dark', cd);
  // Aplica gradiente no hero do cardÃ¡pio
  const heroBg = document.getElementById('s-hero-bg');
  if (heroBg) heroBg.style.background = corFinal;
  if(currentUser){
    currentUser.color = c;
    currentUser.colorGrad = corFinal;
    saveCurrentUser();
    const db=getSupa();
    if(db && currentUser.id?.includes('-')) db.from('estabelecimentos').update({color:c}).eq('id',currentUser.id).then(()=>{});
  }
}
const storeEmojis=['ðŸ”','ðŸ•','ðŸŒ®','ðŸœ','ðŸ£','ðŸ—','ðŸ¥©','ðŸ§†','ðŸ¥—','ðŸ°','ðŸ§','ðŸ¦','ðŸ©','ðŸ¥','â˜•','ðŸº','ðŸ¥˜','ðŸ±','ðŸŽ‚','ðŸª','â­','ðŸŒ¶'];
function updateStoreEmojiPicker(){
  const ep=document.getElementById('store-ep'); if(!ep) return;
  ep.innerHTML=storeEmojis.map(e=>`<button class="epb ${e===(currentUser?.emoji||'ðŸ”')?'sel':''}" onclick="selStoreEmoji('${e}',this)">${e}</button>`).join('');
  if(currentUser){
    document.getElementById('s-name').value=currentUser.name||'';
    document.getElementById('s-desc').value=currentUser.desc||'';
    document.getElementById('s-wel').value=currentUser.welcome||'';
    // Formata WhatsApp para exibiÃ§Ã£o: remove 55 e formata
    const wpRaw = currentUser.whatsapp || '';
    const wpDigits = wpRaw.startsWith('55') ? wpRaw.slice(2) : wpRaw;
    const wpFmt = wpDigits.length <= 10
      ? wpDigits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
      : wpDigits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    document.getElementById('s-wp').value = wpFmt;
    const saddrEl = document.getElementById('s-addr');
    carregarOpcoesEntrega();
    carregarTempo();
    if (saddrEl) saddrEl.value = currentUser.address || '';
    // Load logo preview in settings
    const img = document.getElementById('settings-logo-img');
    const emoji = document.getElementById('settings-logo-emoji');
    if (currentUser.logo && img) {
      img.src = currentUser.logo; img.style.display = 'block';
      if (emoji) emoji.style.display = 'none';
    } else {
      if (img) img.style.display = 'none';
      if (emoji) { emoji.style.display = 'block'; emoji.textContent = currentUser.emoji || 'ðŸª'; }
    }
  }
}
function selStoreEmoji(e,btn){
  document.querySelectorAll('#store-ep .epb').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  if(currentUser){
    currentUser.emoji=e; saveCurrentUser();
    const db=getSupa();
    if(db && currentUser.id?.includes('-')) db.from('estabelecimentos').update({emoji:e}).eq('id',currentUser.id).then(()=>{});
    // Atualiza emoji no hero do cardÃ¡pio se estiver aberto
    const seEl = document.getElementById('se');
    if (seEl && !currentUser.logo) seEl.textContent = e;
    // Atualiza o emoji exibido no nome do estabelecimento no carrinho
    const storeEmojiSpan = document.getElementById('cart-store-emoji');
    if (storeEmojiSpan) storeEmojiSpan.textContent = e;
  }
}

// â”€â”€â”€ CEO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function doCeoLogin(){
  const e=document.getElementById('ceo-email').value.trim();
  const p=document.getElementById('ceo-pass').value;
  const err=document.getElementById('ceo-err');
  // Credenciais CEO â€” acesso exclusivo do proprietÃ¡rio da plataforma
  if(e==='admin@pediway.com.br'&&p==='Pdw@Master2025!'){
    err.style.display='none';
    goTo('s-ceo');
    renderCeo();
  } else {
    err.style.display='block';
    // Shake animation
    const lc=document.querySelector('.ceo-lc');
    if(lc){lc.style.animation='none';lc.offsetHeight;lc.style.animation='shake .4s ease';}
  }
}

function switchCeoTab(id){
  document.querySelectorAll('.ct2').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('[id^="ceo-"]:not(#s-ceo):not(.ceo-card):not(#ceo-store-detail)').forEach(el=>{if(el.classList.contains('tp')) el.classList.remove('active');});
  document.querySelector(`.ct2[onclick="switchCeoTab('${id}')"]`)?.classList.add('active');
  const panel=document.getElementById(id); if(panel) panel.classList.add('active');
}

// â”€â”€â”€ CEO HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function togglePw(i) {
  const mask = document.getElementById('pw-mask-'+i);
  const show = document.getElementById('pw-show-'+i);
  if (!mask || !show) return;
  const visible = show.style.display !== 'none';
  mask.style.display = visible ? 'inline' : 'none';
  show.style.display = visible ? 'none' : 'inline';
}

function filterCeoStores(query) {
  const q = (query||'').toLowerCase().trim();
  const rows = document.querySelectorAll('#ceo-all-body tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}

function renderCeo(){
  // Guarda a aba atual para nÃ£o resetar apÃ³s aÃ§Ãµes
  const abaAtiva = document.querySelector('.ct2.active')?.getAttribute('onclick')?.match(/'([\w-]+)'/)?.[1] || 'ceo-dashboard';
  const todos=getUsers();
  const users=todos.filter(u=>u.id!=='demo'); // demo nÃ£o aparece como cliente real
  const solics=getSolicitations();
  const active=users.filter(u=>u.status==='active').length;
  const inactive=users.filter(u=>u.status==='inactive').length;
  const pending=solics.length;
  const mrr=users.filter(u=>u.status==='active').reduce((s,u)=>s+99.90, 0); // todos ultra por ora
  document.getElementById('ceo-stat-ativos').textContent=active;
  document.getElementById('ceo-stat-pend').textContent=pending;
  // Total geral
  const totalEl = document.getElementById('ceo-stat-total');
  if (totalEl) totalEl.textContent = users.length;
  document.getElementById('ceo-stat-mrr').textContent='R$ '+mrr.toFixed(2).replace('.',',');
  document.getElementById('solic-badge').textContent=pending;
  document.getElementById('ceo-mrr2').textContent='R$ '+mrr.toFixed(2).replace('.',',');
  document.getElementById('ceo-total-rev').textContent='R$ '+(mrr*12).toFixed(2).replace('.',',');
  document.getElementById('ceo-ticket').textContent='R$ '+(mrr/(active||1)).toFixed(2).replace('.',',');

  // Recent table
  const rb=document.getElementById('ceo-recent');
  if(rb) rb.innerHTML=users.slice(0,5).map((u,i)=>`<tr style="cursor:pointer" onclick="viewCeoStore(${i})">
    <td style="color:#fff;font-weight:600">${u.name}</td>
    <td><span style="background:${u.plan==='ultra'?'rgba(124,58,237,.2)':'rgba(232,65,10,.15)'};color:${u.plan==='ultra'?'#a78bfa':'var(--brand)'};padding:.1rem .4rem;border-radius:4px;font-size:.65rem;font-weight:700">${u.plan==='ultra'?'Ultra':'BÃ¡sico'}</span></td>
    <td>${u.dueDate||'â€”'}</td>
    <td>${u.status==='active'?'<span class="b-act">Ativo</span>':u.status==='pending'?'<span class="b-pend">Pendente</span>':'<span class="b-inact">Inativo</span>'}</td>
    <td><button onclick="event.stopPropagation();ceoToggleStoreByIdx(${i})" style="background:${u.status==='active'?'rgba(239,68,68,.1)':'rgba(74,222,128,.1)'};color:${u.status==='active'?'#f87171':'#4ade80'};border:1px solid ${u.status==='active'?'rgba(239,68,68,.2)':'rgba(74,222,128,.2)'};border-radius:6px;padding:.18rem .5rem;font-size:.68rem;font-weight:700;cursor:pointer;font-family:'Poppins',sans-serif">${u.status==='active'?'Desativar':'Ativar'}</button></td>
  </tr>`).join('');

  // All stores table
  const ab=document.getElementById('ceo-all-body');
  if(ab) ab.innerHTML=users.map((u,i)=>`<tr>
    <td style="cursor:pointer;color:#fff;font-weight:600;white-space:nowrap" onclick="viewCeoStore(${i})">${u.name}</td>
    <td style="font-size:.7rem;color:rgba(255,255,255,.6)">${u.email}</td>
    <td>
      <span id="pw-mask-${i}" style="letter-spacing:.08em;font-size:.72rem;color:rgba(255,255,255,.4)">â€¢â€¢â€¢â€¢â€¢â€¢</span>
      <span id="pw-show-${i}" style="display:none;font-size:.72rem;color:#fbbf24;font-weight:700">${u.pass||'â€”'}</span>
      <button onclick="togglePw(${i})" style="background:none;border:none;cursor:pointer;font-size:.75rem;margin-left:.3rem;color:rgba(255,255,255,.35);padding:0" title="Mostrar/ocultar senha">ðŸ‘</button>
    </td>
    <td><span style="background:${u.plan==='ultra'?'rgba(124,58,237,.2)':'rgba(232,65,10,.15)'};color:${u.plan==='ultra'?'#a78bfa':'var(--brand)'};padding:.1rem .4rem;border-radius:4px;font-size:.65rem;font-weight:700">${u.plan==='ultra'?'Ultra':'BÃ¡sico'}</span></td>
    <td style="font-size:.7rem;color:rgba(255,255,255,.5)">${u.dueDate||'â€”'}</td>
    <td>${u.status==='active'?'<span class="b-act">Ativo</span>':u.status==='pending'?'<span class="b-pend">Pendente</span>':'<span class="b-inact">Inativo</span>'}</td>
    <td style="white-space:nowrap"><button onclick="ceoToggleStoreByIdx(${i})" style="background:${u.status==='active'?'rgba(239,68,68,.1)':'rgba(74,222,128,.1)'};color:${u.status==='active'?'#f87171':'#4ade80'};border:1px solid ${u.status==='active'?'rgba(239,68,68,.2)':'rgba(74,222,128,.2)'};border-radius:6px;padding:.18rem .5rem;font-size:.68rem;font-weight:700;cursor:pointer;font-family:'Poppins',sans-serif">${u.status==='active'?'Desativar':'Ativar'} <span class="ai-badge">ðŸ¤–</span></button></td>
  </tr>`).join('');

  // Solicitations
  const sb=document.getElementById('ceo-solic-body');
  if(sb) sb.innerHTML=solics.map((s,i)=>`<tr>
    <td style="color:#fff;font-weight:600">${s.name}</td><td>${s.doc||'â€”'}</td><td>${s.email}</td>
    <td><span style="background:${s.plan==='ultra'?'rgba(124,58,237,.2)':'rgba(232,65,10,.15)'};color:${s.plan==='ultra'?'#a78bfa':'var(--brand)'};padding:.1rem .4rem;border-radius:4px;font-size:.65rem;font-weight:700">${s.plan==='ultra'?'Ultra':'BÃ¡sico'}</span></td>
    <td><span class="b-pend">MP Pendente</span></td>
    <td>${s.submittedAt||'â€”'}</td>
    <td style="display:flex;gap:.35rem">
      <button onclick="approveSolic(${i})" style="background:rgba(74,222,128,.13);color:#4ade80;border:1px solid rgba(74,222,128,.25);border-radius:6px;padding:.18rem .5rem;font-size:.68rem;font-weight:700;cursor:pointer;font-family:'Poppins',sans-serif">âœ… Aprovar</button>
      <button onclick="rejectSolic(${i})" style="background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:.18rem .5rem;font-size:.68rem;font-weight:700;cursor:pointer;font-family:'Poppins',sans-serif">âŒ Reprovar</button>
    </td>
  </tr>`).join('');

  // Financeiro CEO
  const ch=document.getElementById('ceo-hist');
  const mesAtual=new Date().toLocaleString('pt-BR',{month:'long',year:'numeric'});
  if(ch) ch.innerHTML=mrr>0
    ?`<tr><td style="text-transform:capitalize">${mesAtual}</td><td>${users.filter(u=>u.status==='active'&&u.plan!=='ultra').length}</td><td>${users.filter(u=>u.status==='active'&&u.plan==='ultra').length}</td><td style="color:#4ade80;font-weight:700">R$ ${mrr.toFixed(2).replace('.',',')}</td></tr>`
    :'<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,.3);padding:.9rem">Nenhuma receita ainda</td></tr>';
  // Restaura aba que estava ativa antes de re-renderizar
  switchCeoTab(abaAtiva);
}

function viewCeoStore(i){
  const users=getUsers(); const u=users[i]; if(!u) return;
  ceoCurrentStoreIdx=i;
  const det=document.getElementById('ceo-store-detail');
  det.style.display='block';
  document.getElementById('csd-name').textContent=u.name;
  document.getElementById('csd-link').textContent='pediway.com.br/restaurante/'+u.slug;
  document.getElementById('csd-act-btn').textContent=u.status==='active'?'Desativar loja':'Ativar loja';
  const items=u.menuItems||[];
  document.getElementById('csd-items').innerHTML=items.length?items.map((it,j)=>`<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem;background:rgba(255,255,255,.04);border-radius:var(--rs)">
    <span style="font-size:1.2rem">${it.emoji}</span>
    <div style="flex:1"><div style="font-size:.8rem;font-weight:600;color:#fff">${it.name}</div><div style="font-size:.7rem;color:rgba(255,255,255,.4)">R$ ${it.price.toFixed(2).replace('.',',')} Â· ${it.cat}</div></div>
    <span style="font-size:.68rem;background:${it.available?'rgba(74,222,128,.13)':'rgba(239,68,68,.1)'};color:${it.available?'#4ade80':'#f87171'};padding:.12rem .42rem;border-radius:100px;font-weight:700">${it.available?'Ativo':'Pausado'}</span>
  </div>`).join(''):'<div style="font-size:.78rem;color:rgba(255,255,255,.35);padding:.5rem">Nenhum item no cardÃ¡pio ainda.</div>';
  det.scrollIntoView({behavior:'smooth'});
}

function ceoToggleStore(){
  if(ceoCurrentStoreIdx===null) return;
  ceoToggleStoreByIdx(ceoCurrentStoreIdx);
}

async function ceoToggleStoreByIdx(i){
  const users=getUsers(); const u=users[i]; if(!u) return;
  u.status=u.status==='active'?'inactive':'active';
  const action=u.status==='active'?'ativada':'desativada';
  setUsers(users);
  // Atualiza no Supabase
  const db = getSupa();
  if (db && u.id && u.id.includes('-')) {
    db.from('estabelecimentos').update({status: u.status}).eq('id', u.id).then(({error}) => {
      if (error) console.warn('Erro toggle status:', error.message);
    });
  }
  showNotif(u.status==='active'?'âœ… Loja ativada!':'ðŸ”’ Loja desativada', `"${u.name}" foi ${action}.`);
  renderCeo();
  if(ceoCurrentStoreIdx===i) viewCeoStore(i);
}

function ceoEditStore(){
  if(ceoCurrentStoreIdx===null) return;
  const users=getUsers(); const u=users[ceoCurrentStoreIdx];
  currentUser=u; currentStoreSlug=u.slug;
  goTo('s-dash'); switchTab('t-menu');
}

async function approveSolic(i){
  const solics=getSolicitations(); const s=solics.splice(i,1)[0];
  const users=getUsers();
  s.status='active';
  s.plan='ultra';
  s.id=s.id||Date.now().toString();
  s.dueDate=new Date(Date.now()+30*24*60*60*1000).toLocaleDateString('pt-BR');
  if(!users.find(u=>u.email===s.email)) users.push(s);
  else { const idx=users.findIndex(u=>u.email===s.email); users[idx]=s; }
  setUsers(users); setSolicitations(solics);

  // Salva no Supabase para que o link funcione em qualquer celular
  const db = getSupa();
  if (db) {
    try {
      const slug = gerarSlug(s.name);
      // Verifica se jÃ¡ existe
      const { data: existing } = await db.from('estabelecimentos').select('id').eq('email', s.email).maybeSingle();
      if (existing) {
        await db.from('estabelecimentos').update({ status: 'active', slug }).eq('email', s.email);
      } else {
        await db.from('estabelecimentos').insert({
          name: s.name, doc: s.doc||'', email: s.email,
          pass: s.pass, password_plain: s.pass,
          whatsapp: s.whatsapp||'', descricao: s.desc||'',
          slug, emoji: s.emoji||'ðŸ”', color: s.color||'#E8410A',
          plan_type: 'ultra', status: 'active',
          logo_url: s.logo||null, created_at: new Date().toISOString()
        });
      }
      showNotif('âœ… Aprovado!', s.name+' estÃ¡ ativo â€” link funcionando!');
    } catch(e) {
      console.warn('Erro ao salvar no Supabase:', e);
      showNotif('âœ… Aprovado!', s.name+' ativo localmente.');
    }
  } else {
    showNotif('âœ… Aprovado!', s.name+' agora estÃ¡ ativo â€” plano completo.');
  }
  renderCeo();
}

function rejectSolic(i){
  if(!confirm('Reprovar esta solicitaÃ§Ã£o?')) return;
  const solics=getSolicitations(); solics.splice(i,1); setSolicitations(solics);
  showNotif('âŒ Reprovado','SolicitaÃ§Ã£o removida.'); renderCeo();
}

