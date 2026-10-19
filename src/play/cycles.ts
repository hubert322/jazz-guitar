import type { Chord } from '../theory/chords';
import { type Cadence, MAJOR_KEYS, MINOR_KEYS, twoFiveOne } from '../theory/keys';
import { pc } from '../theory/notes';

export type Mode = 'major' | 'minor' | 'mix';

/** One time through the 4-bar form: ii | V | I | I. */
export interface Cycle {
  cadence: Cadence;
  /** 1 the first time through a key, 2 the second, and so on. */
  rep: number;
}

export const BARS_PER_CYCLE = 4;

/** The chord in each bar of a cycle. */
export function cycleBars({ cadence }: Cycle): Chord[] {
  const [ii, v, i] = cadence.chords;
  return [ii, v, i, i];
}

/**
 * The cadences a key setting allows. Keys are major keys, as on the home screen; a minor ii–V–i
 * uses that key's relative minor, the same pairing the chord drills use (C → A minor).
 */
export function cadencesFor(keys: number[], mode: Mode): Cadence[] {
  const out: Cadence[] = [];
  for (const p of keys) {
    const i = MAJOR_KEYS.findIndex((k) => pc(k) === p);
    if (mode !== 'minor') out.push(twoFiveOne(MAJOR_KEYS[i], false));
    if (mode !== 'major') out.push(twoFiveOne(MINOR_KEYS[i], true));
  }
  return out;
}

const sameCadence = (a: Cadence, b: Cadence) => pc(a.tonic) === pc(b.tonic) && a.minor === b.minor;

/**
 * The cycle after `prev`: the same cadence until it has come up `repeat` times, then a random
 * different one (unless there's only one to choose from).
 */
export function nextCycle(prev: Cycle | null, keys: number[], mode: Mode, repeat: number, rng = Math.random): Cycle {
  const pool = cadencesFor(keys, mode);
  const kept = prev && pool.find((c) => sameCadence(c, prev.cadence));
  if (prev && kept && prev.rep < repeat) return { cadence: kept, rep: prev.rep + 1 };
  const fresh = prev && pool.length > 1 ? pool.filter((c) => !sameCadence(c, prev.cadence)) : pool;
  return { cadence: fresh[Math.floor(rng() * fresh.length)], rep: 1 };
}
