// src/modules/flash.js
import { supabase } from '../lib/supabase.js'

let flashes = []
let currentFlash = 0
let flashTimer   = null

export async function initFlash(store) {
  if (!store) return

  const { data } = await supabase
    .from('flashes')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  flashes = data || []
  renderAdminFlashes()
}

function renderAdminFlashes() {
  const grid = document.getElementById('flash-admin-grid')
  if (!grid) return

  grid.innerHTML = flashes.map((f, i) => {
    const expiresAt = new Date(f.created_at).getTime() + 4 * 60 * 60 * 1000
    const expired   = Date.now() > expiresAt
    return `<div style="position:relative;aspect-ratio:9/16;background:#111;border-radius:12px;overflow:hidden;${expired ? 'opacity:.4' : ''}">
      <img src="${f.url}" style="width:100%;height:100%;object-fit:cover">
      ${expired ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);color:#fff;font-size:.7rem;font-weight:700">Expirado</div>' : ''}
      <button onclick="window.__flash.delete('${f.id}')"
        style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.5);border:none;color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:.8rem">×</button>
    </div>`
  }).join('')
}

export async function addFlash(input) {
  const file  = input.files[0]
  const store = window.__store
  if (!file || !store) return

  const path = `stores/${store.id}/flash/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('flashes').upload(path, file)
  if (error) { console.error('[Flash]', error); return }

  const { data } = supabase.storage.from('flashes').getPublicUrl(path)

  await supabase.from('flashes').insert({
    store_id: store.id,
    url: data.publicUrl,
  })

  await initFlash(store)
  input.value = ''
}

export function openFlashPlayer(flashList, startIndex = 0) {
  flashes = flashList
  currentFlash = startIndex
  renderFlashSlide()
  document.getElementById('modal-flash').style.display = 'block'
  startFlashTimer()
}

export function closeFlash() {
  document.getElementById('modal-flash').style.display = 'none'
  clearTimeout(flashTimer)
}

export function flashNext() {
  if (currentFlash < flashes.length - 1) { currentFlash++; renderFlashSlide() }
  else closeFlash()
}

export function flashPrev() {
  if (currentFlash > 0) { currentFlash--; renderFlashSlide() }
}

function renderFlashSlide() {
  const f = flashes[currentFlash]
  if (!f) return

  const slides = document.getElementById('flash-slides')
  if (slides) slides.innerHTML = `<img src="${f.url}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`

  const prog = document.getElementById('fp-prog')
  if (prog) {
    prog.innerHTML = flashes.map((_, i) =>
      `<div style="flex:1;height:2px;background:${i === currentFlash ? '#fff' : 'rgba(255,255,255,.3)'};border-radius:1px"></div>`
    ).join('')
  }
}

function startFlashTimer() {
  clearTimeout(flashTimer)
  flashTimer = setTimeout(flashNext, 4000)
}

window.__flash = {
  async delete(id) {
    if (!confirm('Remover este Fresquinho?')) return
    await supabase.from('flashes').delete().eq('id', id)
    await initFlash(window.__store)
  }
}


// ──────────────────────────────────────────────────────────────────────────────
// src/modules/game.js  — mini-game na tela de aguardo do pedido
// ──────────────────────────────────────────────────────────────────────────────
let score = 0, timer = 30, gameInterval = null, timerInterval = null

export function initGame() {
  score = 0; timer = 30
  updateGameUI()
  document.getElementById('game-start-msg').style.display = 'flex'
  document.getElementById('game-burger').style.display    = 'none'
  document.getElementById('game-over').style.display      = 'none'
}

export function startGame() {
  score = 0; timer = 30
  document.getElementById('game-start-msg').style.display = 'none'
  document.getElementById('game-over').style.display      = 'none'
  document.getElementById('game-burger').style.display    = 'block'

  moveBurger()
  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    timer--
    updateGameUI()
    if (timer <= 0) endGame()
  }, 1000)
}

export function clickBurger(e) {
  e.stopPropagation()
  score++
  updateGameUI()
  moveBurger()
}

function moveBurger() {
  const area   = document.getElementById('game-area')
  const burger = document.getElementById('game-burger')
  if (!area || !burger) return
  const maxX = area.clientWidth  - 56
  const maxY = area.clientHeight - 56
  burger.style.left = Math.random() * maxX + 'px'
  burger.style.top  = Math.random() * maxY + 'px'
}

function endGame() {
  clearInterval(timerInterval)
  document.getElementById('game-burger').style.display = 'none'
  document.getElementById('game-over').style.display   = 'flex'
  document.getElementById('final-score').textContent   = score
}

function updateGameUI() {
  document.getElementById('g-score').textContent = score
  document.getElementById('g-timer').textContent = timer
}
