// Wordle-style tile colouring.

export const GREEN = 'green';
export const YELLOW = 'yellow';
export const GRAY = 'gray';

// Returns one colour per letter of `guess`, compared to `target`.
// Duplicate letters are handled the way Wordle does: greens are claimed
// first, then yellows are handed out left to right while the target still
// has unclaimed copies of that letter.
export function scoreTiles(guess, target) {
  const colors = new Array(guess.length).fill(GRAY);
  const unclaimed = {};

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) {
      colors[i] = GREEN;
    } else {
      unclaimed[target[i]] = (unclaimed[target[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (colors[i] !== GREEN && unclaimed[guess[i]] > 0) {
      colors[i] = YELLOW;
      unclaimed[guess[i]]--;
    }
  }
  return colors;
}
