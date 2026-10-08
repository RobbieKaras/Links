// Generates the daily puzzles into data/puzzles.json.
//
//   npm run puzzles
//
// The output is the same every time for the same word lists and config,
// so re-running it never changes holes people have already played unless
// you change the word lists, PUZZLE_SEED, MIN_PATH or MAX_PATH.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../js/config.js';
import { encodeTarget } from '../js/codec.js';
import { createContext, generatePuzzles } from '../js/puzzle-gen.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(join(ROOT, 'data', name), 'utf8'));

const puzzles = generatePuzzles({
  count: CONFIG.PUZZLE_COUNT,
  seed: CONFIG.PUZZLE_SEED,
  ctx: createContext(read('valid.json'), read('common.json')),
  minPath: CONFIG.MIN_PATH,
  maxPath: CONFIG.MAX_PATH,
  parOffset: CONFIG.PAR_OFFSET,
});

// Targets are stored lightly scrambled (see js/codec.js).
const out = puzzles.map((p) => ({ ...p, target: encodeTarget(p.target, p.hole) }));
writeFileSync(
  join(ROOT, 'data', 'puzzles.json'),
  '[\n' + out.map((p) => JSON.stringify(p)).join(',\n') + '\n]\n'
);

const counts = {};
for (const p of puzzles) counts[p.par] = (counts[p.par] || 0) + 1;
console.log(`Wrote ${puzzles.length} puzzles to data/puzzles.json`);
console.log('Holes at each par:', counts);
console.log('First five:', puzzles.slice(0, 5).map((p) => `${p.start}->${p.target} (par ${p.par})`).join(', '));
