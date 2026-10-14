import { type Interval, mod, type Note, noteName, note, pc, transpose } from './notes';

export type Degree = '1' | 'b3' | '3' | 'b5' | '5' | 'bb7' | 'b7' | '7';

export const DEGREE_INTERVALS: Record<Degree, Interval> = {
  '1': { steps: 0, semis: 0 },
  b3: { steps: 2, semis: 3 },
  '3': { steps: 2, semis: 4 },
  b5: { steps: 4, semis: 6 },
  '5': { steps: 4, semis: 7 },
  bb7: { steps: 6, semis: 9 },
  b7: { steps: 6, semis: 10 },
  '7': { steps: 6, semis: 11 },
};

export const DEGREE_LABEL: Record<Degree, string> = {
  '1': '1',
  b3: '♭3',
  '3': '3',
  b5: '♭5',
  '5': '5',
  bb7: '♭♭7',
  b7: '♭7',
  '7': '7',
};

/** Degrees offered on the degree pad (the root is never asked). */
export const DEGREE_PAD: Degree[] = ['b3', '3', 'b5', '5', 'bb7', 'b7', '7'];

export type Quality = 'maj7' | 'dom7' | 'm7' | 'm7b5' | 'dim7';

export const QUALITIES: Quality[] = ['maj7', 'dom7', 'm7', 'm7b5', 'dim7'];

export const QUALITY_SYMBOL: Record<Quality, string> = {
  maj7: 'maj7',
  dom7: '7',
  m7: 'm7',
  m7b5: 'm7♭5',
  dim7: '°7',
};

export const QUALITY_DEGREES: Record<Quality, Degree[]> = {
  maj7: ['1', '3', '5', '7'],
  dom7: ['1', '3', '5', 'b7'],
  m7: ['1', 'b3', '5', 'b7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
};

export interface Chord {
  root: Note;
  quality: Quality;
}

export const chord = (root: string, quality: Quality): Chord => ({ root: note(root), quality });

export function chordName(c: Chord): string {
  return noteName(c.root) + QUALITY_SYMBOL[c.quality];
}

/** Chord tones in stacked-thirds order: root, 3rd, 5th, 7th. */
export function chordTones(c: Chord): Note[] {
  return QUALITY_DEGREES[c.quality].map((d) => transpose(c.root, DEGREE_INTERVALS[d]));
}

/** Position in the chord: 0 root, 1 third, 2 fifth, 3 seventh. */
export const TONE_ORDINAL = ['root', '3rd', '5th', '7th'] as const;

/**
 * MIDI pitches for hearing a chord: stacked up from the root, with the root always between
 * A2 and G♯3 so chords sit in the guitar's middle register and don't jump around.
 */
export function chordPitches(c: Chord): number[] {
  const root = 45 + mod(pc(c.root) - 9, 12);
  return QUALITY_DEGREES[c.quality].map((d) => root + DEGREE_INTERVALS[d].semis);
}
