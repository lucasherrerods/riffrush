/** Os bits dos mods, os mesmos do motor (backend/motor-mania/src/mods.rs). */
export const MODS = {
  EZ: 1,
  NF: 1 << 1,
  HT: 1 << 2,
  HR: 1 << 3,
  DT: 1 << 4,
  NC: 1 << 5,
  SD: 1 << 6,
  PF: 1 << 7,
  FI: 1 << 8,
  HD: 1 << 9,
  FL: 1 << 10,
  MR: 1 << 11,
  RD: 1 << 12,
  AT: 1 << 13,
} as const;

export type SiglaDoMod = keyof typeof MODS;

export const siglasDosMods = (mods: number) => (Object.keys(MODS) as SiglaDoMod[]).filter((sigla) => mods & MODS[sigla]);
