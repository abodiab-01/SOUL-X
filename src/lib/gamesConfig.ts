export const GAME_BET_AMOUNTS: readonly number[] = [
  500,
  1000,
  2500,
  5000,
  10000,
  25000,
  50000,
  100000,
  250000,
  500000,
  750000,
  1000000,
];

export const GAME_MIN_BET = GAME_BET_AMOUNTS[0];
export const GAME_MAX_BET = GAME_BET_AMOUNTS[GAME_BET_AMOUNTS.length - 1];
