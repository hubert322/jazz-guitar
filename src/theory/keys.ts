import { type Chord, chord, chordName } from './chords';
import { type Interval, type Note, note, noteName, transpose } from './notes';

/** The 12 major keys as they're usually written in jazz charts. */
export const MAJOR_KEYS: Note[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map(note);

/** Relative minors of the keys above (A♭ minor rather than G♯ minor, whose V7 needs an F double-sharp). */
export const MINOR_KEYS: Note[] = ['A', 'Bb', 'B', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab'].map(note);

const MAJOR_SCALE: Interval[] = [0, 2, 4, 5, 7, 9, 11].map((semis, steps) => ({ steps, semis }));

const DIATONIC_QUALITIES = ['maj7', 'm7', 'm7', 'maj7', 'dom7', 'm7', 'm7b5'] as const;

export const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viiø'] as const;

export function diatonicChord(key: Note, degree: number): Chord {
  return { root: transpose(key, MAJOR_SCALE[degree]), quality: DIATONIC_QUALITIES[degree] };
}

export function diatonicChords(key: Note): Chord[] {
  return ROMAN.map((_, i) => diatonicChord(key, i));
}

const M2: Interval = { steps: 1, semis: 2 };
const P5: Interval = { steps: 4, semis: 7 };

export interface Cadence {
  tonic: Note;
  minor: boolean;
  chords: [Chord, Chord, Chord];
}

export function twoFiveOne(tonic: Note, minor: boolean): Cadence {
  const ii: Chord = { root: transpose(tonic, M2), quality: minor ? 'm7b5' : 'm7' };
  const v: Chord = { root: transpose(tonic, P5), quality: 'dom7' };
  const i: Chord = { root: tonic, quality: minor ? 'm7' : 'maj7' };
  return { tonic, minor, chords: [ii, v, i] };
}

export const keyName = (tonic: Note, minor = false) => `${noteName(tonic)} ${minor ? 'minor' : 'major'}`;

/** Diminished 7ths in the spellings that show up as passing chords. */
const DIM7_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

/**
 * Every chord the spelling and chord-tone drills use: the diatonic 7th chords of all 12 major
 * keys, the ii–V–i chords of the 12 minor keys, and the common diminished 7ths.
 */
export function chordPool(): Chord[] {
  const all: Chord[] = [];
  for (const key of MAJOR_KEYS) all.push(...diatonicChords(key));
  for (const tonic of MINOR_KEYS) all.push(...twoFiveOne(tonic, true).chords);
  for (const r of DIM7_ROOTS) all.push(chord(r, 'dim7'));
  const seen = new Set<string>();
  return all.filter((c) => {
    const name = chordName(c);
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}
