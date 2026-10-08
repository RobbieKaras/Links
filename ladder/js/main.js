// The game page: daily hole, practice mode and archive holes.

import { CONFIG } from './config.js';
import './site.js';
import { scoreTiles, GREEN, YELLOW, GRAY } from './tiles.js';
import { shortestPath } from './ladder.js';
import { decodeTarget, encodeTarget } from './codec.js';
import { createContext, generatePuzzle, mulberry32 } from './puzzle-gen.js';
import {
  RESULTS, createGame, submitGuess, gameResult, formatDiff, pickHintPosition,
} from './game.js';
import {
  DAY_MS, todayHole, msForHole, msUntilNextHole, mondayOf, launchMs, formatDate, formatCountdown,
} from './dates.js';
import { loadStore, saveStore, isFinished, computeStats, weekScorecard } from './storage.js';
import { buildShareText, copyText } from './share.js';
import { showHintAd } from './ads.js';

const $ = (id) => document.getElementById(id);

const ERRORS = {
  NOT_A_WORD: 'Not a word',
  NOT_ONE_LETTER: 'Change exactly one letter',
  ALREADY_USED: 'Already used',
};
const WORD_LENGTH = 4;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-']; // + is Enter, - is Backspace

let store;
let validWords; // Set of every allowed word
let ctx; // word graphs, for practice puzzles and shortest routes
let puzzles; // the daily holes
let mode; // 'daily' | 'archive' | 'practice'
let hole; // hole number (daily and archive)
let game;
let input = '';
let messageTimer;
let countdownTimer;

// ---------- Setup ----------

async function init() {
  const [valid, common, daily] = await Promise.all(
    ['data/valid.json', 'data/common.json', 'data/puzzles.json'].map((url) =>
      fetch(url).then((res) => res.json())
    )
  );
  validWords = new Set(valid);
  ctx = createContext(valid, common);
  puzzles = daily;
  store = loadStore();

  chooseMode();
  loadGame();
  buildKeyboard();
  bindEvents();
  render();
  if (game.status !== 'playing') showResult();
}

function chooseMode() {
  const params = new URLSearchParams(location.search);
  const today = todayHole();
  const requested = parseInt(params.get('hole'), 10);

  mode = 'daily';
  hole = today;
  if (params.get('mode') === 'practice') {
    mode = 'practice';
  } else if (requested >= 1 && requested < today) {
    // Past holes only. Anything else (including future holes) falls back to today.
    mode = 'archive';
    hole = requested;
  } else if (params.has('hole')) {
    history.replaceState(null, '', location.pathname);
  }
  const navId = { daily: 'nav-daily', practice: 'nav-practice', archive: 'nav-archive' }[mode];
  $(navId).setAttribute('aria-current', 'page');
}

function puzzleForHole(n) {
  // If the generated puzzles ever run out, start again from the first one.
  const p = puzzles[(n - 1) % puzzles.length];
  return { ...p, target: decodeTarget(p.target, p.hole) };
}

function newPracticePuzzle() {
  const rng = mulberry32(Math.floor(Math.random() * 2 ** 32));
  const p = generatePuzzle(rng, ctx, {
    minPath: CONFIG.MIN_PATH,
    maxPath: CONFIG.MAX_PATH,
    parOffset: CONFIG.PAR_OFFSET,
  });
  store.practice = { puzzle: { ...p, target: encodeTarget(p.target, 0) }, record: null };
  saveStore(store);
}

// A past hole that was finished on its own day is shown as it was played.
const playedOnDay = () => mode === 'archive' && isFinished(store.daily[hole]);

function loadGame() {
  input = '';
  if (mode === 'practice') {
    if (!store.practice) newPracticePuzzle();
    const p = store.practice.puzzle;
    game = createGame({ ...p, target: decodeTarget(p.target, 0) }, store.practice.record || {});
    return;
  }
  const record = mode === 'daily' || playedOnDay() ? store.daily[hole] : store.archive[hole];
  game = createGame(puzzleForHole(hole), record || {});
}

function persist() {
  const record = { guesses: game.guesses, hints: game.hints, status: game.status, par: game.par };
  if (mode === 'practice') store.practice.record = record;
  else if (mode === 'daily') store.daily[hole] = record;
  else store.archive[hole] = record;
  saveStore(store);
}

// ---------- Rendering ----------

function render(revealLast = false) {
  renderHoleBar();
  renderHint();
  renderBoard(revealLast);
  renderKeyboard();
  renderActions();
}

function renderHoleBar() {
  $('hole-title').textContent = mode === 'practice' ? 'Practice' : `Hole ${hole}`;
  $('hole-par').textContent = `Par ${game.par}`;
  const used = game.guesses.length;
  $('move-count').textContent =
    game.status === 'playing' ? `Move ${used + 1} of ${game.maxMoves}` : `${used} of ${game.maxMoves} moves`;
}

function tile(letter, color) {
  const el = document.createElement('div');
  el.className = 'tile' + (color ? ` ${color}` : '');
  el.textContent = letter;
  if (letter && color) el.setAttribute('aria-label', `${letter}, ${color}`);
  return el;
}

function row(label, tiles, extraClass = '') {
  const el = document.createElement('div');
  el.className = `row ${extraClass}`;
  const gutter = document.createElement('span');
  gutter.className = 'row-label';
  gutter.textContent = label;
  el.append(gutter, ...tiles, document.createElement('span'));
  return el;
}

const scoredRow = (label, word, extraClass) =>
  row(label, scoreTiles(word, game.target).map((color, i) => tile(word[i], color)), extraClass);

function renderBoard(revealLast) {
  const board = $('board');
  board.replaceChildren(scoredRow('Start', game.start));
  game.guesses.forEach((word, i) => {
    const isNewest = revealLast && i === game.guesses.length - 1;
    board.append(scoredRow(String(i + 1), word, isNewest ? 'reveal' : ''));
  });
  if (game.status === 'playing') {
    const tiles = [];
    for (let i = 0; i < WORD_LENGTH; i++) {
      const t = tile(input[i] || '', '');
      if (i === input.length) t.classList.add('cursor');
      tiles.push(t);
    }
    board.append(row(String(game.guesses.length + 1), tiles, 'input-row'));
  } else if (game.status === 'lost') {
    board.append(row('Target', [...game.target].map((letter) => tile(letter, GREEN)), 'answer-row'));
  }
  board.scrollTop = board.scrollHeight;
}

function renderHint() {
  const el = $('hint-row');
  el.hidden = game.hints.length === 0;
  if (el.hidden) return;
  const label = document.createElement('span');
  label.textContent = '💡 Hint';
  const tiles = [...game.target].map((letter, i) =>
    game.hints.includes(i) ? tile(letter, GREEN) : tile('', '')
  );
  el.replaceChildren(label, ...tiles);
}

function buildKeyboard() {
  const keyboard = $('keyboard');
  for (const letters of KEY_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';
    for (const ch of letters) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'key';
      if (ch === '+') {
        key.textContent = 'Enter';
        key.dataset.key = 'Enter';
        key.classList.add('wide');
      } else if (ch === '-') {
        key.textContent = '⌫';
        key.dataset.key = 'Backspace';
        key.setAttribute('aria-label', 'Backspace');
        key.classList.add('wide');
      } else {
        key.textContent = ch;
        key.dataset.key = ch;
      }
      rowEl.append(key);
    }
    keyboard.append(rowEl);
  }
}

// Colour each key by the best thing known about that letter so far.
function renderKeyboard() {
  const rank = { [GRAY]: 1, [YELLOW]: 2, [GREEN]: 3 };
  const best = {};
  for (const word of [game.start, ...game.guesses]) {
    scoreTiles(word, game.target).forEach((color, i) => {
      if (!best[word[i]] || rank[color] > rank[best[word[i]]]) best[word[i]] = color;
    });
  }
  for (const key of document.querySelectorAll('.key')) {
    key.classList.remove(GREEN, YELLOW, GRAY);
    if (best[key.dataset.key]) key.classList.add(best[key.dataset.key]);
  }
}

function renderActions() {
  const playing = game.status === 'playing';
  const hintsLeft = CONFIG.HINTS_PER_GAME - game.hints.length;
  const hintButton = $('hint-button');
  hintButton.hidden = !playing;
  hintButton.disabled = hintsLeft <= 0 || pickHintPosition(game) === -1;
  hintButton.textContent = hintsLeft > 0 ? '💡 Watch an ad for a hint' : '💡 Hint used';
  $('result-button').hidden = playing;
  $('new-practice-button').hidden = mode !== 'practice';
}

function showMessage(text) {
  const el = $('message');
  el.textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (el.textContent = ''), 2200);
}

function shakeInput() {
  const el = document.querySelector('.input-row');
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth; // restart the animation
  el.classList.add('shake');
}

// ---------- Playing ----------

function pressKey(key) {
  if (game.status !== 'playing') return;
  if (key === 'Enter') return submit();
  if (key === 'Backspace') input = input.slice(0, -1);
  else if (/^[a-z]$/.test(key) && input.length < WORD_LENGTH) input += key;
  else return;
  renderBoard(false);
}

function submit() {
  if (input.length < WORD_LENGTH) {
    showMessage('Not enough letters');
    shakeInput();
    return;
  }
  const outcome = submitGuess(game, input, validWords);
  if (!outcome.ok) {
    showMessage(ERRORS[outcome.error]);
    shakeInput();
    return;
  }
  input = '';
  persist();
  render(true);
  if (game.status !== 'playing') setTimeout(showResult, 1100);
}

async function useHint() {
  if (game.status !== 'playing' || game.hints.length >= CONFIG.HINTS_PER_GAME) return;
  const position = pickHintPosition(game);
  if (position === -1) return;
  const watched = await showHintAd($('hint-dialog'));
  if (!watched) return;
  game.hints.push(position);
  persist();
  render();
  showMessage(`Letter ${position + 1} is ${game.target[position].toUpperCase()}`);
}

function startNewPractice() {
  newPracticePuzzle();
  loadGame();
  $('result-dialog').close();
  render();
}

// ---------- Result, stats and scorecard dialogs ----------

function showResult() {
  const result = gameResult(game);
  const won = game.status === 'won';
  const moves = game.guesses.length;

  $('result-title').textContent = won ? `${result.label}!` : 'Out of moves';
  $('result-summary').textContent = won
    ? `${moves} ${moves === 1 ? 'move' : 'moves'} on a par ${game.par} (${formatDiff(result.diff)})`
    : `Scored as X on a par ${game.par} (${formatDiff(result.diff)})`;

  const target = $('result-target');
  target.hidden = won;
  target.textContent = `The target was ${game.target.toUpperCase()}`;

  // Prefer a route made of common words; one always exists for generated puzzles.
  const route =
    shortestPath(ctx.graphCommon, game.start, game.target) ||
    shortestPath(ctx.graphAll, game.start, game.target);
  $('result-route').hidden = !route;
  $('result-route').open = false;
  if (route) $('result-route-text').textContent = route.join(' → ').toUpperCase();

  $('share-status').textContent = '';
  $('result-again-button').hidden = mode !== 'practice';

  clearInterval(countdownTimer);
  $('next-hole').hidden = mode !== 'daily';
  if (mode === 'daily') {
    const tick = () => ($('next-hole-countdown').textContent = formatCountdown(msUntilNextHole()));
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  if (!$('result-dialog').open) $('result-dialog').showModal();
}

async function share() {
  const text = buildShareText({
    name: CONFIG.GAME_NAME,
    title: mode === 'practice' ? 'Practice' : `Hole ${hole}`,
    game,
    url: location.origin + location.pathname,
  });
  const ok = await copyText(text);
  $('share-status').textContent = ok ? 'Copied to clipboard' : 'Could not copy. Try a different browser.';
}

function showStats() {
  const stats = computeStats(store.daily, todayHole());
  const numbers = [
    [stats.played, 'Played'],
    [stats.played ? Math.round((100 * stats.won) / stats.played) : 0, 'Win %'],
    [stats.currentStreak, 'Current streak'],
    [stats.bestStreak, 'Best streak'],
  ];
  $('stats-numbers').replaceChildren(
    ...numbers.map(([value, label]) => {
      const el = document.createElement('div');
      el.innerHTML = '<strong></strong><span></span>';
      el.firstChild.textContent = value;
      el.lastChild.textContent = label;
      return el;
    })
  );

  const max = Math.max(1, ...Object.values(stats.results));
  $('stats-results').replaceChildren(
    ...RESULTS.map(({ key, label }) => {
      const count = stats.results[key];
      const el = document.createElement('div');
      el.className = 'result-line';
      el.innerHTML = '<span class="result-name"></span><span class="bar"><span></span></span><span class="result-count"></span>';
      el.children[0].textContent = label;
      el.children[1].firstChild.style.width = `${(100 * count) / max}%`;
      el.children[2].textContent = count;
      return el;
    })
  );
  $('stats-dialog').showModal();
}

let weekStart; // Monday (UTC) of the week being shown

function showScorecard() {
  weekStart = mondayOf(Date.now());
  renderScorecard();
  $('scorecard-dialog').showModal();
}

function renderScorecard() {
  const today = todayHole();
  const firstWeek = mondayOf(launchMs());
  const thisWeek = mondayOf(Date.now());
  const card = weekScorecard(store.daily, weekStart, today);

  $('week-label').textContent = `${formatDate(weekStart)} – ${formatDate(weekStart + 6 * DAY_MS)}`;
  $('week-prev').disabled = weekStart <= firstWeek;
  $('week-next').disabled = weekStart >= thisWeek;

  $('scorecard').replaceChildren(
    ...card.days.map((day) => {
      const el = document.createElement('div');
      el.className = `day ${day.state}`;
      let score = '';
      if (day.state === 'won') {
        score = formatDiff(day.diff);
        el.classList.add(day.diff < 0 ? 'under' : day.diff > 0 ? 'over' : 'even');
      } else if (day.state === 'lost') score = 'X';
      else if (day.state === 'missed') score = '–';
      else if (day.state === 'today') score = '·';
      el.innerHTML = '<span class="day-name"></span><span class="day-score"></span><span class="day-hole"></span>';
      el.children[0].textContent = formatDate(day.ms, { weekday: 'short' });
      el.children[1].textContent = score;
      el.children[2].textContent = day.state === 'none' ? '' : `#${day.hole}`;
      return el;
    })
  );
  $('week-total').textContent = card.played ? formatDiff(card.total) : '–';
}

// ---------- Events ----------

function bindEvents() {
  $('keyboard').addEventListener('click', (event) => {
    const key = event.target.closest('.key');
    if (key) pressKey(key.dataset.key);
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    // Let Enter activate a focused button or link instead of submitting a word.
    if (event.key === 'Enter' && event.target.closest('button, a') && !event.target.closest('.key')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'Enter' || key === 'Backspace' || /^[a-z]$/.test(key)) {
      event.preventDefault();
      pressKey(key);
    }
  });

  $('hint-button').addEventListener('click', useHint);
  $('result-button').addEventListener('click', showResult);
  $('new-practice-button').addEventListener('click', startNewPractice);
  $('result-again-button').addEventListener('click', startNewPractice);
  $('share-button').addEventListener('click', share);
  $('stats-button').addEventListener('click', showStats);
  $('scorecard-button').addEventListener('click', showScorecard);
  $('week-prev').addEventListener('click', () => {
    weekStart -= 7 * DAY_MS;
    renderScorecard();
  });
  $('week-next').addEventListener('click', () => {
    weekStart += 7 * DAY_MS;
    renderScorecard();
  });
  $('result-dialog').addEventListener('close', () => clearInterval(countdownTimer));
}

init().catch((error) => {
  console.error(error);
  $('message').textContent = 'Could not load the game. See the README for how to run it.';
});
