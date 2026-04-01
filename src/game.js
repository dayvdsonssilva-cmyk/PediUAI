// â”€â”€â”€ MINI GAME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€ JOGO: configuraÃ§Ã£o de velocidade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GAME_SPEED_INICIAL = 0.8;  // muito devagar no comeÃ§o
const GAME_SPEED_MAX = 4.5;      // velocidade mÃ¡xima
const GAME_ACELERACAO = 0.15;    // quanto acelera por clique

function startGame(){
  gameActive=true; gameScore=0;
  const area=document.getElementById('game-area');
  // PosiÃ§Ã£o inicial no centro da Ã¡rea
  bx = (area.clientWidth||300)/2 - 25;
  by = (area.clientHeight||180)/2 - 25;
  // Velocidade inicial super baixa â€” 1 ponto Ã© fÃ¡cil
  const ang = Math.random() * Math.PI * 2;
  bvx = Math.cos(ang) * GAME_SPEED_INICIAL;
  bvy = Math.sin(ang) * GAME_SPEED_INICIAL;
  document.getElementById('g-score').textContent='0';
  document.getElementById('g-timer').textContent='30';
  document.getElementById('game-start-msg').style.display='none';
  document.getElementById('game-over').style.display='none';
  const b=document.getElementById('game-burger');
  b.style.display='block';
  b.style.fontSize='3rem'; // bem grande â€” fÃ¡cil de tocar
  b.style.transform='';
  moveBurger();
  let t=30;
  clearInterval(gTimer);
  gTimer=setInterval(()=>{t--;document.getElementById('g-timer').textContent=t;if(t<=0)endGame();},1000);
}

function moveBurger(){
  if(!gameActive) return;
  const area=document.getElementById('game-area');
  const w=area.clientWidth-52, h=area.clientHeight-52;
  bx+=bvx; by+=bvy;
  if(bx<=0){bx=0;bvx=Math.abs(bvx);}
  if(bx>=w){bx=w;bvx=-Math.abs(bvx);}
  if(by<=0){by=0;bvy=Math.abs(bvy);}
  if(by>=h){by=h;bvy=-Math.abs(bvy);}
  const b=document.getElementById('game-burger');
  if(b){b.style.left=bx+'px';b.style.top=by+'px';}
  gAnimFrame=requestAnimationFrame(moveBurger);
}

function clickBurger(e){
  if(!gameActive) return;
  if(e) { e.stopPropagation(); e.preventDefault(); }
  gameScore++;
  document.getElementById('g-score').textContent=gameScore;
  const b=document.getElementById('game-burger');
  if(b) b.textContent=foodEmojis[gameScore%foodEmojis.length];
  // Acelera progressivamente a cada clique
  const velAtual = Math.sqrt(bvx*bvx + bvy*bvy);
  const novaVel = Math.min(velAtual + GAME_ACELERACAO, GAME_SPEED_MAX);
  const ratio = novaVel / velAtual;
  bvx *= ratio; bvy *= ratio;
  // Feedback visual
  b.style.transform='scale(1.5)';
  setTimeout(()=>{ if(b) b.style.transform='scale(1)'; },100);
}
function endGame(){
  gameActive=false; clearInterval(gTimer); cancelAnimationFrame(gAnimFrame);
  document.getElementById('game-burger').style.display='none';
  document.getElementById('game-over').style.display='flex';
  document.getElementById('final-score').textContent=gameScore;
}

