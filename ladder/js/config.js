// All the settings you might want to tweak live in this one file.
//
// IMPORTANT: if you change PAR_OFFSET, MIN_PATH, MAX_PATH or PUZZLE_SEED,
// re-run `npm run puzzles` so data/puzzles.json matches.

export const CONFIG = {
  // The name shown in the header, page titles and share text.
  GAME_NAME: 'Placeholder',

  // The day of Hole 1, as YYYY-MM-DD (UTC). Placeholder until launch is set.
  LAUNCH_DATE: '2026-10-07',

  // Par = shortest possible path + this number.
  PAR_OFFSET: 2,

  // Max moves = par + this number.
  MAX_MOVES_OVER_PAR: 4,

  // A loss ("X") counts as par + this number in the weekly total.
  LOSS_OVER_PAR: 5,

  // Hints allowed per game, and how long the placeholder "ad" lasts.
  HINTS_PER_GAME: 1,
  HINT_AD_SECONDS: 3,

  // Puzzles are only kept if the shortest path is within this range.
  MIN_PATH: 3,
  MAX_PATH: 7,

  // Used by scripts/generate-puzzles.js.
  PUZZLE_COUNT: 730,
  PUZZLE_SEED: 20261007,
};
