import { type Interval, mod, type Note, pc, transpose } from './notes';

export interface ScaleTone {
  note: Note;
  /** Degree over the chord, e.g. ♭9. */
  label: string;
}

/**
 * The dominant bebop scale with ♭9 and ♭13 (Barry Harris): Mixolydian ♭9 ♭13 plus the major 7th
 * as a passing note, so eighth notes from the root put chord tones on the beat.
 * Over G7: G A♭ B C D E♭ F F♯.
 */
const BEBOP_B9_B13: [string, Interval][] = [
  ['1', { steps: 0, semis: 0 }],
  ['♭9', { steps: 1, semis: 1 }],
  ['3', { steps: 2, semis: 4 }],
  ['4', { steps: 3, semis: 5 }],
  ['5', { steps: 4, semis: 7 }],
  ['♭13', { steps: 5, semis: 8 }],
  ['♭7', { steps: 6, semis: 10 }],
  ['7', { steps: 6, semis: 11 }],
];

export function bebopB9b13(root: Note): ScaleTone[] {
  return BEBOP_B9_B13.map(([label, iv]) => ({ label, note: transpose(root, iv) }));
}

/** Respells a double flat or sharp on the neighbouring letter (E♭♭ → D, F♯♯ → G), for reading at a glance. */
export function plainSpelling(n: Note): Note {
  if (Math.abs(n.acc) < 2) return n;
  const letter = mod(n.letter + Math.sign(n.acc), 7);
  const acc = mod(pc(n) - pc({ letter, acc: 0 }) + 6, 12) - 6;
  return { letter, acc };
}
