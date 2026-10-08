// Hole numbers and dates. Everything is in UTC so the whole world shares
// the same hole and it switches at midnight UTC.

import { CONFIG } from './config.js';

export const DAY_MS = 86400000;

export function launchMs() {
  const [y, m, d] = CONFIG.LAUNCH_DATE.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

const startOfUtcDay = (ms) => Math.floor(ms / DAY_MS) * DAY_MS;

// Hole number for a moment in time. Can be below 1 before launch day.
export const holeForMs = (ms) => Math.floor((startOfUtcDay(ms) - launchMs()) / DAY_MS) + 1;

export const todayHole = (now = Date.now()) => Math.max(1, holeForMs(now));

export const msForHole = (hole) => launchMs() + (hole - 1) * DAY_MS;

export const msUntilNextHole = (now = Date.now()) => startOfUtcDay(now) + DAY_MS - now;

// Midnight UTC on the Monday of the week containing `ms`.
export function mondayOf(ms) {
  const day = startOfUtcDay(ms);
  const daysSinceMonday = (new Date(day).getUTCDay() + 6) % 7;
  return day - daysSinceMonday * DAY_MS;
}

export const formatDate = (ms, options = { month: 'short', day: 'numeric' }) =>
  new Date(ms).toLocaleDateString(undefined, { timeZone: 'UTC', ...options });

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
