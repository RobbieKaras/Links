// Puzzle generation, shared by scripts/generate-puzzles.js (daily holes)
// and the browser (practice mode).

import { buildGraph, distancesFrom } from './ladder.js';

// Small seeded random number generator, so the same seed always produces
// the same puzzles.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export function createContext(validWords, commonWords) {
  return {
    common: commonWords,
    graphAll: buildGraph(validWords),
    graphCommon: buildGraph(commonWords),
  };
}

// Picks a target for `start`, or returns null if it has no suitable one.
//
// The shortest path is measured over ALL valid words, because players may
// use any of them. A target is only kept if a path of that same length
// also exists using common words alone, so par never depends on a player
// knowing an obscure word.
export function pickTarget(rng, ctx, start, { minPath, maxPath, exclude = new Set() }) {
  const distAll = distancesFrom(ctx.graphAll, start);
  const distCommon = distancesFrom(ctx.graphCommon, start);
  const byDistance = new Map();
  for (const [word, d] of distCommon) {
    if (d < minPath || d > maxPath || exclude.has(word)) continue;
    if (distAll.get(word) !== d) continue;
    if (!byDistance.has(d)) byDistance.set(d, []);
    byDistance.get(d).push(word);
  }
  if (byDistance.size === 0) return null;
  // Choose the distance first so short and long holes are equally likely.
  const shortest = pick(rng, [...byDistance.keys()].sort((a, b) => a - b));
  return { target: pick(rng, byDistance.get(shortest).sort()), shortest };
}

// One random puzzle (used by practice mode).
export function generatePuzzle(rng, ctx, opts) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const start = pick(rng, ctx.common);
    const found = pickTarget(rng, ctx, start, opts);
    if (found) return { start, ...found, par: found.shortest + opts.parOffset };
  }
  throw new Error('Could not generate a puzzle from these word lists');
}

// Generates `count` puzzles with no repeated target words, and no repeated
// start words until every start has had a turn.
export function generatePuzzles({ count, seed, ctx, minPath, maxPath, parOffset }) {
  const rng = mulberry32(seed);
  const usedTargets = new Set();
  let startPool = [];
  const puzzles = [];
  let failures = 0;

  while (puzzles.length < count) {
    if (startPool.length === 0) {
      startPool = [...ctx.common];
      for (let i = startPool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [startPool[i], startPool[j]] = [startPool[j], startPool[i]];
      }
    }
    const start = startPool.pop();
    const found = pickTarget(rng, ctx, start, { minPath, maxPath, exclude: usedTargets });
    if (!found) {
      if (++failures > count * 20) throw new Error('Not enough words to generate that many puzzles');
      continue;
    }
    usedTargets.add(found.target);
    puzzles.push({
      hole: puzzles.length + 1,
      start,
      target: found.target,
      shortest: found.shortest,
      par: found.shortest + parOffset,
    });
  }
  return puzzles;
}
