// Notes are spelled as a letter plus an accidental, so E♭ and D♯ stay distinct.
// letter: 0..6 for C D E F G A B. acc: -2..2 (double flat .. double sharp).
export interface Note {
  letter: number;
  acc: number;
}

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export function pc(n: Note): number {
  return mod(NATURAL_PC[n.letter] + n.acc, 12);
}

const ACC_TEXT: Record<number, string> = { [-2]: '♭♭', [-1]: '♭', 0: '', 1: '♯', 2: '♯♯' };

export function noteName(n: Note): string {
  return LETTERS[n.letter] + ACC_TEXT[n.acc];
}

/** Parse ASCII spellings like "C", "Eb", "F#", "Bbb". */
export function note(s: string): Note {
  const letter = LETTERS.indexOf(s[0].toUpperCase() as (typeof LETTERS)[number]);
  if (letter < 0) throw new Error(`Bad note: ${s}`);
  let acc = 0;
  for (const ch of s.slice(1)) {
    if (ch === 'b' || ch === '♭') acc--;
    else if (ch === '#' || ch === '♯') acc++;
    else throw new Error(`Bad note: ${s}`);
  }
  return { letter, acc };
}

export const sameNote = (a: Note, b: Note) => a.letter === b.letter && a.acc === b.acc;

/** An interval counts letter steps and semitones, which is what makes spelling come out right. */
export interface Interval {
  steps: number;
  semis: number;
}

export function transpose(n: Note, iv: Interval): Note {
  const letter = mod(n.letter + iv.steps, 7);
  const targetPc = mod(pc(n) + iv.semis, 12);
  const acc = mod(targetPc - NATURAL_PC[letter] + 6, 12) - 6;
  return { letter, acc };
}

/** On the guitar only the pitch matters, so any spelling of it counts (E for F♭, A for B♭♭). */
export const accepts = (expected: Note, given: Note) => pc(expected) === pc(given);

/** Every note on the 3×7 answer grid, rows ♯ / ♮ / ♭. */
export const GRID_ROWS: Note[][] = [1, 0, -1].map((acc) =>
  LETTERS.map((_, letter) => ({ letter, acc })),
);

/** Names used when a pitch has no key context (fretboard): sharps and flats for black keys. */
export function pitchNames(p: number): string {
  return ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'][mod(p, 12)];
}
