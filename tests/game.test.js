import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import {
  createGame, submitGuess, scoreResult, gameResult, formatDiff, revealedPrefix, canHint, useHint,
  possibleResults,
} from '../js/game.js';
import { DAY_MS, holeForMs, launchMs, mondayOf, msUntilNextHole } from '../js/dates.js';
import { computeStats, weekScorecard } from '../js/storage.js';
import { buildShareText } from '../js/share.js';

const puzzle = { words: ['peanut', 'butter', 'cup', 'cake', 'pop', 'star'], par: 6 };

test('a new game hides the middle words behind their first letter', () => {
  const game = createGame(puzzle);
  assert.equal(game.rows.length, 4);
  assert.equal(game.maxStrokes, 6 + CONFIG.MAX_STROKES_OVER_PAR);
  assert.deepEqual([0, 1, 2, 3].map((r) => revealedPrefix(game, r)), ['b', 'c', 'c', 'p']);
});

test('a perfect round: every guess is one stroke', () => {
  const game = createGame(puzzle);
  // Words can be solved in any order.
  for (const [r, word] of [[3, 'pop'], [0, 'butter'], [2, 'cake'], [1, 'cup']]) {
    assert.deepEqual(submitGuess(game, r, word), { ok: true, correct: true });
  }
  assert.equal(game.status, 'won');
  assert.equal(game.strokes, 4);
  assert.deepEqual(gameResult(game), { key: 'eagle', label: 'Eagle', diff: -2 });
  assert.equal(submitGuess(game, 0, 'butter').ok, false);
});

test('a wrong guess costs a stroke and reveals the next letter', () => {
  const game = createGame(puzzle);
  assert.deepEqual(submitGuess(game, 0, 'brittle'), { ok: true, correct: false });
  assert.equal(game.strokes, 1);
  assert.equal(revealedPrefix(game, 0), 'bu');
  assert.equal(revealedPrefix(game, 1), 'c', 'other words are not affected');
});

test('rejected guesses do not cost a stroke', () => {
  const game = createGame(puzzle);
  assert.deepEqual(submitGuess(game, 0, 'b'), { ok: false, error: 'EMPTY' });
  submitGuess(game, 0, 'brittle');
  assert.deepEqual(submitGuess(game, 0, 'brittle'), { ok: false, error: 'ALREADY_TRIED' });
  assert.deepEqual(submitGuess(game, 0, 'bu'), { ok: false, error: 'EMPTY' });
  assert.equal(game.strokes, 1);
});

test('a word whose letters are all revealed is filled in', () => {
  const game = createGame(puzzle);
  submitGuess(game, 1, 'cat'); // reveals CU
  assert.equal(game.rows[1].solved, false);
  submitGuess(game, 1, 'cub'); // reveals CUP: nothing left to guess
  assert.equal(game.rows[1].solved, true);
  assert.equal(game.rows[1].given, true);
  assert.equal(game.strokes, 2);
});

test('running out of strokes is a loss', () => {
  const game = createGame({ ...puzzle, par: 3 - CONFIG.MAX_STROKES_OVER_PAR });
  assert.equal(game.maxStrokes, 3);
  submitGuess(game, 0, 'ball');
  submitGuess(game, 0, 'bubble');
  assert.equal(game.status, 'playing');
  submitGuess(game, 0, 'butler');
  assert.equal(game.status, 'lost');
  assert.equal(gameResult(game).key, 'loss');
  assert.equal(gameResult(game).diff, CONFIG.LOSS_OVER_PAR);
});

test('a hint reveals a letter for free, once, and never the whole word', () => {
  const game = createGame(puzzle);
  assert.equal(canHint(game, 0), true);
  assert.equal(canHint(game, 1), true); // CUP: C shown, a hint would show CU
  assert.equal(useHint(game, 0), true);
  assert.equal(revealedPrefix(game, 0), 'bu');
  assert.equal(game.strokes, 0);
  assert.equal(canHint(game, 0), false, 'only one hint per game');
  assert.equal(useHint(game, 2), false);

  const other = createGame(puzzle);
  submitGuess(other, 1, 'cat'); // CU shown: one more letter would finish the word
  assert.equal(canHint(other, 1), false);
});

test('a saved game is restored', () => {
  const game = createGame(puzzle);
  submitGuess(game, 0, 'brittle');
  submitGuess(game, 3, 'pop');
  useHint(game, 2);
  const saved = JSON.parse(JSON.stringify({
    rows: game.rows, hints: game.hints, strokes: game.strokes, status: game.status, par: game.par,
  }));
  const restored = createGame(puzzle, saved);
  assert.deepEqual(restored, game);
});

test('golf result names', () => {
  const name = (strokes, par) => scoreResult({ won: true, strokes, par }).label;
  assert.equal(name(1, 6), 'Hole in One');
  assert.equal(name(3, 6), 'Albatross');
  assert.equal(name(4, 6), 'Eagle');
  assert.equal(name(5, 6), 'Birdie');
  assert.equal(name(6, 6), 'Par');
  assert.equal(name(7, 6), 'Bogey');
  assert.equal(name(8, 6), 'Double Bogey');
  assert.equal(name(9, 6), 'Triple Bogey');
  assert.equal(name(10, 6), 'Quadruple Bogey');
  assert.equal(scoreResult({ won: false, strokes: 10, par: 6 }).label, 'X');
  assert.equal(formatDiff(0), 'E');
  assert.equal(formatDiff(3), '+3');
  assert.equal(formatDiff(-2), '-2');
});

test('stats only list results that can happen', () => {
  // The best possible round is one stroke per hidden word, which is an Eagle.
  assert.deepEqual(
    possibleResults().map((r) => r.key),
    ['eagle', 'birdie', 'par', 'bogey', 'double', 'triple', 'quad', 'loss']
  );
});

test('share text has the result and squares, but no letters', () => {
  const game = createGame(puzzle);
  submitGuess(game, 0, 'brittle');
  submitGuess(game, 0, 'butter');
  submitGuess(game, 1, 'cup');
  submitGuess(game, 2, 'cake');
  useHint(game, 3);
  submitGuess(game, 3, 'pop');
  const text = buildShareText({ name: 'Links', title: 'Hole 47', game });
  assert.equal(text, ['Links Hole 47 ⛳ Birdie (5 / par 6) 💡', '🟨🟩', '🟩', '🟩', '🟩'].join('\n'));
  for (const word of puzzle.words) assert.ok(!text.toLowerCase().includes(word));

  const lost = createGame({ ...puzzle, par: 2 - CONFIG.MAX_STROKES_OVER_PAR });
  submitGuess(lost, 0, 'butter');
  submitGuess(lost, 1, 'cat');
  assert.equal(lost.status, 'lost');
  assert.equal(
    buildShareText({ name: 'Links', title: 'Hole 2', game: lost }),
    [`Links Hole 2 ⛳ X (X / par ${lost.par})`, '🟩', '🟨⬛', '⬛', '⬛'].join('\n')
  );
});

test('holes change at midnight UTC', () => {
  const launch = launchMs();
  assert.equal(holeForMs(launch), 1);
  assert.equal(holeForMs(launch + DAY_MS - 1), 1);
  assert.equal(holeForMs(launch + DAY_MS), 2);
  assert.equal(holeForMs(launch - 1), 0);
  assert.equal(msUntilNextHole(launch + DAY_MS - 1000), 1000);
  assert.equal(new Date(mondayOf(launch)).getUTCDay(), 1);
});

const won = (strokes, par = 6) => ({ status: 'won', par, strokes, rows: [], hints: [] });
const lost = (par = 6) => ({ status: 'lost', par, strokes: par + 4, rows: [], hints: [] });

test('stats and streaks', () => {
  // Holes 1-2 won, 3 missed, 4 lost, 5-7 won, 8 (today) not played yet.
  const daily = { 1: won(6), 2: won(5), 4: lost(), 5: won(7), 6: won(6), 7: won(4) };
  const stats = computeStats(daily, 8);
  assert.equal(stats.played, 6);
  assert.equal(stats.won, 5);
  assert.equal(stats.currentStreak, 3, 'an unplayed hole today does not break the streak');
  assert.equal(stats.bestStreak, 3);
  assert.equal(stats.results.par, 2);
  assert.equal(stats.results.birdie, 1);
  assert.equal(stats.results.bogey, 1);
  assert.equal(stats.results.eagle, 1);
  assert.equal(stats.results.loss, 1);

  assert.equal(computeStats(daily, 9).currentStreak, 0, 'missing a day breaks the streak');
  assert.equal(computeStats({ ...daily, 8: lost() }, 8).currentStreak, 0);
  assert.equal(computeStats({ ...daily, 8: { ...won(2), status: 'playing' } }, 8).played, 6);
});

test('weekly scorecard', () => {
  const monday = mondayOf(launchMs() + 14 * DAY_MS);
  const first = holeForMs(monday);
  // Mon birdie, Tue missed, Wed lost, Thu par, Fri is today (unfinished).
  const daily = { [first]: won(5), [first + 2]: lost(), [first + 3]: won(6) };
  const card = weekScorecard(daily, monday, first + 4);
  assert.deepEqual(card.days.map((d) => d.state), ['won', 'missed', 'lost', 'won', 'today', 'none', 'none']);
  assert.deepEqual(card.days.map((d) => d.diff), [-1, null, CONFIG.LOSS_OVER_PAR, 0, null, null, null]);
  assert.equal(card.total, -1 + CONFIG.LOSS_OVER_PAR);
  assert.equal(card.played, 3);
});
