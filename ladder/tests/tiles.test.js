import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreTiles } from '../js/tiles.js';

// Shorthand: 'gy-' style strings, g = green, y = yellow, - = gray.
const short = (guess, target) =>
  scoreTiles(guess, target).map((c) => ({ green: 'g', yellow: 'y', gray: '-' })[c]).join('');

test('exact match is all green', () => {
  assert.equal(short('cold', 'cold'), 'gggg');
});

test('no shared letters is all gray', () => {
  assert.equal(short('cold', 'fish'), '----');
});

test('right letter in the right spot is green', () => {
  assert.equal(short('cold', 'card'), 'g--g');
});

test('right letter in the wrong spot is yellow', () => {
  assert.equal(short('note', 'tone'), 'ygyg');
  assert.equal(short('abcd', 'dabc'), 'yyyy');
});

test('returns the full colour names', () => {
  assert.deepEqual(scoreTiles('cold', 'clad'), ['green', 'gray', 'yellow', 'green']);
});

test('duplicate in guess, one in target: only one copy is coloured', () => {
  // Target "slay" has one L. The first L in "loll" gets it; the rest are gray.
  assert.equal(short('loll', 'slay'), 'y---');
  // Target "pale" has one L, matched exactly by the third letter of "lull",
  // so the earlier L must be gray, not yellow.
  assert.equal(short('lull', 'pale'), '--g-');
});

test('duplicate in guess: a green copy is claimed before any yellow', () => {
  // Target "bolt" has one O, in position 2. The guess "onto" has no O
  // there, so its first O is yellow and its second O is gray.
  assert.equal(short('onto', 'bolt'), 'y-y-');
  // Target "moat" has one O, matched exactly by the second letter of
  // "boot", so the other O must be gray, not yellow.
  assert.equal(short('boot', 'moat'), '-g-g');
});

test('duplicate in guess, later copy is the green one', () => {
  // Target "area" has A at positions 1 and 4. Guess "papa": the second A
  // is not green (target has E there)... check each tile by hand:
  //   p - not in target            -> gray
  //   a - target[1] is r, A exists -> yellow
  //   p - not in target            -> gray
  //   a - target[3] is a           -> green
  assert.equal(short('papa', 'area'), '-y-g');
});

test('duplicates in both words', () => {
  // Target "eels": guess "else" -> E green, L yellow, S yellow, E yellow.
  assert.equal(short('else', 'eels'), 'gyyy');
  // Target "noon": guess "onto" -> both Os are yellow, one N is yellow.
  assert.equal(short('onto', 'noon'), 'yy-y');
});

test('more copies in the guess than in the target', () => {
  // Target "deed" has two Es. Guess "eeee" has only two in the right spots.
  assert.equal(short('eeee', 'deed'), '-gg-');
  // Target "seat" has one E; guess "eves" -> first E yellow, second gray.
  assert.equal(short('eves', 'seat'), 'y--y');
});
