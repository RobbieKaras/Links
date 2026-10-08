// Builds the spoiler-free text for the Share button.

import { gameResult } from './game.js';
import { scoreTiles } from './tiles.js';

const SQUARES = { green: '🟩', yellow: '🟨', gray: '⬛' };

// `title` is "Hole 47" or "Practice". Rows are coloured squares only,
// never letters, so the answer is not given away.
export function buildShareText({ name, title, game, url }) {
  const result = gameResult(game);
  const moves = game.status === 'won' ? game.guesses.length : 'X';
  const hint = game.hints.length > 0 ? ' 💡' : '';
  const rows = [game.start, ...game.guesses].map((word) =>
    scoreTiles(word, game.target).map((color) => SQUARES[color]).join('')
  );
  const lines = [`${name} ${title} ⛳ ${result.label} (${moves} / par ${game.par})${hint}`, ...rows];
  if (url) lines.push(url);
  return lines.join('\n');
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or pages not served over https.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
