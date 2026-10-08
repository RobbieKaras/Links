// Word ladder rules and shortest-path search.

export function differsByOne(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && ++diff > 1) return false;
  }
  return diff === 1;
}

// Returns null if the move is allowed, otherwise an error code.
export function validateMove(current, next, used, validWords) {
  if (!validWords.has(next)) return 'NOT_A_WORD';
  if (!differsByOne(current, next)) return 'NOT_ONE_LETTER';
  if (used.includes(next)) return 'ALREADY_USED';
  return null;
}

// Map of word -> list of words one letter away.
export function buildGraph(words) {
  const buckets = new Map();
  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const key = word.slice(0, i) + '_' + word.slice(i + 1);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(word);
    }
  }
  const graph = new Map();
  for (const word of words) graph.set(word, []);
  for (const bucket of buckets.values()) {
    for (const a of bucket) {
      for (const b of bucket) {
        if (a !== b) graph.get(a).push(b);
      }
    }
  }
  return graph;
}

// Map of word -> number of moves needed to reach it from `start`.
export function distancesFrom(graph, start) {
  const dist = new Map([[start, 0]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const word = queue[head];
    for (const next of graph.get(word) || []) {
      if (!dist.has(next)) {
        dist.set(next, dist.get(word) + 1);
        queue.push(next);
      }
    }
  }
  return dist;
}

// One shortest ladder from start to target (inclusive), or null.
export function shortestPath(graph, start, target) {
  const dist = distancesFrom(graph, target);
  if (!dist.has(start)) return null;
  const path = [start];
  let word = start;
  while (word !== target) {
    word = graph.get(word).find((next) => dist.get(next) === dist.get(word) - 1);
    path.push(word);
  }
  return path;
}
