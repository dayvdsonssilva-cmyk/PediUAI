// src/modules/menu.js
import { supabase } from '../lib/supabase.js'
import { openModal, closeModal, openCrop } from './ui.js'

let storeId   = null
let editingId = null
let photoUrls = []

export async function initMenu(store) {
  storeId = store.id
  await loadMenu()
}

async function loadMenu() {
  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('store_id', storeId)
    .order('category')

  const grid = document.getElementById('menu-grid')
  if (!grid) return

  grid.innerHTML = items?.length
    ? items.map(item => menuCard(item)).join('')
    : '<div style="text-align:center;padding:2rem;color:var(--ink3)">Nenhum item ainda. Adicione o primeiro! 👆</div>'

  document.getElementById('st-items')?.textContent !== undefined &&
    (document.getElementById('st-items').textContent = items?.length ?? 0)
}

function menuCard(item) {
  const imgHtml = item.photos?.[0]
    ? `<img src="${item.photos[0]}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`
    : `<div class="ef">${item.emoji || '🍽️'}</div>`

  return `
  <div class="mc">
    <div class="mc-img">
      ${imgHtml}
      <span class="mc-badge ${item.available ? 'av-y' : 'av-n'}">${item.available ? 'Disponível' : 'Oculto'}</span>
    </div>
    <div class="mc-body">
      <div class="mc-cat">${item.category || 'Sem categoria'}</div>
      <div class="mc-name">${item.name}</div>
      <div class="mc-desc">${item.description || ''}</div>
      <div class="mc-foot">
        <span class="mp">R$ ${item.price?.toFixed(2).replace('.', ',')}</span>
        <div class="macts">
          <button class="ib" onclick="window.__menu.toggleAvailable('${item.id}', ${!item.available})" title="${item.available ? 'Ocultar' : 'Exibir'}">
            ${item.available ? '👁' : '👁‍🗨'}
          </button>
          <button class="ib" onclick="window.__menu.editItem('${item.id}')">✏️</button>
          <button class="ib d" onclick="window.__menu.deleteItem('${item.id}')">🗑</button>
        </div>
      </div>
    </div>
  </div>`
}

export function openAddItem() {
  editingId = null
  photoUrls = []
  clearForm()
  document.getElementById('modal-title').textContent = 'Adicionar item'
  openModal('modal-add')
}

export async function saveItem() {
  const name  = document.getElementById('i-name')?.value.trim()
  const price = parseFloat(document.getElementById('i-price')?.value)
  const desc  = document.getElementById('i-desc')?.value.trim()
  const cat   = document.getElementById('i-cat')?.value.trim()

  if (!name || isNaN(price)) return alert('Nome e preço são obrigatórios.')

  const payload = { store_id: storeId, name, price, description: desc, category: cat,
                    photos: photoUrls, available: true }

  if (editingId) {
    await supabase.from('menu_items').update(payload).eq('id', editingId)
  } else {
    await supabase.from('menu_items').insert(payload)
  }

  closeModal('modal-add')
  await loadMenu()
}

export async function addPhotos(input) {
  for (const file of Array.from(input.files)) {
    if (photoUrls.length >= 5) break
    const path = `stores/${storeId}/menu/${Date.now()}-${file.name}`
    await supabase.storage.from('menu-photos').upload(path, file)
    const { data } = supabase.storage.from('menu-photos').getPublicUrl(path)
    photoUrls.push(data.publicUrl)
  }
  renderPhotoGrid()
}

function renderPhotoGrid() {
  const grid = document.getElementById('photos-grid')
  if (!grid) return
  grid.innerHTML = photoUrls.map((url, i) =>
    `<div style="position:relative;aspect-ratio:1;background:#f0f0f0;border-radius:8px;overflow:hidden">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover">
      <button onclick="window.__menu.removePhoto(${i})"
        style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.5);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:.7rem">×</button>
    </div>`
  ).join('')
  const addBtn = document.getElementById('ph-add-btn')
  if (addBtn) addBtn.style.display = photoUrls.length >= 5 ? 'none' : 'block'
}

function clearForm() {
  ['i-name','i-desc','i-cat','i-price'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  photoUrls = []
  renderPhotoGrid()
}

// Ações expostas via window.__menu
window.__menu = {
  async toggleAvailable(id, val) {
    await supabase.from('menu_items').update({ available: val }).eq('id', id)
    await loadMenu()
  },
  async editItem(id) {
    const { data } = await supabase.from('menu_items').select('*').eq('id', id).single()
    if (!data) return
    editingId = id
    photoUrls = data.photos || []
    document.getElementById('i-name').value  = data.name
    document.getElementById('i-desc').value  = data.description || ''
    document.getElementById('i-cat').value   = data.category || ''
    document.getElementById('i-price').value = data.price
    document.getElementById('modal-title').textContent = 'Editar item'
    renderPhotoGrid()
    openModal('modal-add')
  },
  async deleteItem(id) {
    if (!confirm('Remover este item do cardápio?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    await loadMenu()
  },
  removePhoto(i) {
    photoUrls.splice(i, 1)
    renderPhotoGrid()
  },
}

export { openAddItem as default }
