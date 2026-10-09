import { type Chord, chordName } from '../theory/chords';
import { FRET_COUNT } from '../theory/fretboard';
import { chordPool, keyName, MAJOR_KEYS, MINOR_KEYS, ROMAN } from '../theory/keys';
import { type Note, noteName } from '../theory/notes';

export type Area = 'spell' | 'tones' | 'keys' | 'fretboard';

export const AREAS: { id: Area; title: string; blurb: string }[] = [
  { id: 'spell', title: 'Chord spelling', blurb: 'B♭m7 → B♭ D♭ F A♭' },
  { id: 'tones', title: 'Chord tones', blurb: '3rd of E♭7? · C in D7 is the…' },
  { id: 'keys', title: 'Keys & ii–V–I', blurb: 'ii in A♭? · Gm7 C7 → ?' },
  { id: 'fretboard', title: 'Fretboard', blurb: 'Name the note · find every G' },
];

interface Base {
  id: string;
  area: Area;
  /** Facts in the same group aren't asked back to back (they'd give each other away). */
  group: string;
  /** Answer time that counts as fluent. */
  targetMs: number;
  /** Relative priority before any practice data. */
  weight: number;
}

export type Fact = Base &
  (
    | { kind: 'spell'; chord: Chord }
    | { kind: 'tone'; chord: Chord; index: number }
    | { kind: 'degree'; chord: Chord; index: number }
    | { kind: 'diatonic'; key: Note; degree: number }
    | { kind: 'function'; key: Note; degree: number }
    | { kind: 'cadence'; tonic: Note; minor: boolean }
    | { kind: 'fretName'; string: number; fret: number }
    | { kind: 'fretFind'; pitch: number }
  );

// 3rds and 7ths define the chord's sound, so they come up about three times as often as 5ths.
const toneWeight = (index: number) => (index === 2 ? 0.35 : 1);

function buildFacts(): Fact[] {
  const facts: Fact[] = [];
  const pool = chordPool();

  for (const chord of pool) {
    const name = chordName(chord);
    facts.push({ kind: 'spell', id: `spell:${name}`, area: 'spell', group: name, targetMs: 5000, weight: 1, chord });
  }

  for (const chord of pool) {
    const name = chordName(chord);
    for (const index of [1, 2, 3]) {
      const common = { area: 'tones' as const, group: name, targetMs: 2500, weight: toneWeight(index), chord, index };
      facts.push({ kind: 'tone', id: `tone:${name}:${index}`, ...common });
      facts.push({ kind: 'degree', id: `degree:${name}:${index}`, ...common });
    }
  }

  for (const key of MAJOR_KEYS) {
    const k = noteName(key);
    // The I chord is a giveaway, so start at ii.
    for (let degree = 1; degree < 7; degree++) {
      const common = { area: 'keys' as const, group: `key:${k}`, weight: 1, key, degree };
      facts.push({ kind: 'diatonic', id: `diatonic:${k}:${ROMAN[degree]}`, targetMs: 4000, ...common });
      facts.push({ kind: 'function', id: `function:${k}:${ROMAN[degree]}`, targetMs: 2500, ...common });
    }
  }

  for (const [keys, minor] of [[MAJOR_KEYS, false], [MINOR_KEYS, true]] as const) {
    for (const tonic of keys) {
      const k = keyName(tonic, minor);
      facts.push({ kind: 'cadence', id: `cadence:${k}`, area: 'keys', group: `cadence:${k}`, targetMs: 3000, weight: 2, tonic, minor });
    }
  }

  for (let string = 0; string < 6; string++) {
    for (let fret = 0; fret <= FRET_COUNT; fret++) {
      facts.push({ kind: 'fretName', id: `fretName:${string}:${fret}`, area: 'fretboard', group: `fret:${string}`, targetMs: 2500, weight: 1, string, fret });
    }
  }
  for (let pitch = 0; pitch < 12; pitch++) {
    facts.push({ kind: 'fretFind', id: `fretFind:${pitch}`, area: 'fretboard', group: `find`, targetMs: 9000, weight: 1.5, pitch });
  }

  return facts;
}

export const FACTS = buildFacts();
export const FACTS_BY_ID = new Map(FACTS.map((f) => [f.id, f]));
export const factsIn = (area: Area) => FACTS.filter((f) => f.area === area);
