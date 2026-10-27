// The metronome's settings, the same everywhere it runs: how many beats a bar has, how each one
// clicks, and whether a bar of clicks counts you in.

/** How a beat sounds: 0 silent, 1 a click, 2 an accent. */
export type Click = 0 | 1 | 2;

export interface Metronome {
  /** One per beat of the bar, so its length is the beats per bar. */
  clicks: Click[];
  /** A bar of clicks on every beat before the music starts. */
  countIn: boolean;
}

export const BEATS_MIN = 1;
export const BEATS_MAX = 12;

/** Every beat, beat 1 accented. */
export const everyBeat = (beats: number): Metronome => ({ clicks: Array.from({ length: beats }, (_, i) => (i === 0 ? 2 : 1)), countIn: true });

/** Clicks on 2 and 4 only. */
export const backbeat = (): Metronome => ({ clicks: [0, 1, 0, 1], countIn: true });

/** Tapping a beat goes click → accent → silent → click. */
export const nextClick = (c: Click): Click => (c === 1 ? 2 : c === 2 ? 0 : 1);

/** A different number of beats: new beats click, beats past the end go. */
export function withBeats(m: Metronome, beats: number): Metronome {
  const n = Math.min(BEATS_MAX, Math.max(BEATS_MIN, beats));
  return { ...m, clicks: Array.from({ length: n }, (_, i) => m.clicks[i] ?? 1) };
}

/** A metronome read from storage, or `fallback` for anything unusable. */
export function cleanMetronome(raw: unknown, fallback: Metronome): Metronome {
  if (typeof raw !== 'object' || raw === null) return fallback;
  const { clicks, countIn } = raw as Partial<Metronome>;
  const ok = Array.isArray(clicks) && clicks.length >= BEATS_MIN && clicks.length <= BEATS_MAX && clicks.every((c) => c === 0 || c === 1 || c === 2);
  return { clicks: ok ? clicks : fallback.clicks, countIn: typeof countIn === 'boolean' ? countIn : fallback.countIn };
}
