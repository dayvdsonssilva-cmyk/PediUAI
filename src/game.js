// src/game.js

const EMOJIS = ['🍔','🍟','🌮','🍕','🍗','🥤','🍦','🧁','🌭','🥪'];

let pontos     = 0;
let tempoRestante = 60;
let velocidade = 1.2;   // começa devagar
let vx         = 0;
let vy         = 0;
let x          = 0;
let y          = 0;
let loopId     = null;
let timerIdG   = null;
let emojiEl    = null;
let areaEl     = null;

function emojiAleatorio(atual) {
  const lista = EMOJIS.filter(e => e !== atual);
  return lista[Math.floor(Math.random() * lista.length)];
}

function atualizarUI() {
  const pl = document.getElementById('jogo-placar');
  if (pl) pl.textContent = `Pontos: ${pontos}  ⏱ ${tempoRestante}s`;
}

function mover() {
  if (!areaEl || !emojiEl) return;
  const size = areaEl.offsetWidth || 300;
  const eSize = 52; // tamanho aproximado do emoji

  x += vx;
  y += vy;

  if (x <= 0)          { x = 0;          vx = Math.abs(vx); }
  if (x >= size-eSize) { x = size-eSize; vx = -Math.abs(vx); }
  if (y <= 0)          { y = 0;          vy = Math.abs(vy); }
  if (y >= size-eSize) { y = size-eSize; vy = -Math.abs(vy); }

  emojiEl.style.left = x + 'px';
  emojiEl.style.top  = y + 'px';

  loopId = requestAnimationFrame(mover);
}

function clicouEmoji() {
  pontos++;
  // Troca o emoji
  emojiEl.textContent = emojiAleatorio(emojiEl.textContent);
  // Pequena animação de clique
  emojiEl.style.transform = 'scale(1.5)';
  setTimeout(() => { if (emojiEl) emojiEl.style.transform = 'scale(1)'; }, 150);
  // Aumenta velocidade suavemente (máx 2.8x)
  velocidade = Math.min(velocidade + 0.08, 2.8);
  vx = (vx > 0 ? 1 : -1) * velocidade;
  vy = (vy > 0 ? 1 : -1) * velocidade;
  atualizarUI();
}

function encerrarJogo() {
  cancelAnimationFrame(loopId);
  clearInterval(timerIdG);
  loopId = null; timerIdG = null;

  const area = document.getElementById('jogo-area');
  if (area) area.innerHTML = `
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                align-items:center;justify-content:center;gap:10px;">
      <div style="font-size:2.5rem">⏰</div>
      <div style="font-size:1.1rem;font-weight:800;color:#fff">Tempo esgotado!</div>
      <div style="font-size:0.9rem;color:rgba(255,255,255,0.6)">Você pegou <strong style="color:#fff">${pontos} lanches</strong></div>
    </div>`;
}

export function startGame() {
  pontos = 0; tempoRestante = 60; velocidade = 1.2;

  // Garante que overlay existe
  const overlay = document.getElementById('jogo-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.classList.add('no-scroll');

  areaEl = document.getElementById('jogo-area');
  if (!areaEl) return;
  areaEl.innerHTML = '';

  const size = areaEl.offsetWidth || 300;

  // Posição e direção inicial aleatória
  x = Math.random() * (size - 52);
  y = Math.random() * (size - 52);
  const ang = Math.random() * Math.PI * 2;
  vx = Math.cos(ang) * velocidade;
  vy = Math.sin(ang) * velocidade;

  // Cria o único emoji
  emojiEl = document.createElement('div');
  emojiEl.className = 'jogo-emoji';
  emojiEl.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  emojiEl.style.left = x + 'px';
  emojiEl.style.top  = y + 'px';
  emojiEl.style.fontSize = '2.8rem';
  emojiEl.style.transition = 'transform 0.15s';
  emojiEl.onclick = clicouEmoji;
  areaEl.appendChild(emojiEl);

  atualizarUI();

  // Loop de animação
  cancelAnimationFrame(loopId);
  loopId = requestAnimationFrame(mover);

  // Timer 60s
  clearInterval(timerIdG);
  timerIdG = setInterval(() => {
    tempoRestante--;
    atualizarUI();
    if (tempoRestante <= 0) encerrarJogo();
  }, 1000);
}

export function fecharJogo() {
  cancelAnimationFrame(loopId);
  clearInterval(timerIdG);
  loopId = null; timerIdG = null;
  document.getElementById('jogo-overlay')?.classList.remove('open');
  document.body.classList.remove('no-scroll');
  if (window.irPara) window.irPara('pedidos');
}

// Globais
window.startGame  = startGame;
window.fecharJogo = fecharJogo;
