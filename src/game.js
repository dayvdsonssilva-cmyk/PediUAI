// src/game.js
export function startGame() {
  console.log("🎮 Jogo 'Pega o Lanche' iniciado");
  alert("🎮 Jogo iniciado! (Versão demo)");
}

export function clickBurger() {
  console.log("🍔 Burger clicado!");
}

// Torna global
window.startGame = startGame;
window.clickBurger = clickBurger;
