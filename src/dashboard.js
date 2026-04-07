// src/dashboard.js
import { showToast, gerarSlug } from './utils.js';

const EMOJIS = ['🍔','🍕','🌮','🥪','🍜','🥗','🍗','🥩','🫕','🥘',
                 '🍱','🧆','🍣','🍦','🧁','🎂','🥤','🧃','☕','🧋',
                 '🍺','🍷','🥂','🫖','🍹','🔥','⭐','💎','🎯','🏆'];

const FRESH_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 horas

let cardapio = JSON.parse(localStorage.getItem('pw_cardapio') || '[]');
let emojiSelecionado = '🍔';
let fotoBase64 = null;

export function initDashboard() {
  // Restaura nome salvo
  const nome = localStorage.getItem('pw_nome') || '';
  const slug = localStorage.getItem('pw_slug') || '';
  if (nome) {
    const storeEl = document.getElementById('dash-store-name');
    if (storeEl) storeEl.textContent = nome;
    const cfgNome = document.getElementById('cfg-nome');
    if (cfgNome) cfgNome.value = nome;
  }
  if (slug) {
    const url = `pediway.com.br/${slug}`;
    const linkUrl = document.getElementById('link-url');
    const cfgLink = document.getElementById('cfg-link-preview');
    if (linkUrl) linkUrl.textContent = url;
    if (cfgLink) cfgLink.textContent = url;
  }

  renderCardapio();
  renderEmojiGrid();
  renderFresquinho();

  // Atualiza timers do fresquinho a cada minuto
  setInterval(renderFresquinho, 60000);
}

// ===== CARDÁPIO =====
function renderCardapio() {
  const grid = document.getElementById('cardapio-grid');
  const statItens = document.getElementById('stat-itens');
  if (statItens) statItens.textContent = cardapio.length;
  if (!grid) return;

  if (!cardapio.length) {
    grid.innerHTML = `
      <div class="empty-state-light" style="grid-column:1/-1">
        <span>🍽️</span>
        <p>Nenhum item ainda.<br>Adicione seu primeiro produto!</p>
      </div>`;
    return;
  }

  grid.innerHTML = cardapio.map((item, i) => `
    <div class="item-card">
      <div class="item-card-img">
        ${item.foto
          ? `<img class="item-img" src="${item.foto}" alt="${item.nome}">`
          : `<div class="item-emoji-bg">${item.emoji || '🍔'}</div>`}
        <span class="item-disponivel">Disponível</span>
      </div>
      <div class="item-body">
        <div class="item-categoria">${item.categoria || 'SEM CATEGORIA'}</div>
        <div class="item-nome">${item.nome}</div>
        <div class="item-desc-text">${item.descricao || ''}</div>
        <div class="item-footer">
          <div class="item-preco">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
          <div class="item-acoes">
            <button class="btn-icon danger" onclick="deletarItem(${i})" title="Remover">🗑️</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderEmojiGrid() {
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  grid.innerHTML = EMOJIS.map(e => `
    <button class="emoji-btn ${e === emojiSelecionado ? 'selected' : ''}"
      onclick="selecionarEmoji('${e}', this)">${e}</button>
  `).join('');
}

// ===== MODAL ITEM =====
export function abrirModalItem() {
  document.getElementById('modal-item').classList.add('open');
  document.getElementById('item-nome').value  = '';
  document.getElementById('item-desc').value  = '';
  document.getElementById('item-cat').value   = '';
  document.getElementById('item-preco').value = '';
  document.getElementById('foto-preview').innerHTML = '<span>📷 Clique para adicionar foto</span>';
  fotoBase64 = null;
  emojiSelecionado = '🍔';
  renderEmojiGrid();
}

export function fecharModal() {
  document.getElementById('modal-item').classList.remove('open');
}

export function fecharModalFora(e) {
  if (e.target.id === 'modal-item') fecharModal();
}

export function previewFoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    fotoBase64 = e.target.result;
    document.getElementById('foto-preview').innerHTML =
      `<img src="${fotoBase64}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
  };
  reader.readAsDataURL(file);
}

export function selecionarEmoji(emoji, btn) {
  emojiSelecionado = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

export function salvarItem() {
  const nome  = document.getElementById('item-nome')?.value.trim();
  const preco = document.getElementById('item-preco')?.value;
  if (!nome)  return showToast('Digite o nome do item.', 'error');
  if (!preco) return showToast('Digite o preço do item.', 'error');

  cardapio.push({
    nome,
    descricao: document.getElementById('item-desc')?.value.trim(),
    categoria: document.getElementById('item-cat')?.value.trim().toUpperCase(),
    preco:     parseFloat(preco),
    emoji:     emojiSelecionado,
    foto:      fotoBase64,
  });

  localStorage.setItem('pw_cardapio', JSON.stringify(cardapio));
  renderCardapio();
  fecharModal();
  showToast('Item adicionado! ✅');
}

export function deletarItem(index) {
  if (!confirm('Remover este item do cardápio?')) return;
  cardapio.splice(index, 1);
  localStorage.setItem('pw_cardapio', JSON.stringify(cardapio));
  renderCardapio();
  showToast('Item removido.');
}

// ===== FRESQUINHO =====
function getFresquinhos() {
  const raw = JSON.parse(localStorage.getItem('pw_fresquinho') || '[]');
  const agora = Date.now();
  // Filtra expirados
  const validos = raw.filter(f => agora - f.timestamp < FRESH_EXPIRY_MS);
  if (validos.length !== raw.length) {
    localStorage.setItem('pw_fresquinho', JSON.stringify(validos));
  }
  return validos;
}

function formatarTempoRestante(timestamp) {
  const restante = FRESH_EXPIRY_MS - (Date.now() - timestamp);
  if (restante <= 0) return 'Expirado';
  const horas   = Math.floor(restante / 3600000);
  const minutos = Math.floor((restante % 3600000) / 60000);
  return horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
}

function renderFresquinho() {
  const grid = document.getElementById('fresquinho-grid');
  if (!grid) return;
  const fresquinhos = getFresquinhos();

  if (!fresquinhos.length) {
    grid.innerHTML = `
      <div class="empty-state-light" style="grid-column:1/-1">
        <span>✨</span>
        <p>Nenhum conteúdo postado ainda.<br>Mostre seu estabelecimento para os clientes!</p>
      </div>`;
    return;
  }

  grid.innerHTML = fresquinhos.map((f, i) => `
    <div class="fresquinho-card">
      ${f.tipo === 'video'
        ? `<video class="fresquinho-media-video" src="${f.src}" controls playsinline></video>`
        : `<img class="fresquinho-media" src="${f.src}" alt="Fresquinho">`}
      <div class="fresquinho-timer">⏱ ${formatarTempoRestante(f.timestamp)}</div>
      <div class="fresquinho-footer">
        <span class="fresquinho-desc">${f.descricao || ''}</span>
        <button class="btn-remover-fresh" onclick="removerFresquinho(${i})" title="Remover">🗑️</button>
      </div>
    </div>
  `).join('');
}

export function postarFresquinho(event) {
  const file = event.target.files[0];
  if (!file) return;

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) return showToast('Arquivo muito grande. Máx: 50MB', 'error');

  const reader = new FileReader();
  reader.onload = (e) => {
    const fresquinhos = getFresquinhos();
    fresquinhos.unshift({
      src:       e.target.result,
      tipo:      file.type.startsWith('video') ? 'video' : 'foto',
      timestamp: Date.now(),
      descricao: '',
    });
    localStorage.setItem('pw_fresquinho', JSON.stringify(fresquinhos));
    renderFresquinho();
    showToast('Conteúdo postado! Fica disponível por 4h ✨');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

export function removerFresquinho(index) {
  const fresquinhos = getFresquinhos();
  fresquinhos.splice(index, 1);
  localStorage.setItem('pw_fresquinho', JSON.stringify(fresquinhos));
  renderFresquinho();
  showToast('Conteúdo removido.');
}

// Expõe globalmente
window.abrirModalItem    = abrirModalItem;
window.fecharModal       = fecharModal;
window.fecharModalFora   = fecharModalFora;
window.previewFoto       = previewFoto;
window.selecionarEmoji   = selecionarEmoji;
window.salvarItem        = salvarItem;
window.deletarItem       = deletarItem;
window.postarFresquinho  = postarFresquinho;
window.removerFresquinho = removerFresquinho;
