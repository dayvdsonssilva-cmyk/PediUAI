// src/modules/ui.js
// Helpers de UI compartilhados por todos os módulos

// ── Navegação entre telas ──────────────────────────────────────────────────
export function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  const target = document.getElementById(screenId)
  if (target) {
    target.classList.add('active')
    target.scrollTop = 0
  }
}

// ── Toast / notificação flutuante ─────────────────────────────────────────
let notifTimer = null
export function showNotif(title, body) {
  const el    = document.getElementById('notif')
  const tEl   = document.getElementById('notif-t')
  const bEl   = document.getElementById('notif-b')
  if (!el) return
  tEl.textContent = title
  bEl.textContent = body
  el.classList.add('show')
  clearTimeout(notifTimer)
  notifTimer = setTimeout(() => el.classList.remove('show'), 4000)
}

// ── Modais ────────────────────────────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id)
  if (el) el.classList.add('open')
}

export function closeModal(id) {
  const el = document.getElementById(id)
  if (el) el.classList.remove('open')
}

// ── Toggle visibilidade de senha ──────────────────────────────────────────
export function togglePwVis(inputId, btn) {
  const inp = document.getElementById(inputId)
  if (!inp) return
  const isHidden = inp.type === 'password'
  inp.type = isHidden ? 'text' : 'password'
  btn.textContent = isHidden ? '🙈' : '👁'
}

// ── Máscaras de input ─────────────────────────────────────────────────────
export function maskDoc(el) {
  let v = el.value.replace(/\D/g, '')
  if (v.length <= 11) {
    // CPF: 000.000.000-00
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  } else {
    // CNPJ: 00.000.000/0001-00
    v = v.slice(0, 14)
         .replace(/(\d{2})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1/$2')
         .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
  }
  el.value = v
}

export function maskWpp(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{2})(\d)/, '($1) $2')
       .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
  el.value = v
}

export function maskPhone(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{2})(\d)/, '($1) $2')
       .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
  el.value = v
}

// ── Validação de CPF (dígitos verificadores) ──────────────────────────────
export function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += +cpf[i] * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== +cpf[9]) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += +cpf[i] * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === +cpf[10]
}

export function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false
  const calc = (len) => {
    let sum = 0, pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += +cnpj[len - i] * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === +cnpj[12] && calc(13) === +cnpj[13]
}

// ── Preview de logo (upload) ──────────────────────────────────────────────
export function previewLogo(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = document.getElementById('logo-preview')
    const ph  = document.getElementById('logo-ph')
    if (img) { img.src = e.target.result; img.style.display = 'block' }
    if (ph)  ph.style.display = 'none'
  }
  reader.readAsDataURL(file)
}

// ── Crop de imagem ────────────────────────────────────────────────────────
let cropState = { scale: 1, x: 0, y: 0, callback: null }

export function openCrop(src, callback) {
  const img = document.getElementById('crop-img')
  const zoom = document.getElementById('crop-zoom')
  if (!img) return
  img.src = src
  cropState = { scale: 1, x: 0, y: 0, callback }
  zoom.value = 1
  applyCropTransform()
  openModal('modal-crop')
}

export function applyCropTransform() {
  const img  = document.getElementById('crop-img')
  const zoom = document.getElementById('crop-zoom')
  if (!img || !zoom) return
  cropState.scale = parseFloat(zoom.value)
  img.style.transform = `scale(${cropState.scale}) translate(${cropState.x}px, ${cropState.y}px)`
}

export function cancelCrop() {
  closeModal('modal-crop')
}

export function confirmCrop() {
  const img = document.getElementById('crop-img')
  if (!img || !cropState.callback) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 400
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, 400, 400)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  cropState.callback(dataUrl)
  closeModal('modal-crop')
}

// ── Emoji picker ──────────────────────────────────────────────────────────
const EMOJIS = ['🍔','🍕','🍣','🍜','🌮','🌯','🥗','🍰','☕','🥤','🍦','🧁','🍗','🥩','🍤','🥙']

export function renderEmojiPicker(containerId, onSelect) {
  const el = document.getElementById(containerId)
  if (!el) return
  el.innerHTML = EMOJIS.map(e =>
    `<button class="epb" onclick="(${onSelect.toString()})('${e}')">${e}</button>`
  ).join('')
}
