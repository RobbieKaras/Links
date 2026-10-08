// Everything saved in the browser (localStorage), plus the stats and
// weekly scorecard that are worked out from it.
//
// Saved shape:
//   daily:    { [hole]: record }  games played on the day itself
//   archive:  { [hole]: record }  past holes played later (never count for stats)
//   practice: { puzzle, record }  the practice game in progress
// A record is { guesses, hints, status, par }.

import { RESULTS, scoreResult } from './game.js';
import { DAY_MS, holeForMs } from './dates.js';

const STORAGE_KEY = 'wordgolf:v1';

export function loadStore() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    // Storage blocked or corrupted: start fresh.
  }
  return { daily: {}, archive: {}, practice: null, ...saved };
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked (e.g. private browsing): the game still works.
  }
}

export const isFinished = (record) => !!record && record.status !== 'playing';

export const recordResult = (record) =>
  scoreResult({ won: record.status === 'won', moves: record.guesses.length, par: record.par });

// Stats for daily games only. A streak is a run of consecutive holes won.
export function computeStats(daily, currentHole) {
  const results = Object.fromEntries(RESULTS.map((r) => [r.key, 0]));
  let played = 0;
  let won = 0;
  let streak = 0;
  let bestStreak = 0;
  let currentStreak = 0;

  for (let hole = 1; hole <= currentHole; hole++) {
    const record = daily[hole];
    if (isFinished(record)) {
      played++;
      results[recordResult(record).key]++;
    }
    if (record && record.status === 'won') {
      won++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else if (hole < currentHole || isFinished(record)) {
      // Today's hole only breaks the streak once it has been lost.
      streak = 0;
    }
    currentStreak = streak;
  }
  return { played, won, currentStreak, bestStreak, results };
}

// The Monday-Sunday scorecard for the week starting at `mondayMs`.
// Each day has a `state`:
//   'won' | 'lost'  finished on the day (with `diff` relative to par)
//   'today'         today's hole, not finished yet
//   'missed'        a past day that was not finished on the day
//   'none'          before launch day, or in the future
export function weekScorecard(daily, mondayMs, currentHole) {
  const days = [];
  let total = 0;
  let played = 0;

  for (let i = 0; i < 7; i++) {
    const ms = mondayMs + i * DAY_MS;
    const hole = holeForMs(ms);
    const day = { ms, hole, state: 'none', diff: null };
    if (hole >= 1 && hole <= currentHole) {
      const record = daily[hole];
      if (isFinished(record)) {
        day.state = record.status;
        day.diff = recordResult(record).diff;
        total += day.diff;
        played++;
      } else {
        day.state = hole === currentHole ? 'today' : 'missed';
      }
    }
    days.push(day);
  }
  return { days, total, played };
}
