// src/game.js

const EMOJIS = ['🍔','🍟','🌮','🍕','🍗','🥤','🍦','🧁','🌭','🥪'];
const ESIZE  = 52;   // px do emoji
const VEL_BASE = 1.8; // pixels por frame (bem suave)
const VEL_MAX  = 3.2; // máximo — nunca fica impossível
const VEL_STEP = 0.2; // quanto sobe a cada 5 acertos

let pontos        = 0;
let tempoRestante = 60;
let vel           = VEL_BASE;
let vx            = 0;
let vy            = 0;
let x             = 0;
let y             = 0;
let loopId        = null;
let timerId       = null;
let emojiEl       = null;
let areaEl        = null;
let lastTime      = 0;

// ─── helpers ──────────────────────────────────────────────

function emojiAleatorio(atual) {
  const lista = EMOJIS.filter(e => e !== atual);
  return lista[Math.floor(Math.random() * lista.length)];
}

/** Gera ângulo aleatório que NÃO seja quase horizontal nem vertical */
function anguloRandom() {
  // evita ângulos próximos de 0°, 90°, 180°, 270° (±15°)
  const proibido = [0, 90, 180, 270, 360];
  let graus;
  do {
    graus = Math.random() * 360;
  } while (proibido.some(p => Math.abs(graus - p) < 20));
  return graus * Math.PI / 180;
}

/** Pequena deflexão aleatória ao bater no canto (±20°) */
function deflexao() {
  return (Math.random() * 40 - 20) * Math.PI / 180;
}

function atualizarUI() {
  const pl = document.getElementById('jogo-placar');
  if (pl) pl.textContent = `Pontos: ${pontos}  ⏱ ${tempoRestante}s`;
}

// ─── loop de animação ──────────────────────────────────────

function loop(ts) {
  if (!areaEl || !emojiEl) return;

  // Limita FPS a 60 independente do dispositivo
  if (ts - lastTime < 16) { loopId = requestAnimationFrame(loop); return; }
  lastTime = ts;

  const size = areaEl.offsetWidth || 300;

  x += vx;
  y += vy;

  // Bate na parede esquerda/direita → inverte vx + deflexão aleatória
  if (x <= 0) {
    x = 0;
    const ang = deflexao();
    const speed = Math.sqrt(vx*vx + vy*vy);
    vx =  Math.abs(vx) + Math.sin(ang) * speed * 0.3;
    vy =  vy + Math.cos(ang) * speed * 0.3;
    normalizarVel(speed);
  }
  if (x >= size - ESIZE) {
    x = size - ESIZE;
    const ang = deflexao();
    const speed = Math.sqrt(vx*vx + vy*vy);
    vx = -Math.abs(vx) + Math.sin(ang) * speed * 0.3;
    vy =  vy + Math.cos(ang) * speed * 0.3;
    normalizarVel(speed);
  }

  // Bate em cima/baixo → inverte vy + deflexão aleatória
  if (y <= 0) {
    y = 0;
    const ang = deflexao();
    const speed = Math.sqrt(vx*vx + vy*vy);
    vy =  Math.abs(vy) + Math.sin(ang) * speed * 0.3;
    vx =  vx + Math.cos(ang) * speed * 0.3;
    normalizarVel(speed);
  }
  if (y >= size - ESIZE) {
    y = size - ESIZE;
    const ang = deflexao();
    const speed = Math.sqrt(vx*vx + vy*vy);
    vy = -Math.abs(vy) + Math.sin(ang) * speed * 0.3;
    vx =  vx + Math.cos(ang) * speed * 0.3;
    normalizarVel(speed);
  }

  emojiEl.style.left = x + 'px';
  emojiEl.style.top  = y + 'px';

  loopId = requestAnimationFrame(loop);
}

/** Mantém a velocidade exatamente em `vel` */
function normalizarVel(speed) {
  const mag = Math.sqrt(vx*vx + vy*vy) || 1;
  vx = (vx / mag) * vel;
  vy = (vy / mag) * vel;
}

// ─── clique ───────────────────────────────────────────────

function clicouEmoji() {
  pontos++;

  // Animação
  emojiEl.style.transform = 'scale(1.6)';
  setTimeout(() => { if (emojiEl) emojiEl.style.transform = 'scale(1)'; }, 140);

  // Troca emoji
  emojiEl.textContent = emojiAleatorio(emojiEl.textContent);

  // Sobe velocidade apenas a cada 5 acertos
  if (pontos % 5 === 0) {
    vel = Math.min(vel + VEL_STEP, VEL_MAX);
    normalizarVel(1); // reaplica nova velocidade imediatamente
    // Flash visual de "subiu nível"
    if (emojiEl) {
      emojiEl.style.filter = 'brightness(2)';
      setTimeout(() => { if (emojiEl) emojiEl.style.filter = ''; }, 300);
    }
  }

  atualizarUI();
}

// ─── encerrar ─────────────────────────────────────────────

function encerrarJogo() {
  cancelAnimationFrame(loopId);
  clearInterval(timerId);
  loopId = null; timerId = null; emojiEl = null;

  const area = document.getElementById('jogo-area');
  if (area) area.innerHTML = `
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                align-items:center;justify-content:center;gap:12px;">
      <div style="font-size:3rem">⏰</div>
      <div style="font-size:1.15rem;font-weight:800;color:#fff">Tempo esgotado!</div>
      <div style="font-size:0.9rem;color:rgba(255,255,255,0.65)">
        Você pegou <strong style="color:#fff;font-size:1.1rem">${pontos}</strong> lanches
      </div>
    </div>`;
}

// ─── exports ──────────────────────────────────────────────

export function startGame() {
  pontos = 0; tempoRestante = 60; vel = VEL_BASE; lastTime = 0;

  const overlay = document.getElementById('jogo-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.classList.add('no-scroll');

  areaEl = document.getElementById('jogo-area');
  if (!areaEl) return;
  areaEl.innerHTML = '';

  const size = areaEl.offsetWidth || 300;

  // Posição inicial aleatória (longe das bordas)
  x = ESIZE + Math.random() * (size - ESIZE * 3);
  y = ESIZE + Math.random() * (size - ESIZE * 3);

  // Ângulo inicial realmente aleatório (sem diagonais fixas)
  const ang = anguloRandom();
  vx = Math.cos(ang) * vel;
  vy = Math.sin(ang) * vel;

  // Cria emoji
  emojiEl = document.createElement('div');
  emojiEl.className   = 'jogo-emoji';
  emojiEl.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  emojiEl.style.cssText = `
    position:absolute;
    left:${x}px; top:${y}px;
    font-size:2.8rem;
    cursor:pointer;
    user-select:none;
    transition:transform 0.14s, filter 0.2s;
    line-height:1;
  `;
  emojiEl.addEventListener('click', clicouEmoji);
  emojiEl.addEventListener('touchstart', e => { e.preventDefault(); clicouEmoji(); }, { passive: false });
  areaEl.appendChild(emojiEl);

  atualizarUI();

  cancelAnimationFrame(loopId);
  loopId = requestAnimationFrame(loop);

  clearInterval(timerId);
  timerId = setInterval(() => {
    tempoRestante--;
    atualizarUI();
    if (tempoRestante <= 0) encerrarJogo();
  }, 1000);
}

export function fecharJogo() {
  cancelAnimationFrame(loopId);
  clearInterval(timerId);
  loopId = null; timerId = null; emojiEl = null;
  document.getElementById('jogo-overlay')?.classList.remove('open');
  document.body.classList.remove('no-scroll');
  if (window.irPara) window.irPara('pedidos');
}

window.startGame  = startGame;
window.fecharJogo = fecharJogo;
