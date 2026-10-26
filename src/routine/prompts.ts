// What a routine exercise shows while the metronome runs: the next note, the next pass of chords,
// and the current cue. Random choices take an `rng` so tests can pin them down.

import { cadencesFor, cycleBars } from '../play/cycles';
import type { Chord } from '../theory/chords';
import { diatonicChords, keyName, MAJOR_KEYS, MINOR_KEYS } from '../theory/keys';
import { LETTERS, type Note, note, pc } from '../theory/notes';
import type { ChordsPrompt, NoteSet } from './routine';

type Rng = () => number;

const pick = <T>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];

function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const NATURALS: Note[][] = LETTERS.map((_, letter) => [{ letter, acc: 0 }]);
/** Black keys come up as either spelling, since C♯ and D♭ are the same fret but read differently. */
const BLACK_KEYS: Note[][] = [
  ['C#', 'Db'],
  ['D#', 'Eb'],
  ['F#', 'Gb'],
  ['G#', 'Ab'],
  ['A#', 'Bb'],
].map((names) => names.map(note));

/** Each spelling of a black key on its own. */
const SPELLINGS: Note[][] = BLACK_KEYS.flat().map((n) => [n]);

/** The notes of each set; a note with two spellings comes up as either. */
const NOTE_SETS: Record<NoteSet, Note[][]> = {
  naturals: NATURALS,
  accidentals: SPELLINGS,
  all: [...NATURALS, ...BLACK_KEYS],
  spellings: [...NATURALS, ...SPELLINGS],
};

export const setSize = (set: NoteSet) => NOTE_SETS[set].length;

/** Whether the same fret comes twice running, counting on from `after`. */
const repeatsFret = (notes: Note[], after: Note | null) =>
  notes.some((n, i) => {
    const prev = i === 0 ? after : notes[i - 1];
    return prev !== null && pc(prev) === pc(n);
  });

/**
 * One round of notes: every note of the set once, in random order. No fret comes twice running,
 * across rounds too (`after` is the last note of the previous round), even as C♯ then D♭.
 */
export function noteRound(set: NoteSet, after: Note | null, rng: Rng = Math.random): Note[] {
  let round: Note[] = [];
  for (let tries = 0; tries < 100; tries++) {
    round = shuffle(NOTE_SETS[set], rng).map((spellings) => pick(spellings, rng));
    if (!repeatsFret(round, after)) break;
  }
  return round;
}

/** Notes go up the strings first, then alternate. */
export const goesUp = (index: number) => index % 2 === 0;

export interface ChordBar {
  chord: Chord;
  /** "C major", "A minor": the key this pass is in. */
  key: string;
}

/** One time through a chords prompt in one key, a chord per bar. `after` is the previous pass's key. */
export function chordPass(prompt: ChordsPrompt, keys: number[], after: string | null, rng: Rng = Math.random): ChordBar[] {
  const options = passOptions(prompt, keys);
  const fresh = options.length > 1 ? options.filter((o) => o.key !== after) : options;
  const { key, chords } = pick(fresh, rng);
  return chords.flatMap((chord) => Array.from({ length: prompt.barsEach }, () => ({ chord, key })));
}

function passOptions({ progression, mode }: ChordsPrompt, keys: number[]): { key: string; chords: Chord[] }[] {
  const index = (p: number) => MAJOR_KEYS.findIndex((k) => pc(k) === p);
  switch (progression) {
    case 'iiVI':
      return cadencesFor(keys, mode).map((cadence) => ({
        key: keyName(cadence.tonic, cadence.minor),
        chords: cycleBars({ cadence, rep: 1 }),
      }));
    case 'diatonic':
      return keys.map((p) => ({ key: keyName(MAJOR_KEYS[index(p)]), chords: diatonicChords(MAJOR_KEYS[index(p)]) }));
    case 'vamp':
      return keys.flatMap((p) => {
        const major = MAJOR_KEYS[index(p)];
        const minor = MINOR_KEYS[index(p)];
        const out = [];
        if (mode !== 'minor') out.push({ key: keyName(major), chords: [{ root: major, quality: 'maj7' as const }] });
        if (mode !== 'major') out.push({ key: keyName(minor, true), chords: [{ root: minor, quality: 'm7' as const }] });
        return out;
      });
  }
}

/** Which cue comes after cue `prev` (an index into the cue list, or null at the start). */
export function nextCue(count: number, order: 'turn' | 'random', prev: number | null, rng: Rng = Math.random): number {
  if (order === 'turn' || count < 2) return prev === null ? 0 : (prev + 1) % count;
  const others = Array.from({ length: count }, (_, i) => i).filter((i) => i !== prev);
  return pick(others, rng);
}
