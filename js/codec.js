// Light scrambling of target words so the answers in data/puzzles.json
// can't be read at a glance. This is NOT security: with no backend, a
// determined player can always work the answers out.

const A = 97;

function shift(word, key, sign) {
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const offset = sign * ((key * 7 + i * 5 + 11) % 26);
    out += String.fromCharCode(A + ((word.charCodeAt(i) - A + offset + 26) % 26));
  }
  return out;
}

export const encodeTarget = (word, key) => shift(word, key, 1);
export const decodeTarget = (word, key) => shift(word, key, -1);
