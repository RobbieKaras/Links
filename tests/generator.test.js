import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../js/config.js';
import { decodeTarget, encodeTarget } from '../js/codec.js';
import { createContext, generateChain, generatePuzzles, isUnambiguous, mulberry32 } from '../js/chain-gen.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const pairs = read('pairs.json');
const saved = read('puzzles.json');
const pairSet = new Set(pairs);
const ctx = createContext(pairs);

const options = {
  count: 60,
  seed: 12345,
  ctx,
  length: CONFIG.CHAIN_LENGTH,
  parOffset: CONFIG.PAR_OFFSET,
  maxWordLength: CONFIG.MAX_WORD_LENGTH,
};

function assertValidChain(words, length = CONFIG.CHAIN_LENGTH) {
  assert.equal(words.length, length);
  assert.equal(new Set(words).size, words.length, `repeated word in ${words.join(' ')}`);
  for (let i = 1; i < words.length; i++) {
    assert.ok(pairSet.has(`${words[i - 1]} ${words[i]}`), `"${words[i - 1]} ${words[i]}" is not a known pair`);
  }
  for (const word of words) {
    assert.ok(word.length >= 3 && word.length <= CONFIG.MAX_WORD_LENGTH, `${word} is the wrong length`);
  }
}

test('pair list is sane', () => {
  assert.ok(pairs.length > 1000);
  for (const pair of pairs) assert.match(pair, /^[a-z]+ [a-z]+$/);
  assert.equal(pairSet.size, pairs.length, 'no duplicate pairs');
});

test('same seed gives the same puzzles, different seed gives different ones', () => {
  assert.deepEqual(generatePuzzles(options), generatePuzzles(options));
  assert.notDeepEqual(generatePuzzles(options), generatePuzzles({ ...options, seed: 54321 }));
});

test('every chain is made of known pairs, with no repeated words', () => {
  const puzzles = generatePuzzles(options);
  assert.equal(puzzles.length, options.count);
  puzzles.forEach((p, i) => {
    assert.equal(p.hole, i + 1);
    assertValidChain(p.words);
  });
});

test('par is the number of hidden words plus the offset', () => {
  for (const p of generatePuzzles(options)) {
    assert.equal(p.par, CONFIG.CHAIN_LENGTH - 2 + CONFIG.PAR_OFFSET);
  }
  for (const p of generatePuzzles({ ...options, count: 10, length: 5, parOffset: 1 })) {
    assert.equal(p.par, 4);
    assertValidChain(p.words, 5);
  }
});

test('no two holes have the same chain', () => {
  const puzzles = generatePuzzles(options);
  assert.equal(new Set(puzzles.map((p) => p.words.join(' '))).size, puzzles.length);
});

test('no hidden word has a rival answer', () => {
  // Checked independently of isUnambiguous: look for any other word with
  // the same first letter that links to both neighbours.
  const allWords = [...new Set(pairs.flatMap((pair) => pair.split(' ')))];
  for (const p of generatePuzzles(options)) {
    for (let i = 1; i < p.words.length - 1; i++) {
      const rivals = allWords.filter(
        (word) =>
          word !== p.words[i] &&
          word[0] === p.words[i][0] &&
          pairSet.has(`${p.words[i - 1]} ${word}`) &&
          pairSet.has(`${word} ${p.words[i + 1]}`)
      );
      assert.deepEqual(rivals, [], `${p.words.join(' ')}: ${p.words[i]} has a rival`);
    }
  }
});

test('isUnambiguous spots a rival answer', () => {
  const small = createContext(['fire ball', 'fire bell', 'ball boy', 'bell boy', 'fire wood', 'wood work']);
  assert.equal(isUnambiguous(small, ['fire', 'ball', 'boy']), false);
  assert.equal(isUnambiguous(small, ['fire', 'wood', 'work']), true);
});

test('single chains follow the same rules', () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 20; i++) {
    const words = generateChain(rng, ctx, options);
    assertValidChain(words);
    assert.ok(isUnambiguous(ctx, words));
  }
});

test('word scrambling round-trips', () => {
  for (const key of [0, 1, 47, 730]) {
    assert.equal(decodeTarget(encodeTarget('butter', key), key), 'butter');
  }
  assert.notEqual(encodeTarget('butter', 1), 'butter');
});

test('data/puzzles.json covers at least a year and matches the generator', () => {
  assert.ok(saved.length >= 365);
  const fresh = generatePuzzles({ ...options, count: CONFIG.PUZZLE_COUNT, seed: CONFIG.PUZZLE_SEED });
  const decoded = saved.map((p) => ({
    ...p,
    words: p.words.map((word, i) => (i === 0 || i === p.words.length - 1 ? word : decodeTarget(word, p.hole + i))),
  }));
  assert.deepEqual(decoded, fresh, 'puzzles.json is out of date: run `npm run puzzles`');
});

test('hidden words are not stored in plain text', () => {
  const first = saved[0];
  const fresh = generatePuzzles({ ...options, count: 1, seed: CONFIG.PUZZLE_SEED })[0];
  assert.equal(first.words[0], fresh.words[0]);
  assert.equal(first.words.at(-1), fresh.words.at(-1));
  for (let i = 1; i < fresh.words.length - 1; i++) assert.notEqual(first.words[i], fresh.words[i]);
});
