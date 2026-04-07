// src/dashboard.js
import { showToast } from './utils.js';
import { getSupa } from './supabase.js';

const BASE = 'https://pediway.vercel.app';
const EMOJIS = ['🍔','🍕','🌮','🥪','🍜','🥗','🍗','🥩','🫕','🥘',
                 '🍱','🧆','🍣','🍦','🧁','🎂','🥤','🧃','☕','🧋',
                 '🍺','🍷','🥂','🫖','🍹','🔥','⭐','💎','🎯','🏆'];

let emojiSel = '🍔';
let fotoFile = null;
let logoFile = null;

function getEstab() {
  return window._estab || JSON.parse(localStorage.getItem('pw_estab')||'null');
}

// ============================================================
// INIT
// ============================================================
export async function initDashboard() {
  const estab = getEstab();
  if (!estab) return;

  // Preenche header
  document.getElementById('dash-store-name').textContent = estab.nome;
  const linkEl = document.getElementById('link-url');
  if (linkEl) linkEl.textContent = `${BASE}/${estab.slug}`;

  // Preenche config
  const cfgNome  = document.getElementById('cfg-nome');
  const cfgSlug  = document.getElementById('cfg-slug');
  const cfgWhats = document.getElementById('cfg-whats');
  const cfgDesc  = document.getElementById('cfg-desc');
  const cfgLink  = document.getElementById('cfg-link-preview');
  if (cfgNome)  cfgNome.value  = estab.nome;
  if (cfgSlug)  cfgSlug.value  = estab.slug;
  if (cfgWhats) cfgWhats.value = estab.whatsapp||'';
  if (cfgDesc)  cfgDesc.value  = estab.descricao||'';
  if (cfgLink)  cfgLink.textContent = `${BASE}/${estab.slug}`;

  // Logo preview
  if (estab.logo_url) {
    const prev = document.getElementById('logo-preview-img');
    if (prev) { prev.src=estab.logo_url; prev.style.display='block'; }
    const placeholder = document.getElementById('logo-placeholder-text');
    if (placeholder) placeholder.style.display='none';
  }

  await renderCardapio();
  await renderFresquinho();
  await renderPedidos();
  renderEmojiGrid();
}

// ============================================================
// CARDÁPIO
// ============================================================
async function renderCardapio() {
  const estab=getEstab(); if (!estab) return;
  const grid=document.getElementById('cardapio-grid');
  const statItens=document.getElementById('stat-itens');

  const {data}=await getSupa().from('produtos').select('*')
    .eq('estabelecimento_id',estab.id).order('created_at',{ascending:false});

  if (statItens) statItens.textContent=data?.length||0;
  if (!grid) return;

  if (!data?.length) {
    grid.innerHTML=`<div class="empty-state-light" style="grid-column:1/-1">
      <span>🍽️</span><p>Nenhum item ainda.<br>Adicione seu primeiro produto!</p></div>`;
    return;
  }

  grid.innerHTML=data.map(p=>`
    <div class="item-card">
      <div class="item-card-img">
        ${p.foto_url
          ?`<img class="item-img" src="${p.foto_url}" alt="${p.nome}">`
          :`<div class="item-emoji-bg">${p.emoji||'🍔'}</div>`}
        <span class="item-disponivel">${p.disponivel?'Disponível':'Indisponível'}</span>
        ${p.promocao?`<span class="item-promo-badge">🔥 Promoção</span>`:''}
      </div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria||'SEM CATEGORIA'}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-desc-text">${p.descricao||''}</div>
        <div class="item-footer">
          <div>
            ${p.promocao&&p.preco_original?`<div class="item-preco-original">R$ ${Number(p.preco_original).toFixed(2).replace('.',',')}</div>`:''}
            <div class="item-preco">R$ ${Number(p.preco).toFixed(2).replace('.',',')}</div>
          </div>
          <div class="item-acoes">
            <button class="btn-icon danger" onclick="deletarItem('${p.id}')">🗑️</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderEmojiGrid() {
  const grid=document.getElementById('emoji-grid'); if (!grid) return;
  grid.innerHTML=EMOJIS.map(e=>
    `<button class="emoji-btn ${e===emojiSel?'selected':''}" onclick="selecionarEmoji('${e}',this)">${e}</button>`
  ).join('');
}

export function abrirModalItem() {
  document.getElementById('modal-item').classList.add('open');
  ['item-nome','item-desc','item-cat','item-preco','item-preco-orig'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const promo=document.getElementById('item-promocao');
  if (promo) promo.checked=false;
  const promoGrp=document.getElementById('preco-orig-group');
  if (promoGrp) promoGrp.style.display='none';
  document.getElementById('foto-preview').innerHTML='<span>📷 Clique para adicionar foto</span>';
  fotoFile=null; emojiSel='🍔';
  renderEmojiGrid();
}

export function fecharModal() { document.getElementById('modal-item').classList.remove('open'); }
export function fecharModalFora(e) { if(e.target.id==='modal-item') fecharModal(); }

export function previewFoto(event) {
  const file=event.target.files[0]; if (!file) return;
  fotoFile=file;
  document.getElementById('foto-preview').innerHTML=
    `<img src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
}

export function selecionarEmoji(emoji,btn) {
  emojiSel=emoji;
  document.querySelectorAll('.emoji-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

export async function salvarItem() {
  const estab=getEstab(); if (!estab) return showToast('Faça login novamente.','error');
  const nome  = document.getElementById('item-nome')?.value.trim();
  const preco = parseFloat(document.getElementById('item-preco')?.value);
  if (!nome)        return showToast('Digite o nome do item.','error');
  if (isNaN(preco)) return showToast('Digite o preço.','error');

  const btn=document.querySelector('#modal-item .btn-primary');
  if (btn) { btn.disabled=true; btn.textContent='Salvando...'; }

  try {
    let foto_url=null;
    if (fotoFile) {
      const ext=fotoFile.name.split('.').pop();
      const path=`${estab.id}/${Date.now()}.${ext}`;
      const {error:upErr}=await getSupa().storage.from('fotos').upload(path,fotoFile,{upsert:true});
      if (upErr) throw new Error('Erro no upload da foto: '+upErr.message);
      foto_url=getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
    }

    const promocao   = document.getElementById('item-promocao')?.checked||false;
    const preco_orig = parseFloat(document.getElementById('item-preco-orig')?.value)||null;

    const {error}=await getSupa().from('produtos').insert({
      estabelecimento_id:estab.id, nome,
      descricao: document.getElementById('item-desc')?.value.trim(),
      categoria: document.getElementById('item-cat')?.value.trim().toUpperCase(),
      preco, preco_original:promocao?preco_orig:null,
      foto_url, emoji:emojiSel, disponivel:true, promocao,
    });
    if (error) throw new Error(error.message);

    await renderCardapio();
    fecharModal();
    showToast('Item adicionado! ✅');
  } catch(e) {
    showToast(e.message,'error');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Salvar item'; }
  }
}

export async function deletarItem(id) {
  if (!confirm('Remover este item?')) return;
  await getSupa().from('produtos').delete().eq('id',id);
  await renderCardapio();
  showToast('Item removido.');
}

// ============================================================
// FRESQUINHO
// ============================================================
async function renderFresquinho() {
  const estab=getEstab(); const grid=document.getElementById('fresquinho-grid');
  if (!grid||!estab) return;

  const {data}=await getSupa().from('fresquinhos').select('*')
    .eq('estabelecimento_id',estab.id)
    .gt('expires_at',new Date().toISOString())
    .order('created_at',{ascending:false});

  if (!data?.length) {
    grid.innerHTML=`<div class="empty-state-light" style="grid-column:1/-1">
      <span>✨</span><p>Nenhuma foto ou vídeo postado ainda.<br>O conteúdo aparece aqui por 4 horas.</p></div>`;
    return;
  }

  grid.innerHTML=data.map(f=>{
    const rest=new Date(f.expires_at)-new Date();
    const h=Math.floor(rest/3600000),m=Math.floor((rest%3600000)/60000);
    return `<div class="fresquinho-card">
      ${f.tipo==='video'
        ?`<video class="fresquinho-media-video" src="${f.url}" controls playsinline></video>`
        :`<img class="fresquinho-media" src="${f.url}" alt="Fresquinho">`}
      <div class="fresquinho-timer">⏱ ${h>0?h+'h '+m+'min':m+'min'}</div>
      <div class="fresquinho-footer">
        <button class="btn-remover-fresh" onclick="removerFresquinho('${f.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

export async function postarFresquinho(event) {
  const estab=getEstab(); const file=event.target.files[0];
  if (!file||!estab) return;
  if (file.size>50*1024*1024) return showToast('Máx. 50MB','error');
  showToast('Enviando...');
  const ext=file.name.split('.').pop();
  const path=`${estab.id}/fresh_${Date.now()}.${ext}`;
  const tipo=file.type.startsWith('video')?'video':'foto';
  const {error}=await getSupa().storage.from('fotos').upload(path,file,{upsert:true});
  if (error) return showToast('Erro: '+error.message,'error');
  const url=getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
  await getSupa().from('fresquinhos').insert({
    estabelecimento_id:estab.id, url, tipo,
    expires_at:new Date(Date.now()+4*60*60*1000).toISOString(),
  });
  await renderFresquinho();
  showToast('Postado! Disponível por 4h ✨');
  event.target.value='';
}

export async function removerFresquinho(id) {
  await getSupa().from('fresquinhos').delete().eq('id',id);
  await renderFresquinho();
  showToast('Removido.');
}

// ============================================================
// PEDIDOS
// ============================================================
async function renderPedidos() {
  const estab=getEstab(); if (!estab) return;
  const {data}=await getSupa().from('pedidos').select('*')
    .eq('estabelecimento_id',estab.id)
    .order('created_at',{ascending:false}).limit(50);

  const hoje=new Date().toDateString();
  const pedHoje=(data||[]).filter(p=>new Date(p.created_at).toDateString()===hoje);
  const fatHoje=pedHoje.reduce((s,p)=>s+Number(p.total||0),0);

  const statPed=document.getElementById('stat-pedidos');
  const statFat=document.getElementById('stat-faturamento');
  if (statPed) statPed.textContent=pedHoje.length;
  if (statFat) statFat.textContent=`R$ ${fatHoje.toFixed(2).replace('.',',')}`;

  const card=p=>{
    const cls={novo:'status-novo',preparo:'status-preparo',pronto:'status-pronto'}[p.status]||'status-novo';
    const lbl={novo:'NOVO',preparo:'PREPARO',pronto:'PRONTO'}[p.status]||'NOVO';
    const min=Math.floor((Date.now()-new Date(p.created_at))/60000);
    return `<div class="pedido-card">
      <div class="pedido-top">
        <div>
          <div class="pedido-id">#${p.id.slice(-4).toUpperCase()} — ${p.cliente_nome||'Cliente'}</div>
          <div class="pedido-tempo">há ${min<1?'menos de 1':min} min</div>
        </div>
        <span class="pedido-status ${cls}">${lbl}</span>
      </div>
      <div class="pedido-itens">${Array.isArray(p.itens)?p.itens.map(i=>`${i.qtd}x ${i.nome}`).join(' • '):''}</div>
      <div class="pedido-total">R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</div>
    </div>`;
  };

  const listUlt=document.getElementById('ultimos-pedidos');
  const listTod=document.getElementById('todos-pedidos');
  if (listUlt&&pedHoje.length) listUlt.innerHTML=pedHoje.slice(0,3).map(card).join('');
  if (listTod&&data?.length) listTod.innerHTML=data.map(card).join('');
}

// ============================================================
// LOGO UPLOAD
// ============================================================
export function previewLogo(event) {
  const file=event.target.files[0]; if (!file) return;
  logoFile=file;
  const url=URL.createObjectURL(file);
  const img=document.getElementById('logo-preview-img');
  const txt=document.getElementById('logo-placeholder-text');
  if (img) { img.src=url; img.style.display='block'; }
  if (txt) txt.style.display='none';
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================
export async function salvarConfig() {
  const estab=getEstab(); if (!estab) return;
  const nome  = document.getElementById('cfg-nome')?.value.trim();
  const slug  = document.getElementById('cfg-slug')?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-');
  const whats = document.getElementById('cfg-whats')?.value.trim();
  const desc  = document.getElementById('cfg-desc')?.value.trim();

  if (!nome||!slug) return showToast('Preencha nome e link.','error');

  const btn=document.querySelector('[onclick="salvarConfig()"]');
  if (btn) { btn.disabled=true; btn.textContent='Salvando...'; }

  try {
    // Verifica slug único
    if (slug!==estab.slug) {
      const {data:existe}=await getSupa().from('estabelecimentos').select('id').eq('slug',slug).maybeSingle();
      if (existe) throw new Error('Esse link já está em uso. Escolha outro.');
    }

    let logo_url=estab.logo_url||null;
    // Upload logo se selecionada
    if (logoFile) {
      const ext=logoFile.name.split('.').pop();
      const path=`${estab.id}/logo.${ext}`;
      const {error:upErr}=await getSupa().storage.from('fotos').upload(path,logoFile,{upsert:true});
      if (upErr) throw new Error('Erro no upload da logo: '+upErr.message);
      logo_url=getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
      logoFile=null;
    }

    const {error}=await getSupa().from('estabelecimentos')
      .update({nome, slug, whatsapp:whats, descricao:desc, logo_url})
      .eq('id',estab.id);
    if (error) throw new Error(error.message);

    const novoEstab={...estab, nome, slug, whatsapp:whats, descricao:desc, logo_url};
    window._estab=novoEstab;
    localStorage.setItem('pw_estab',JSON.stringify(novoEstab));

    document.getElementById('dash-store-name').textContent=nome;
    const linkEl=document.getElementById('link-url');
    if (linkEl) linkEl.textContent=`https://pediway.vercel.app/${slug}`;
    const cfgLink=document.getElementById('cfg-link-preview');
    if (cfgLink) cfgLink.textContent=`https://pediway.vercel.app/${slug}`;

    showToast('Configurações salvas! ✅');
  } catch(e) {
    showToast(e.message,'error');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Salvar configurações'; }
  }
}

// Expõe globalmente
window.abrirModalItem    = abrirModalItem;
window.fecharModal       = fecharModal;
window.fecharModalFora   = fecharModalFora;
window.previewFoto       = previewFoto;
window.previewLogo       = previewLogo;
window.selecionarEmoji   = selecionarEmoji;
window.salvarItem        = salvarItem;
window.deletarItem       = deletarItem;
window.postarFresquinho  = postarFresquinho;
window.removerFresquinho = removerFresquinho;
window.salvarConfig      = salvarConfig;
window.initDashboard     = initDashboard;
