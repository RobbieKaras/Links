// Shared by every page: puts the game name (from config.js) wherever the
// HTML has a data-game-name attribute, and into the browser tab title.

import { CONFIG } from './config.js';

export function applyGameName() {
  for (const el of document.querySelectorAll('[data-game-name]')) {
    el.textContent = CONFIG.GAME_NAME;
  }
  document.title = document.title.replace('{name}', CONFIG.GAME_NAME);
}

applyGameName();
