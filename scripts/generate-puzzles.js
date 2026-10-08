// Generates the daily puzzles into data/puzzles.json.
//
//   npm run puzzles
//
// The output is the same every time for the same pairs and config, so
// re-running it never changes holes people have already played unless you
// change pairs.txt, CHAIN_LENGTH, MAX_WORD_LENGTH or PUZZLE_SEED.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../js/config.js';
import { encodeTarget } from '../js/codec.js';
import { createContext, generatePuzzles } from '../js/chain-gen.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pairs = JSON.parse(readFileSync(join(ROOT, 'data', 'pairs.json'), 'utf8'));

const puzzles = generatePuzzles({
  count: CONFIG.PUZZLE_COUNT,
  seed: CONFIG.PUZZLE_SEED,
  ctx: createContext(pairs),
  length: CONFIG.CHAIN_LENGTH,
  parOffset: CONFIG.PAR_OFFSET,
  maxWordLength: CONFIG.MAX_WORD_LENGTH,
});

// The hidden words are stored lightly scrambled (see js/codec.js).
const out = puzzles.map((p) => ({
  ...p,
  words: p.words.map((word, i) => (i === 0 || i === p.words.length - 1 ? word : encodeTarget(word, p.hole + i))),
}));
writeFileSync(
  join(ROOT, 'data', 'puzzles.json'),
  '[\n' + out.map((p) => JSON.stringify(p)).join(',\n') + '\n]\n'
);

const uses = new Map();
for (const p of puzzles) {
  p.words.slice(1).forEach((word, i) => {
    const link = `${p.words[i]} ${word}`;
    uses.set(link, (uses.get(link) || 0) + 1);
  });
}
console.log(`Wrote ${puzzles.length} puzzles to data/puzzles.json`);
console.log(`Pairs used: ${uses.size} of ${pairs.length}. Most-used pair appears ${Math.max(...uses.values())} times.`);
console.log('First five:');
for (const p of puzzles.slice(0, 5)) console.log('  ' + p.words.join(' > '));
