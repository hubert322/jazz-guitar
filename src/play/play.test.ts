import { describe, expect, it } from 'vitest';
import { chordName } from '../theory/chords';
import { KEY_CYCLE } from '../theory/keys';
import { note, noteName } from '../theory/notes';
import { bebopB9b13, plainSpelling } from '../theory/scales';
import { cadencesFor, type Cycle, cycleBars, nextCycle } from './cycles';
import { backbeat, type Click, cleanMetronome, everyBeat, nextClick, withBeats } from './metronome';

const scale = (root: string) => bebopB9b13(note(root)).map((t) => noteName(t.note)).join(' ');

describe('♭9 ♭13 bebop scale', () => {
  it('spells one letter per degree, with 7 and ♭7 sharing one', () => {
    expect(scale('G')).toBe('G A♭ B C D E♭ F F♯');
    expect(scale('E')).toBe('E F G♯ A B C D D♯');
    expect(scale('Bb')).toBe('B♭ C♭ D E♭ F G♭ A♭ A');
    expect(scale('Db')).toBe('D♭ E♭♭ F G♭ A♭ B♭♭ C♭ C');
  });

  it('respells double accidentals plainly', () => {
    expect(bebopB9b13(note('Db')).map((t) => noteName(plainSpelling(t.note))).join(' ')).toBe('D♭ D F G♭ A♭ A C♭ C');
    expect(noteName(plainSpelling(note('F##')))).toBe('G');
    expect(noteName(plainSpelling(note('Fbb')))).toBe('E♭');
    expect(noteName(plainSpelling(note('Eb')))).toBe('E♭');
  });
});

describe('play-along cycles', () => {
  const names = (c: Cycle) => cycleBars(c).map(chordName).join(' ');

  it('lays out ii | V | I | I', () => {
    const [c] = cadencesFor([0], 'major');
    expect(names({ cadence: c, rep: 1 })).toBe('Dm7 G7 Cmaj7 Cmaj7');
  });

  it('uses the relative minor for minor ii–V–i', () => {
    expect(cadencesFor([0], 'minor').map((c) => chordName(c.chords[1]))).toEqual(['E7']);
    expect(cadencesFor([0, 5], 'mix').length).toBe(4);
  });

  it('never repeats a key back to back when there is a choice', () => {
    let prev: Cycle | null = null;
    for (let i = 0; i < 200; i++) {
      const c = nextCycle(prev, KEY_CYCLE, 'mix', 1);
      if (prev) expect(c.cadence).not.toEqual(prev.cadence);
      prev = c;
    }
  });

  it('holds a key for `repeat` cycles, then moves on', () => {
    const a = nextCycle(null, [0, 5], 'major', 3, () => 0);
    const b = nextCycle(a, [0, 5], 'major', 3);
    const c = nextCycle(b, [0, 5], 'major', 3);
    const d = nextCycle(c, [0, 5], 'major', 3);
    expect([a.rep, b.rep, c.rep, d.rep]).toEqual([1, 2, 3, 1]);
    expect(noteName(c.cadence.tonic)).toBe('C');
    expect(noteName(d.cadence.tonic)).toBe('F');
  });

  it('keeps going with a single key', () => {
    const a = nextCycle(null, [0], 'minor', 1);
    expect(noteName(nextCycle(a, [0], 'minor', 1).cadence.tonic)).toBe('A');
  });
});

describe('metronome', () => {
  it('cycles a beat through click, accent and silent', () => {
    expect([nextClick(1), nextClick(2), nextClick(0)]).toEqual([2, 0, 1]);
  });

  it('keeps the pattern when changing beats, new beats clicking', () => {
    const m = { clicks: [2, 0, 1, 0] as Click[], countIn: false };
    expect(withBeats(m, 6)).toEqual({ clicks: [2, 0, 1, 0, 1, 1], countIn: false });
    expect(withBeats(m, 3).clicks).toEqual([2, 0, 1]);
    expect(withBeats(m, 0).clicks).toEqual([2]);
    expect(withBeats(m, 99).clicks).toHaveLength(12);
  });

  it('repairs what storage held', () => {
    expect(cleanMetronome({ clicks: [], countIn: false }, everyBeat(4))).toEqual({ clicks: [2, 1, 1, 1], countIn: false });
    expect(cleanMetronome('junk', backbeat())).toEqual(backbeat());
  });
});
