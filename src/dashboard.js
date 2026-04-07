// src/dashboard.js
import { showToast } from './utils.js';

const EMOJIS = ['🍔','🍕','🌮','🥪','🍜','🥗','🍗','🥩','🫕','🥘',
                 '🍱','🧆','🍣','🍦','🧁','🎂','🥤','🧃','☕','🧋',
                 '🍺','🍷','🥂','🫖','🍹','🔥','⭐','💎','🎯','🏆'];

let cardapio = JSON.parse(localStorage.getItem('pw_cardapio') || '[]');
let emojiSelecionado = '🍔';
let fotoBase64 = null;

export function initDashboard() {
  renderCardapio();
  renderEmojiGrid();
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
          : `<div class="item-emoji-bg">${item.emoji || '🍔'}</div>`
        }
        <span class="item-disponivel">Disponível</span>
      </div>
      <div class="item-body">
        <div class="item-categoria">${item.categoria || 'SEM CATEGORIA'}</div>
        <div class="item-nome">${item.nome}</div>
        <div class="item-desc-text">${item.descricao || ''}</div>
        <div class="item-footer">
          <div class="item-preco">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
          <div class="item-acoes">
            <button class="btn-icon" onclick="editarItem(${i})" title="Editar">✏️</button>
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

// ===== MODAL =====
export function abrirModalItem() {
  document.getElementById('modal-item').classList.add('open');
  // Limpa campos
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
    const preview = document.getElementById('foto-preview');
    preview.innerHTML = `<img src="${fotoBase64}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
  };
  reader.readAsDataURL(file);
}

export function selecionarEmoji(emoji, btn) {
  emojiSelecionado = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

export function salvarItem() {
  const nome   = document.getElementById('item-nome')?.value.trim();
  const preco  = document.getElementById('item-preco')?.value;

  if (!nome)  return showToast('Digite o nome do item.', 'error');
  if (!preco) return showToast('Digite o preço do item.', 'error');

  const item = {
    nome,
    descricao:  document.getElementById('item-desc')?.value.trim(),
    categoria:  document.getElementById('item-cat')?.value.trim().toUpperCase(),
    preco:      parseFloat(preco),
    emoji:      emojiSelecionado,
    foto:       fotoBase64,
  };

  cardapio.push(item);
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

// Expõe globalmente
window.abrirModalItem  = abrirModalItem;
window.fecharModal     = fecharModal;
window.fecharModalFora = fecharModalFora;
window.previewFoto     = previewFoto;
window.selecionarEmoji = selecionarEmoji;
window.salvarItem      = salvarItem;
window.deletarItem     = deletarItem;
