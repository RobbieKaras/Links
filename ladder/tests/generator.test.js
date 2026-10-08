import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../js/config.js';
import { decodeTarget, encodeTarget } from '../js/codec.js';
import { differsByOne } from '../js/ladder.js';
import { createContext, generatePuzzle, generatePuzzles, mulberry32 } from '../js/puzzle-gen.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const valid = read('valid.json');
const common = read('common.json');
const saved = read('puzzles.json');
const ctx = createContext(valid, common);

const options = {
  count: 60,
  seed: 12345,
  ctx,
  minPath: CONFIG.MIN_PATH,
  maxPath: CONFIG.MAX_PATH,
  parOffset: CONFIG.PAR_OFFSET,
};

// A deliberately simple, separate shortest-path search, so the generator
// is not being checked against its own code.
function slowShortest(words, start, target) {
  const seen = new Set([start]);
  let frontier = [start];
  for (let steps = 1; frontier.length > 0; steps++) {
    const next = [];
    for (const word of frontier) {
      for (const other of words) {
        if (seen.has(other) || !differsByOne(word, other)) continue;
        if (other === target) return steps;
        seen.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }
  return Infinity;
}

test('word lists are sane', () => {
  const validSet = new Set(valid);
  assert.ok(valid.length > 3000);
  assert.ok(common.length > 500);
  for (const word of valid) assert.match(word, /^[a-z]{4}$/);
  for (const word of common) assert.ok(validSet.has(word), `${word} is common but not valid`);
});

test('blocked words are in neither list', () => {
  const blocked = readFileSync(new URL('../scripts/wordlists/blocklist.txt', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((line) => !line.startsWith('#')).join(' ').split(/\s+/).filter(Boolean);
  const validSet = new Set(valid);
  assert.ok(blocked.length > 0);
  for (const word of blocked) assert.ok(!validSet.has(word), `${word} should be blocked`);
});

test('same seed gives the same puzzles, different seed gives different ones', () => {
  assert.deepEqual(generatePuzzles(options), generatePuzzles(options));
  assert.notDeepEqual(generatePuzzles(options), generatePuzzles({ ...options, seed: 54321 }));
});

test('generates the requested number of puzzles, numbered from 1', () => {
  const puzzles = generatePuzzles(options);
  assert.equal(puzzles.length, options.count);
  puzzles.forEach((p, i) => assert.equal(p.hole, i + 1));
});

test('start and target are common words, and targets never repeat', () => {
  const commonSet = new Set(common);
  const puzzles = generatePuzzles(options);
  for (const p of puzzles) {
    assert.ok(commonSet.has(p.start), `${p.start} is not a common word`);
    assert.ok(commonSet.has(p.target), `${p.target} is not a common word`);
    assert.notEqual(p.start, p.target);
  }
  assert.equal(new Set(puzzles.map((p) => p.target)).size, puzzles.length);
  assert.equal(new Set(puzzles.map((p) => p.start)).size, puzzles.length);
});

test('stored shortest path is correct, within range, and par = shortest + offset', () => {
  for (const p of generatePuzzles({ ...options, count: 25 })) {
    assert.equal(p.shortest, slowShortest(valid, p.start, p.target), `${p.start} -> ${p.target}`);
    assert.ok(p.shortest >= CONFIG.MIN_PATH && p.shortest <= CONFIG.MAX_PATH);
    assert.equal(p.par, p.shortest + CONFIG.PAR_OFFSET);
  }
});

test('a shortest path exists using common words only', () => {
  for (const p of generatePuzzles({ ...options, count: 25 })) {
    assert.equal(slowShortest(common, p.start, p.target), p.shortest, `${p.start} -> ${p.target}`);
  }
});

test('respects a custom path range and par offset', () => {
  const puzzles = generatePuzzles({ ...options, count: 20, minPath: 4, maxPath: 4, parOffset: 1 });
  for (const p of puzzles) {
    assert.equal(p.shortest, 4);
    assert.equal(p.par, 5);
  }
});

test('single practice puzzles follow the same rules', () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 10; i++) {
    const p = generatePuzzle(rng, ctx, options);
    assert.equal(p.shortest, slowShortest(valid, p.start, p.target));
    assert.ok(p.shortest >= CONFIG.MIN_PATH && p.shortest <= CONFIG.MAX_PATH);
    assert.equal(p.par, p.shortest + CONFIG.PAR_OFFSET);
  }
});

test('target scrambling round-trips', () => {
  for (const key of [0, 1, 47, 730]) {
    assert.equal(decodeTarget(encodeTarget('word', key), key), 'word');
  }
  assert.notEqual(encodeTarget('word', 1), 'word');
});

test('data/puzzles.json covers at least a year and matches the generator', () => {
  assert.ok(saved.length >= 365);
  const fresh = generatePuzzles({ ...options, count: CONFIG.PUZZLE_COUNT, seed: CONFIG.PUZZLE_SEED });
  const decoded = saved.map((p) => ({ ...p, target: decodeTarget(p.target, p.hole) }));
  assert.deepEqual(decoded, fresh, 'puzzles.json is out of date: run `npm run puzzles`');
});
