// Game state and golf scoring. No DOM code in here, so it can be tested.

import { CONFIG } from './config.js';
import { scoreTiles, GREEN } from './tiles.js';
import { validateMove } from './ladder.js';

export function createGame({ start, target, par }, saved = {}) {
  return {
    start,
    target,
    par,
    maxMoves: par + CONFIG.MAX_MOVES_OVER_PAR,
    guesses: saved.guesses ? [...saved.guesses] : [],
    hints: saved.hints ? [...saved.hints] : [],
    status: saved.status || 'playing', // 'playing' | 'won' | 'lost'
  };
}

export const currentWord = (game) => game.guesses[game.guesses.length - 1] || game.start;

// Tries to play `word`. Returns { ok: true } or { ok: false, error }.
export function submitGuess(game, word, validWords) {
  if (game.status !== 'playing') return { ok: false, error: 'GAME_OVER' };
  const error = validateMove(currentWord(game), word, [game.start, ...game.guesses], validWords);
  if (error) return { ok: false, error };

  game.guesses.push(word);
  if (word === game.target) game.status = 'won';
  else if (game.guesses.length >= game.maxMoves) game.status = 'lost';
  return { ok: true };
}

// Order used wherever results are listed (stats, etc).
export const RESULTS = [
  { key: 'holeInOne', label: 'Hole in One' },
  { key: 'albatross', label: 'Albatross' },
  { key: 'eagle', label: 'Eagle' },
  { key: 'birdie', label: 'Birdie' },
  { key: 'par', label: 'Par' },
  { key: 'bogey', label: 'Bogey' },
  { key: 'double', label: 'Double Bogey' },
  { key: 'triple', label: 'Triple Bogey' },
  { key: 'quad', label: 'Quadruple Bogey' },
  { key: 'loss', label: 'X (out of moves)' },
];

const KEY_BY_DIFF = { '-2': 'eagle', '-1': 'birdie', 0: 'par', 1: 'bogey', 2: 'double', 3: 'triple' };

// The golf result for a finished game: { key, label, diff }.
// `diff` is the score relative to par that counts toward the weekly total.
export function scoreResult({ won, moves, par }) {
  if (!won) return { key: 'loss', label: 'X', diff: CONFIG.LOSS_OVER_PAR };
  const diff = moves - par;
  let key;
  if (moves === 1) key = 'holeInOne';
  else if (diff <= -3) key = 'albatross';
  else if (diff >= 4) key = 'quad';
  else key = KEY_BY_DIFF[diff];
  let label = RESULTS.find((r) => r.key === key).label;
  if (diff > 4) label = `+${diff}`;
  return { key, label, diff };
}

export const gameResult = (game) =>
  scoreResult({ won: game.status === 'won', moves: game.guesses.length, par: game.par });

// "E" for even par, otherwise "+3" or "-2".
export function formatDiff(diff) {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// Which letter position a hint should reveal: the leftmost one the player
// has not already turned green or been given. Returns -1 if none is left.
export function pickHintPosition(game) {
  const known = new Set(game.hints);
  for (const word of [game.start, ...game.guesses]) {
    scoreTiles(word, game.target).forEach((color, i) => {
      if (color === GREEN) known.add(i);
    });
  }
  for (let i = 0; i < game.target.length; i++) {
    if (!known.has(i)) return i;
  }
  return -1;
}
