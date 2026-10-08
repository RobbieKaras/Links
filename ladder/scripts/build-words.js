// Builds data/valid.json and data/common.json.
//
//   npm run words
//
// valid.json  = every 4-letter word in ENABLE (public domain), minus the blocklist.
// common.json = the most frequently used of those words, minus not-answers.txt.
//               Only these are ever used as a start or target word.
//
// The two source files are downloaded once into scripts/.cache/.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', '.cache');

// How many of the most frequent words to consider for start/target words.
const COMMON_POOL = 1200;

const SOURCES = {
  // ENABLE word list, public domain.
  enable: 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt',
  // Word frequency counts (Peter Norvig, from the Google Web Trillion Word
  // Corpus). Only used to rank ENABLE words; none of its text is shipped.
  freq: 'https://norvig.com/ngrams/count_1w.txt',
};

async function source(name) {
  const file = join(CACHE, `${name}.txt`);
  if (!existsSync(file)) {
    console.log(`Downloading ${SOURCES[name]}`);
    const res = await fetch(SOURCES[name]);
    if (!res.ok) throw new Error(`Download failed (${res.status}): ${SOURCES[name]}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, await res.text());
  }
  return readFileSync(file, 'utf8');
}

function wordFile(name) {
  const text = readFileSync(join(ROOT, 'scripts', 'wordlists', name), 'utf8');
  return new Set(
    text.split(/\r?\n/).filter((line) => !line.startsWith('#')).join(' ').split(/\s+/).filter(Boolean)
  );
}

const blocklist = wordFile('blocklist.txt');
const notAnswers = wordFile('not-answers.txt');

const valid = (await source('enable'))
  .split(/\r?\n/)
  .filter((w) => /^[a-z]{4}$/.test(w) && !blocklist.has(w))
  .sort();
const validSet = new Set(valid);

const ranked = [];
for (const line of (await source('freq')).split(/\r?\n/)) {
  const word = line.split('\t')[0];
  if (validSet.has(word)) ranked.push(word);
}
const common = ranked.slice(0, COMMON_POOL).filter((w) => !notAnswers.has(w)).sort();

writeFileSync(join(ROOT, 'data', 'valid.json'), JSON.stringify(valid));
writeFileSync(join(ROOT, 'data', 'common.json'), JSON.stringify(common));
console.log(`valid.json:  ${valid.length} words`);
console.log(`common.json: ${common.length} words`);
