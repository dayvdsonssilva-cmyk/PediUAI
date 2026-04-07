// src/dashboard.js
import { showToast } from './utils.js';
import { getSupa } from './supabase.js';

const BASE_URL = 'https://pediway.vercel.app';
const EMOJIS = ['🍔','🍕','🌮','🥪','🍜','🥗','🍗','🥩','🫕','🥘',
                 '🍱','🧆','🍣','🍦','🧁','🎂','🥤','🧃','☕','🧋',
                 '🍺','🍷','🥂','🫖','🍹','🔥','⭐','💎','🎯','🏆'];

let emojiSelecionado = '🍔';
let fotoFile = null;

function getEstab() {
  return window._estab || JSON.parse(localStorage.getItem('pw_estab') || 'null');
}

function getLinkEstab() {
  const estab = getEstab();
  return estab ? `${BASE_URL}/${estab.slug}` : `${BASE_URL}/meu-estabelecimento`;
}

export async function initDashboard() {
  const estab = getEstab();
  if (estab) {
    const el = document.getElementById('dash-store-name');
    if (el) el.textContent = estab.nome;
    const linkEl = document.getElementById('link-url');
    if (linkEl) linkEl.textContent = getLinkEstab();
    const cfgNome = document.getElementById('cfg-nome');
    if (cfgNome) cfgNome.value = estab.nome;
    const cfgSlug = document.getElementById('cfg-slug');
    if (cfgSlug) cfgSlug.value = estab.slug;
    const cfgLink = document.getElementById('cfg-link-preview');
    if (cfgLink) cfgLink.textContent = getLinkEstab();
    const cfgWhats = document.getElementById('cfg-whats');
    if (cfgWhats && estab.whatsapp) cfgWhats.value = estab.whatsapp;
    localStorage.setItem('pw_slug', estab.slug);
  }
  await renderCardapio();
  await renderFresquinho();
  await renderPedidos();
  renderEmojiGrid();
}

// ===== CARDÁPIO =====
async function renderCardapio() {
  const estab = getEstab();
  const grid  = document.getElementById('cardapio-grid');
  const statItens = document.getElementById('stat-itens');
  if (!grid || !estab) return;

  const { data: produtos } = await getSupa()
    .from('produtos').select('*')
    .eq('estabelecimento_id', estab.id)
    .order('created_at', { ascending: false });

  if (statItens) statItens.textContent = produtos?.length || 0;

  if (!produtos?.length) {
    grid.innerHTML = `<div class="empty-state-light" style="grid-column:1/-1">
      <span>🍽️</span><p>Nenhum item ainda.<br>Adicione seu primeiro produto!</p></div>`;
    return;
  }

  grid.innerHTML = produtos.map(p => `
    <div class="item-card">
      <div class="item-card-img">
        ${p.foto_url
          ? `<img class="item-img" src="${p.foto_url}" alt="${p.nome}">`
          : `<div class="item-emoji-bg">${p.emoji || '🍔'}</div>`}
        <span class="item-disponivel">${p.disponivel ? 'Disponível' : 'Indisponível'}</span>
        ${p.promocao ? `<span class="item-promo-badge">🔥 Promoção</span>` : ''}
      </div>
      <div class="item-body">
        <div class="item-categoria">${p.categoria || 'SEM CATEGORIA'}</div>
        <div class="item-nome">${p.nome}</div>
        <div class="item-desc-text">${p.descricao || ''}</div>
        <div class="item-footer">
          <div>
            ${p.promocao && p.preco_original
              ? `<div class="item-preco-original">R$ ${Number(p.preco_original).toFixed(2).replace('.',',')}</div>` : ''}
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
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  grid.innerHTML = EMOJIS.map(e => `
    <button class="emoji-btn ${e === emojiSelecionado ? 'selected' : ''}"
      onclick="selecionarEmoji('${e}', this)">${e}</button>`).join('');
}

export function abrirModalItem() {
  document.getElementById('modal-item').classList.add('open');
  ['item-nome','item-desc','item-cat','item-preco','item-preco-orig'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const promo = document.getElementById('item-promocao');
  if (promo) promo.checked = false;
  const promoGroup = document.getElementById('preco-orig-group');
  if (promoGroup) promoGroup.style.display = 'none';
  document.getElementById('foto-preview').innerHTML = '<span>📷 Clique para adicionar foto</span>';
  fotoFile = null; emojiSelecionado = '🍔';
  renderEmojiGrid();
}

export function fecharModal() { document.getElementById('modal-item').classList.remove('open'); }
export function fecharModalFora(e) { if (e.target.id === 'modal-item') fecharModal(); }

export function previewFoto(event) {
  const file = event.target.files[0]; if (!file) return;
  fotoFile = file;
  document.getElementById('foto-preview').innerHTML =
    `<img src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
}

export function selecionarEmoji(emoji, btn) {
  emojiSelecionado = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

export async function salvarItem() {
  const estab = getEstab();
  if (!estab) return showToast('Faça login novamente.', 'error');
  const nome  = document.getElementById('item-nome')?.value.trim();
  const preco = parseFloat(document.getElementById('item-preco')?.value);
  if (!nome)        return showToast('Digite o nome do item.', 'error');
  if (isNaN(preco)) return showToast('Digite o preço.', 'error');

  const btn = document.querySelector('#modal-item .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    let foto_url = null;
    if (fotoFile) {
      const ext  = fotoFile.name.split('.').pop();
      const path = `${estab.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await getSupa().storage.from('fotos').upload(path, fotoFile, { upsert: true });
      if (upErr) throw new Error('Erro no upload: ' + upErr.message);
      foto_url = getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
    }
    const promocao   = document.getElementById('item-promocao')?.checked || false;
    const preco_orig = parseFloat(document.getElementById('item-preco-orig')?.value) || null;

    const { error } = await getSupa().from('produtos').insert({
      estabelecimento_id: estab.id, nome,
      descricao: document.getElementById('item-desc')?.value.trim(),
      categoria: document.getElementById('item-cat')?.value.trim().toUpperCase(),
      preco, preco_original: promocao ? preco_orig : null,
      foto_url, emoji: emojiSelecionado, disponivel: true, promocao,
    });
    if (error) throw new Error(error.message);
    await renderCardapio(); fecharModal(); showToast('Item adicionado! ✅');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar item'; }
  }
}

export async function deletarItem(id) {
  if (!confirm('Remover este item?')) return;
  await getSupa().from('produtos').delete().eq('id', id);
  await renderCardapio(); showToast('Item removido.');
}

// ===== FRESQUINHO =====
async function renderFresquinho() {
  const estab = getEstab();
  const grid  = document.getElementById('fresquinho-grid');
  if (!grid || !estab) return;

  const { data } = await getSupa().from('fresquinhos').select('*')
    .eq('estabelecimento_id', estab.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (!data?.length) {
    grid.innerHTML = `<div class="empty-state-light" style="grid-column:1/-1">
      <span>✨</span><p>Nenhum conteúdo ainda.</p></div>`;
    return;
  }

  grid.innerHTML = data.map(f => {
    const restMs  = new Date(f.expires_at) - new Date();
    const horas   = Math.floor(restMs / 3600000);
    const minutos = Math.floor((restMs % 3600000) / 60000);
    return `<div class="fresquinho-card">
      ${f.tipo === 'video'
        ? `<video class="fresquinho-media-video" src="${f.url}" controls playsinline></video>`
        : `<img class="fresquinho-media" src="${f.url}" alt="Fresquinho">`}
      <div class="fresquinho-timer">⏱ ${horas > 0 ? horas+'h '+minutos+'min' : minutos+'min'}</div>
      <div class="fresquinho-footer">
        <button class="btn-remover-fresh" onclick="removerFresquinho('${f.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

export async function postarFresquinho(event) {
  const estab = getEstab(); const file = event.target.files[0];
  if (!file || !estab) return;
  if (file.size > 50 * 1024 * 1024) return showToast('Máx. 50MB', 'error');
  showToast('Enviando...');
  const ext  = file.name.split('.').pop();
  const path = `${estab.id}/fresh_${Date.now()}.${ext}`;
  const tipo = file.type.startsWith('video') ? 'video' : 'foto';
  const { error } = await getSupa().storage.from('fotos').upload(path, file, { upsert: true });
  if (error) return showToast('Erro: ' + error.message, 'error');
  const url = getSupa().storage.from('fotos').getPublicUrl(path).data.publicUrl;
  await getSupa().from('fresquinhos').insert({
    estabelecimento_id: estab.id, url, tipo,
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  });
  await renderFresquinho();
  showToast('Postado! Disponível por 4h ✨');
  event.target.value = '';
}

export async function removerFresquinho(id) {
  await getSupa().from('fresquinhos').delete().eq('id', id);
  await renderFresquinho(); showToast('Removido.');
}

// ===== PEDIDOS =====
async function renderPedidos() {
  const estab = getEstab(); if (!estab) return;
  const { data: pedidos } = await getSupa().from('pedidos').select('*')
    .eq('estabelecimento_id', estab.id)
    .order('created_at', { ascending: false }).limit(50);

  const hoje    = new Date().toDateString();
  const pedHoje = pedidos?.filter(p => new Date(p.created_at).toDateString() === hoje) || [];
  const fatHoje = pedHoje.reduce((s, p) => s + Number(p.total || 0), 0);

  const statPed = document.getElementById('stat-pedidos');
  const statFat = document.getElementById('stat-faturamento');
  if (statPed) statPed.textContent = pedHoje.length;
  if (statFat) statFat.textContent = `R$ ${fatHoje.toFixed(2).replace('.', ',')}`;

  const renderCard = p => {
    const cls = { novo:'status-novo', preparo:'status-preparo', pronto:'status-pronto' }[p.status] || 'status-novo';
    const lbl = { novo:'NOVO', preparo:'PREPARO', pronto:'PRONTO' }[p.status] || 'NOVO';
    const min = Math.floor((Date.now() - new Date(p.created_at)) / 60000);
    return `<div class="pedido-card">
      <div class="pedido-top">
        <div>
          <div class="pedido-id">#${p.id.slice(-4).toUpperCase()} — ${p.cliente_nome || 'Cliente'}</div>
          <div class="pedido-tempo">há ${min < 1 ? 'menos de 1' : min} min</div>
        </div>
        <span class="pedido-status ${cls}">${lbl}</span>
      </div>
      <div class="pedido-itens">${Array.isArray(p.itens) ? p.itens.map(i => `${i.qtd}x ${i.nome}`).join(' • ') : ''}</div>
      <div class="pedido-total">R$ ${Number(p.total||0).toFixed(2).replace('.',',')}</div>
    </div>`;
  };

  const listUlt = document.getElementById('ultimos-pedidos');
  const listTod = document.getElementById('todos-pedidos');
  if (listUlt && pedHoje.length) listUlt.innerHTML = pedHoje.slice(0,3).map(renderCard).join('');
  if (listTod && pedidos?.length) listTod.innerHTML = pedidos.map(renderCard).join('');
}

// ===== CONFIGURAÇÕES =====
export async function salvarConfig() {
  const estab = getEstab(); if (!estab) return;
  const nome  = document.getElementById('cfg-nome')?.value.trim();
  const slug  = document.getElementById('cfg-slug')?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const whats = document.getElementById('cfg-whats')?.value.trim();
  if (!nome || !slug) return showToast('Preencha nome e link.', 'error');

  if (slug !== estab.slug) {
    const { data: existe } = await getSupa().from('estabelecimentos').select('id').eq('slug', slug).maybeSingle();
    if (existe) return showToast('Esse link já está em uso. Escolha outro.', 'error');
  }

  const { error } = await getSupa().from('estabelecimentos')
    .update({ nome, slug, whatsapp: whats }).eq('id', estab.id);
  if (error) return showToast('Erro: ' + error.message, 'error');

  const novoEstab = { ...estab, nome, slug, whatsapp: whats };
  window._estab = novoEstab;
  localStorage.setItem('pw_estab', JSON.stringify(novoEstab));
  localStorage.setItem('pw_slug', slug);

  const novoLink = `${BASE_URL}/${slug}`;
  document.getElementById('dash-store-name').textContent = nome;
  document.getElementById('link-url').textContent = novoLink;
  document.getElementById('cfg-link-preview').textContent = novoLink;
  showToast('Salvo! ✅');
}

window.abrirModalItem    = abrirModalItem;
window.fecharModal       = fecharModal;
window.fecharModalFora   = fecharModalFora;
window.previewFoto       = previewFoto;
window.selecionarEmoji   = selecionarEmoji;
window.salvarItem        = salvarItem;
window.deletarItem       = deletarItem;
window.postarFresquinho  = postarFresquinho;
window.removerFresquinho = removerFresquinho;
window.salvarConfig      = salvarConfig;
window.initDashboard     = initDashboard;
