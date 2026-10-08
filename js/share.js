// Builds the spoiler-free text for the Share button.

import { gameResult } from './game.js';

// `title` is "Hole 47". One line per hidden word:
// 🟨 for each wrong guess, then 🟩 if it was guessed or ⬛ if it was not.
// No letters, so the answer is not given away.
export function buildShareText({ name, title, game, url }) {
  const result = gameResult(game);
  const strokes = game.status === 'won' ? game.strokes : 'X';
  const hint = game.hints.length > 0 ? ' 💡' : '';
  const rows = game.rows.map(
    (row) => '🟨'.repeat(row.misses.length) + (row.solved && !row.given ? '🟩' : row.given ? '' : '⬛')
  );
  const lines = [`${name} ${title} ⛳ ${result.label} (${strokes} / par ${game.par})${hint}`, ...rows];
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
