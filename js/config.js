// All the settings you might want to tweak live in this one file.
//
// IMPORTANT: if you change CHAIN_LENGTH, PAR_OFFSET, MAX_WORD_LENGTH,
// PUZZLE_COUNT or PUZZLE_SEED, re-run `npm run puzzles` so
// data/puzzles.json matches.

export const CONFIG = {
  // The name shown in the header, page titles and share text.
  GAME_NAME: 'Links',

  // The day of Hole 1, as YYYY-MM-DD (UTC). Placeholder until launch is set.
  LAUNCH_DATE: '2026-10-07',

  // Words in each chain, including the first and last, which are shown.
  CHAIN_LENGTH: 7,

  // Par = number of hidden words + this number.
  PAR_OFFSET: 2,

  // Max strokes = par + this number.
  MAX_STROKES_OVER_PAR: 4,

  // A loss ("X") counts as par + this number in the weekly total.
  LOSS_OVER_PAR: 5,

  // Hints allowed per game.
  HINTS_PER_GAME: 1,

  // How long the placeholder "ad" lasts (hints and unlocking archive holes).
  REWARD_AD_SECONDS: 3,

  // Longest word allowed in a chain (keeps rows on one line on phones).
  MAX_WORD_LENGTH: 9,

  // Used by scripts/generate-puzzles.js.
  PUZZLE_COUNT: 365,
  PUZZLE_SEED: 20261007,
};
