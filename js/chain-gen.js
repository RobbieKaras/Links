// Chain generation, used by scripts/generate-puzzles.js.

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

function shuffled(rng, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// `pairs` is a list of "first second" strings (data/pairs.json).
export function createContext(pairs) {
  const next = new Map();
  for (const pair of pairs) {
    const [a, b] = pair.split(' ');
    if (!next.has(a)) next.set(a, []);
    if (!next.has(b)) next.set(b, []);
    next.get(a).push(b);
  }
  return { pairs: new Set(pairs), next, words: [...next.keys()].sort() };
}

// True if no hidden word has a rival: another word with the same first
// letter that also links to the words on both sides of it. Without this,
// a player could give a perfectly good answer and be told it is wrong.
export function isUnambiguous(ctx, chain) {
  for (let i = 1; i < chain.length - 1; i++) {
    for (const rival of ctx.next.get(chain[i - 1])) {
      if (rival !== chain[i] && rival[0] === chain[i][0] && ctx.pairs.has(`${rival} ${chain[i + 1]}`)) {
        return false;
      }
    }
  }
  return true;
}

// A random walk through the pairs, never repeating a word. Returns null
// if the walk from this start word hits a dead end.
function walk(rng, ctx, length, maxWordLength) {
  const fits = (word) => word.length >= 3 && word.length <= maxWordLength;
  const chain = [ctx.words[Math.floor(rng() * ctx.words.length)]];
  if (!fits(chain[0])) return null;

  const extend = () => {
    if (chain.length === length) return true;
    for (const word of shuffled(rng, ctx.next.get(chain[chain.length - 1]))) {
      if (chain.includes(word) || !fits(word)) continue;
      chain.push(word);
      if (extend()) return true;
      chain.pop();
    }
    return false;
  };
  return extend() ? chain : null;
}

// One random chain.
export function generateChain(rng, ctx, { length, maxWordLength }) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const chain = walk(rng, ctx, length, maxWordLength);
    if (chain && isUnambiguous(ctx, chain)) return chain;
  }
  throw new Error('Could not build a chain from these pairs');
}

// Generates `count` daily puzzles. For each hole it builds several
// candidate chains and keeps the one whose pairs have been used least so
// far, so the same links do not keep coming up.
export function generatePuzzles({ count, seed, ctx, length, parOffset, maxWordLength }) {
  const rng = mulberry32(seed);
  const pairUses = new Map();
  const seen = new Set();
  const puzzles = [];
  const linksOf = (chain) => chain.slice(1).map((word, i) => `${chain[i]} ${word}`);

  while (puzzles.length < count) {
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < 40; i++) {
      const chain = generateChain(rng, ctx, { length, maxWordLength });
      if (seen.has(chain.join(' '))) continue;
      const score = linksOf(chain).reduce((sum, link) => sum + (pairUses.get(link) || 0) ** 2, 0);
      if (score < bestScore) {
        best = chain;
        bestScore = score;
      }
    }
    if (!best) throw new Error('Not enough pairs to generate that many different puzzles');
    seen.add(best.join(' '));
    for (const link of linksOf(best)) pairUses.set(link, (pairUses.get(link) || 0) + 1);
    puzzles.push({ hole: puzzles.length + 1, words: best, par: length - 2 + parOffset });
  }
  return puzzles;
}
