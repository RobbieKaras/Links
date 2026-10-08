// Turns scripts/wordlists/pairs.txt into data/pairs.json.
//
//   npm run pairs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = readFileSync(join(ROOT, 'scripts', 'wordlists', 'pairs.txt'), 'utf8');

const pairs = new Set();
text.split(/\r?\n/).forEach((line, index) => {
  if (!line.trim() || line.startsWith('#')) return;
  const [first, rest] = line.split(':');
  const seconds = (rest || '').trim().split(/\s+/).filter(Boolean);
  for (const word of [first.trim(), ...seconds]) {
    if (!/^[a-z]+$/.test(word)) throw new Error(`pairs.txt line ${index + 1}: "${word}" is not a plain lowercase word`);
  }
  if (seconds.length === 0) throw new Error(`pairs.txt line ${index + 1}: no words after "${first}:"`);
  for (const second of seconds) {
    if (second !== first.trim()) pairs.add(`${first.trim()} ${second}`);
  }
});

const sorted = [...pairs].sort();
writeFileSync(join(ROOT, 'data', 'pairs.json'), JSON.stringify(sorted));
const words = new Set(sorted.flatMap((pair) => pair.split(' ')));
console.log(`pairs.json: ${sorted.length} pairs using ${words.size} different words`);
