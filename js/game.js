// Game state and golf scoring. No DOM code in here, so it can be tested.
//
// A chain is a list of words. The first and last are shown; the ones in
// between are hidden and each gets a "row". Row 0 is the second word.

import { CONFIG } from './config.js';

export function createGame({ words, par }, saved = {}) {
  return {
    words,
    par,
    maxStrokes: par + CONFIG.MAX_STROKES_OVER_PAR,
    // misses: wrong guesses for this word. given: all its letters ended
    // up revealed, so it was filled in without being guessed.
    rows: words.slice(1, -1).map((_, i) => {
      const row = saved.rows ? saved.rows[i] : null;
      return { misses: row ? [...row.misses] : [], solved: !!row && row.solved, given: !!row && row.given };
    }),
    hints: saved.hints ? [...saved.hints] : [], // row index of each hint used
    strokes: saved.strokes || 0,
    status: saved.status || 'playing', // 'playing' | 'won' | 'lost'
  };
}

export const rowWord = (game, r) => game.words[r + 1];

// How many letters of a hidden word are showing: the first letter, plus
// one for every wrong guess and every hint.
export function revealedCount(game, r) {
  const hints = game.hints.filter((row) => row === r).length;
  return Math.min(rowWord(game, r).length, 1 + game.rows[r].misses.length + hints);
}

export const revealedPrefix = (game, r) => rowWord(game, r).slice(0, revealedCount(game, r));

function settle(game, r) {
  const row = game.rows[r];
  if (!row.solved && revealedCount(game, r) >= rowWord(game, r).length) {
    row.solved = true;
    row.given = true;
  }
  if (game.rows.every((each) => each.solved)) game.status = 'won';
  else if (game.strokes >= game.maxStrokes) game.status = 'lost';
}

// Guesses `word` for hidden row `r`. Every guess, right or wrong, costs a
// stroke. A wrong guess reveals the next letter.
// Returns { ok: true, correct } or { ok: false, error }.
export function submitGuess(game, r, word) {
  const row = game.rows[r];
  if (game.status !== 'playing' || row.solved) return { ok: false, error: 'DONE' };
  if (word.length <= revealedCount(game, r)) return { ok: false, error: 'EMPTY' };
  if (row.misses.includes(word)) return { ok: false, error: 'ALREADY_TRIED' };

  game.strokes++;
  const correct = word === rowWord(game, r);
  if (correct) row.solved = true;
  else row.misses.push(word);
  settle(game, r);
  return { ok: true, correct };
}

// A hint reveals one more letter for free, but never the whole word.
export const canHint = (game, r) =>
  game.status === 'playing' &&
  game.hints.length < CONFIG.HINTS_PER_GAME &&
  !game.rows[r].solved &&
  revealedCount(game, r) < rowWord(game, r).length - 1;

export function useHint(game, r) {
  if (!canHint(game, r)) return false;
  game.hints.push(r);
  return true;
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
  { key: 'loss', label: 'X (out of strokes)' },
];

// The results a player can actually get with the current settings. The
// fewest possible strokes is one per hidden word, so with the default
// settings a Hole in One and an Albatross can never happen.
export function possibleResults() {
  const hidden = CONFIG.CHAIN_LENGTH - 2;
  const impossible = new Set();
  if (hidden !== 1) impossible.add('holeInOne');
  if (CONFIG.PAR_OFFSET < 3 || hidden === 1) impossible.add('albatross');
  if (CONFIG.PAR_OFFSET < 2) impossible.add('eagle');
  if (CONFIG.PAR_OFFSET < 1) impossible.add('birdie');
  return RESULTS.filter((result) => !impossible.has(result.key));
}

const KEY_BY_DIFF = { '-2': 'eagle', '-1': 'birdie', 0: 'par', 1: 'bogey', 2: 'double', 3: 'triple' };

// The golf result for a finished game: { key, label, diff }.
// `diff` is the score relative to par that counts toward the weekly total.
export function scoreResult({ won, strokes, par }) {
  if (!won) return { key: 'loss', label: 'X', diff: CONFIG.LOSS_OVER_PAR };
  const diff = strokes - par;
  let key;
  if (strokes === 1) key = 'holeInOne';
  else if (diff <= -3) key = 'albatross';
  else if (diff >= 4) key = 'quad';
  else key = KEY_BY_DIFF[diff];
  let label = RESULTS.find((r) => r.key === key).label;
  if (diff > 4) label = `+${diff}`;
  return { key, label, diff };
}

export const gameResult = (game) =>
  scoreResult({ won: game.status === 'won', strokes: game.strokes, par: game.par });

// "E" for even par, otherwise "+3" or "-2".
export function formatDiff(diff) {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}
