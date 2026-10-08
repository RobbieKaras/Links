import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { validateMove, buildGraph, shortestPath, differsByOne } from '../js/ladder.js';
import { createGame, submitGuess, scoreResult, gameResult, formatDiff, pickHintPosition } from '../js/game.js';
import { DAY_MS, holeForMs, launchMs, mondayOf, msUntilNextHole } from '../js/dates.js';
import { computeStats, weekScorecard } from '../js/storage.js';
import { buildShareText } from '../js/share.js';

const words = new Set(['cold', 'cord', 'card', 'ward', 'word', 'wood', 'cole', 'bold', 'bolt']);
const puzzle = { start: 'cold', target: 'ward', par: 5 };

test('move validation gives the right error', () => {
  assert.equal(validateMove('cold', 'cxld', ['cold'], words), 'NOT_A_WORD');
  assert.equal(validateMove('cold', 'card', ['cold'], words), 'NOT_ONE_LETTER');
  assert.equal(validateMove('cold', 'cold', ['cold'], words), 'NOT_ONE_LETTER');
  assert.equal(validateMove('cord', 'cold', ['cold', 'cord'], words), 'ALREADY_USED');
  assert.equal(validateMove('cold', 'cord', ['cold'], words), null);
});

test('shortest path search', () => {
  const graph = buildGraph([...words]);
  const path = shortestPath(graph, 'cold', 'ward');
  assert.equal(path.length, 4); // 3 moves: via card or via word
  assert.equal(path[0], 'cold');
  assert.equal(path[3], 'ward');
  for (let i = 1; i < path.length; i++) assert.ok(differsByOne(path[i - 1], path[i]));
  assert.equal(shortestPath(buildGraph(['cold', 'fish']), 'cold', 'fish'), null);
});

test('winning a game', () => {
  const game = createGame(puzzle);
  assert.equal(game.maxMoves, 5 + CONFIG.MAX_MOVES_OVER_PAR);
  assert.deepEqual(submitGuess(game, 'card', words), { ok: false, error: 'NOT_ONE_LETTER' });
  assert.equal(game.guesses.length, 0, 'a rejected word does not use a move');
  for (const word of ['cord', 'card', 'ward']) assert.ok(submitGuess(game, word, words).ok);
  assert.equal(game.status, 'won');
  assert.deepEqual(gameResult(game), { key: 'eagle', label: 'Eagle', diff: -2 });
  assert.equal(submitGuess(game, 'word', words).ok, false);
});

test('running out of moves is a loss', () => {
  const game = createGame({ start: 'cold', target: 'wood', par: 1 - CONFIG.MAX_MOVES_OVER_PAR + 1 });
  assert.equal(game.maxMoves, 2);
  submitGuess(game, 'cord', words);
  assert.equal(game.status, 'playing');
  submitGuess(game, 'card', words);
  assert.equal(game.status, 'lost');
  assert.equal(gameResult(game).key, 'loss');
  assert.equal(gameResult(game).diff, CONFIG.LOSS_OVER_PAR);
});

test('golf result names', () => {
  const name = (moves, par) => scoreResult({ won: true, moves, par }).label;
  assert.equal(name(1, 5), 'Hole in One');
  assert.equal(name(2, 5), 'Albatross');
  assert.equal(name(3, 5), 'Eagle');
  assert.equal(name(4, 5), 'Birdie');
  assert.equal(name(5, 5), 'Par');
  assert.equal(name(6, 5), 'Bogey');
  assert.equal(name(7, 5), 'Double Bogey');
  assert.equal(name(8, 5), 'Triple Bogey');
  assert.equal(name(9, 5), 'Quadruple Bogey');
  assert.equal(scoreResult({ won: false, moves: 9, par: 5 }).label, 'X');
  assert.equal(formatDiff(0), 'E');
  assert.equal(formatDiff(3), '+3');
  assert.equal(formatDiff(-2), '-2');
});

test('hint picks the leftmost letter not yet known', () => {
  const game = createGame(puzzle); // cold vs ward: only D (position 3) is green
  assert.equal(pickHintPosition(game), 0);
  game.hints.push(0);
  assert.equal(pickHintPosition(game), 1);
  submitGuess(game, 'cord', words); // R is now green at position 2
  submitGuess(game, 'card', words); // A is now green at position 1
  assert.equal(pickHintPosition(game), -1);
});

test('share text has the result, squares and no letters', () => {
  const game = createGame(puzzle);
  for (const word of ['cord', 'card', 'ward']) submitGuess(game, word, words);
  game.hints.push(0);
  const text = buildShareText({ name: 'Placeholder', title: 'Hole 47', game });
  assert.equal(
    text,
    ['Placeholder Hole 47 ⛳ Eagle (3 / par 5) 💡', '⬛⬛⬛🟩', '⬛⬛🟩🟩', '⬛🟩🟩🟩', '🟩🟩🟩🟩'].join('\n')
  );
  for (const word of ['cold', 'cord', 'card', 'ward']) assert.ok(!text.toLowerCase().includes(word));

  const lost = createGame({ start: 'cold', target: 'wood', par: 5 }, { guesses: ['cord'], status: 'lost' });
  assert.match(buildShareText({ name: 'Placeholder', title: 'Hole 2', game: lost }), /^Placeholder Hole 2 ⛳ X \(X \/ par 5\)\n/);
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

const won = (moves, par = 5) => ({ status: 'won', par, guesses: new Array(moves).fill('xxxx'), hints: [] });
const lost = (par = 5) => ({ status: 'lost', par, guesses: new Array(par + 4).fill('xxxx'), hints: [] });

test('stats and streaks', () => {
  // Holes 1-2 won, 3 missed, 4 lost, 5-7 won, 8 (today) not played yet.
  const daily = { 1: won(5), 2: won(4), 4: lost(), 5: won(6), 6: won(5), 7: won(3) };
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
  assert.equal(computeStats({ ...daily, 8: { ...won(0), status: 'playing' } }, 8).played, 6);
});

test('weekly scorecard', () => {
  const monday = mondayOf(launchMs() + 14 * DAY_MS);
  const first = holeForMs(monday);
  // Mon birdie, Tue missed, Wed lost, Thu par, Fri is today (unfinished).
  const daily = { [first]: won(4), [first + 2]: lost(), [first + 3]: won(5) };
  const card = weekScorecard(daily, monday, first + 4);
  assert.deepEqual(card.days.map((d) => d.state), ['won', 'missed', 'lost', 'won', 'today', 'none', 'none']);
  assert.deepEqual(card.days.map((d) => d.diff), [-1, null, CONFIG.LOSS_OVER_PAR, 0, null, null, null]);
  assert.equal(card.total, -1 + CONFIG.LOSS_OVER_PAR);
  assert.equal(card.played, 3);
});
