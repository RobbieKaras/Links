// The whole game is this one page: the daily hole, archive holes that have
// been unlocked, and pop-ups for everything else.

import { CONFIG } from './config.js';
import './site.js';
import { decodeTarget } from './codec.js';
import {
  possibleResults, createGame, submitGuess, gameResult, formatDiff, revealedPrefix, rowWord, canHint, useHint,
} from './game.js';
import {
  DAY_MS, todayHole, msUntilNextHole, mondayOf, launchMs, formatDate, formatCountdown,
} from './dates.js';
import { loadStore, saveStore, isFinished, computeStats, weekScorecard } from './storage.js';
import { buildShareText, copyText } from './share.js';
import { showRewardAd } from './ads.js';
import { openArchive } from './archive.js';

const $ = (id) => document.getElementById(id);

const ERRORS = {
  EMPTY: 'Type your guess first',
  ALREADY_TRIED: 'Already tried',
};
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-']; // + is Enter, - is Backspace

let store;
let puzzles; // the daily holes
let mode; // 'daily' | 'archive'
let hole; // hole number (daily and archive)
let game;
let selected = 0; // which hidden row is being guessed
let input = ''; // letters typed after the revealed ones
let messageTimer;
let countdownTimer;

// ---------- Setup ----------

async function init() {
  puzzles = await fetch('data/puzzles.json').then((res) => res.json());
  store = loadStore();

  chooseMode();
  // Past holes have to be unlocked in the archive first. A link to a locked
  // one shows today's hole with the archive open instead.
  const locked = mode === 'archive' && !playedOnDay() && !store.archive[hole];
  if (locked) {
    mode = 'daily';
    hole = todayHole();
    history.replaceState(null, '', location.pathname);
  }
  loadGame();
  buildKeyboard();
  bindEvents();
  render();
  if (locked) openArchive(store, puzzles);
  else if (game.status !== 'playing') showResult();
}

function chooseMode() {
  const params = new URLSearchParams(location.search);
  const today = todayHole();
  const requested = parseInt(params.get('hole'), 10);

  mode = 'daily';
  hole = today;
  if (requested >= 1 && requested < today) {
    // Past holes only. Anything else (including future holes) falls back to today.
    mode = 'archive';
    hole = requested;
  } else if (params.has('hole')) {
    history.replaceState(null, '', location.pathname);
  }
}

function puzzleForHole(n) {
  // If the generated puzzles ever run out, start again from the first one.
  const p = puzzles[(n - 1) % puzzles.length];
  // Hidden words are stored scrambled; the first and last are stored as they are.
  const words = p.words.map((word, i) =>
    i === 0 || i === p.words.length - 1 ? word : decodeTarget(word, p.hole + i)
  );
  return { ...p, words };
}

// A past hole that was finished on its own day is shown as it was played.
const playedOnDay = () => mode === 'archive' && isFinished(store.daily[hole]);

function loadGame() {
  input = '';
  const record = mode === 'daily' || playedOnDay() ? store.daily[hole] : store.archive[hole];
  game = createGame(puzzleForHole(hole), record || {});
  selected = 0;
  selectNextOpen(0);
}

function persist() {
  const record = {
    rows: game.rows, hints: game.hints, strokes: game.strokes, status: game.status, par: game.par,
  };
  if (mode === 'daily') store.daily[hole] = record;
  else store.archive[hole] = record;
  saveStore(store);
}

// Moves the selection to the first unsolved row at or after `from`, wrapping round.
function selectNextOpen(from) {
  const count = game.rows.length;
  for (let step = 0; step < count; step++) {
    const r = (from + step + count) % count;
    if (!game.rows[r].solved) {
      selected = r;
      return;
    }
  }
}

function selectRow(r) {
  if (game.status !== 'playing' || game.rows[r].solved || r === selected) return;
  selected = r;
  input = '';
  render();
}

function moveSelection(direction) {
  const count = game.rows.length;
  for (let step = 1; step <= count; step++) {
    const r = (selected + direction * step + count * step) % count;
    if (!game.rows[r].solved) return selectRow(r);
  }
}

// ---------- Rendering ----------

function render() {
  renderHoleBar();
  renderBoard();
  renderTried();
  renderActions();
}

function renderHoleBar() {
  $('hole-title').textContent = `Hole ${hole}`;
  $('hole-par').textContent = `Par ${game.par}`;
  $('back-today').hidden = mode !== 'archive';
  $('move-count').textContent =
    game.status === 'playing'
      ? `Stroke ${game.strokes + 1} of ${game.maxStrokes}`
      : `${game.strokes} of ${game.maxStrokes} strokes`;
}

function tile(letter, kind) {
  const el = document.createElement('span');
  el.className = `tile ${kind}`;
  el.textContent = letter;
  return el;
}

const wordTiles = (word, kind) => [...word].map((letter) => tile(letter, kind));

function renderBoard() {
  const board = $('board');
  const last = game.words.length - 1;
  const playing = game.status === 'playing';

  board.replaceChildren(
    ...game.words.map((word, i) => {
      const el = document.createElement('div');
      el.className = 'chain-row';
      if (i === 0 || i === last) {
        el.classList.add('shown');
        el.append(...wordTiles(word, 'shown'));
        el.setAttribute('aria-label', word);
        return el;
      }

      const r = i - 1;
      const row = game.rows[r];
      if (row.solved) {
        el.classList.add('done');
        el.append(...wordTiles(word, row.given ? 'given' : 'solved'));
      } else if (!playing) {
        el.classList.add('done');
        el.append(...wordTiles(word, 'missed'));
      } else {
        el.dataset.row = r;
        el.classList.add('open');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `Word ${i + 1}, starts with ${revealedPrefix(game, r)}`);
        el.append(...wordTiles(revealedPrefix(game, r), 'revealed'));
        if (r === selected) {
          el.classList.add('selected');
          el.append(...wordTiles(input, 'typed'));
          const full = revealedPrefix(game, r).length + input.length >= CONFIG.MAX_WORD_LENGTH;
          if (!full) el.append(tile('', 'cursor'));
        } else {
          el.append(tile('…', 'more'));
        }
      }
      if (row.misses.length > 0) {
        const misses = document.createElement('span');
        misses.className = 'miss-count';
        misses.textContent = `✕${row.misses.length}`;
        misses.setAttribute('aria-label', `${row.misses.length} wrong`);
        el.append(misses);
      }
      return el;
    })
  );
  const active = board.querySelector('.selected');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

// Wrong guesses already made for the selected word.
function renderTried() {
  const misses = game.status === 'playing' ? game.rows[selected].misses : [];
  $('tried').textContent = misses.length ? `Tried: ${misses.join(', ').toUpperCase()}` : '';
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

function renderActions() {
  const playing = game.status === 'playing';
  const hintButton = $('hint-button');
  hintButton.hidden = !playing;
  hintButton.disabled = !playing || !canHint(game, selected);
  hintButton.textContent =
    game.hints.length < CONFIG.HINTS_PER_GAME ? '💡 Watch an ad for a hint' : '💡 Hint used';
  $('result-button').hidden = playing;
}

function showMessage(text) {
  const el = $('message');
  el.textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (el.textContent = ''), 2200);
}

function shakeSelected() {
  const el = document.querySelector('.chain-row.selected');
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth; // restart the animation
  el.classList.add('shake');
}

// ---------- Playing ----------

function pressKey(key) {
  if (game.status !== 'playing') return;
  if (key === 'Enter') return submit();
  const room = CONFIG.MAX_WORD_LENGTH - revealedPrefix(game, selected).length;
  if (key === 'Backspace') input = input.slice(0, -1);
  else if (/^[a-z]$/.test(key) && input.length < room) input += key;
  else return;
  renderBoard();
}

function submit() {
  const r = selected;
  const outcome = submitGuess(game, r, revealedPrefix(game, r) + input);
  if (!outcome.ok) {
    showMessage(ERRORS[outcome.error]);
    shakeSelected();
    return;
  }
  input = '';
  persist();

  if (game.status === 'playing') {
    if (outcome.correct) showMessage('');
    else if (game.rows[r].given) showMessage(`It was ${rowWord(game, r).toUpperCase()}`);
    else showMessage('Not it. Here is another letter.');
    if (game.rows[r].solved) selectNextOpen(r);
  }
  render();
  if (!outcome.correct && !game.rows[r].solved) shakeSelected();
  if (game.status !== 'playing') setTimeout(showResult, 900);
}

async function hint() {
  const r = selected;
  if (!canHint(game, r)) return;
  $('ad-reward').textContent = 'Your hint arrives';
  const watched = await showRewardAd($('ad-dialog'));
  if (!watched || !useHint(game, r)) return;
  input = '';
  persist();
  render();
}

// ---------- Result, stats and scorecard dialogs ----------

function showResult() {
  const result = gameResult(game);
  const won = game.status === 'won';

  $('result-title').textContent = won ? `${result.label}!` : 'Out of strokes';
  $('result-summary').textContent = won
    ? `${game.strokes} ${game.strokes === 1 ? 'stroke' : 'strokes'} on a par ${game.par} (${formatDiff(result.diff)})`
    : `Scored as X on a par ${game.par} (${formatDiff(result.diff)})`;
  $('result-chain').textContent = game.words.join(' → ').toUpperCase();

  $('share-status').textContent = '';

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
    title: `Hole ${hole}`,
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
    ...possibleResults().map(({ key, label }) => {
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

  $('board').addEventListener('click', (event) => {
    const rowEl = event.target.closest('.chain-row.open');
    if (rowEl) selectRow(Number(rowEl.dataset.row));
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (game.status !== 'playing') return;
    // Let Enter activate a focused button or link instead of submitting a word.
    if (event.key === 'Enter' && event.target.closest('button, a') && !event.target.closest('.key')) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'Enter' || key === 'Backspace' || /^[a-z]$/.test(key)) {
      event.preventDefault();
      pressKey(key);
    }
  });

  $('hint-button').addEventListener('click', hint);
  $('result-button').addEventListener('click', showResult);
  $('share-button').addEventListener('click', share);
  $('stats-button').addEventListener('click', showStats);
  $('archive-button').addEventListener('click', () => openArchive(store, puzzles));
  $('howto-button').addEventListener('click', () => $('howto-dialog').showModal());
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
