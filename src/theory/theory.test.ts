import { describe, expect, it } from 'vitest';
import { chord, chordName, chordTones, type Quality } from './chords';
import { fretsFor, pitchAt } from './fretboard';
import { chordPool, diatonicChords, MAJOR_KEYS, MINOR_KEYS, twoFiveOne } from './keys';
import { accepts, GRID_ROWS, note, noteName, pc, sameNote } from './notes';

const spell = (root: string, q: Quality) => chordTones(chord(root, q)).map(noteName).join(' ');

describe('chord spelling', () => {
  it('spells the core qualities', () => {
    expect(spell('C', 'maj7')).toBe('C E G B');
    expect(spell('Eb', 'dom7')).toBe('E♭ G B♭ D♭');
    expect(spell('Bb', 'm7')).toBe('B♭ D♭ F A♭');
    expect(spell('F#', 'm7b5')).toBe('F♯ A C E');
    expect(spell('C', 'dim7')).toBe('C E♭ G♭ B♭♭');
  });

  it('keeps one letter per chord tone in awkward keys', () => {
    expect(spell('G#', 'dom7')).toBe('G♯ B♯ D♯ F♯');
    expect(spell('Cb', 'maj7')).toBe('C♭ E♭ G♭ B♭');
    expect(spell('A#', 'm7b5')).toBe('A♯ C♯ E G♯');
    expect(spell('Db', 'dom7')).toBe('D♭ F A♭ C♭');
  });
});

describe('keys', () => {
  const names = (key: string) => diatonicChords(note(key)).map(chordName).join(' ');

  it('builds diatonic 7th chords', () => {
    expect(names('C')).toBe('Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5');
    expect(names('Ab')).toBe('A♭maj7 B♭m7 Cm7 D♭maj7 E♭7 Fm7 Gm7♭5');
    expect(names('B')).toBe('Bmaj7 C♯m7 D♯m7 Emaj7 F♯7 G♯m7 A♯m7♭5');
    expect(names('Gb')).toBe('G♭maj7 A♭m7 B♭m7 C♭maj7 D♭7 E♭m7 Fm7♭5');
  });

  it('builds major and minor ii–V–i', () => {
    const cad = (t: string, minor: boolean) => twoFiveOne(note(t), minor).chords.map(chordName).join(' ');
    expect(cad('F', false)).toBe('Gm7 C7 Fmaj7');
    expect(cad('C', true)).toBe('Dm7♭5 G7 Cm7');
    expect(cad('Ab', true)).toBe('B♭m7♭5 E♭7 A♭m7');
    expect(cad('C#', true)).toBe('D♯m7♭5 G♯7 C♯m7');
  });

  it('has 12 distinct major and minor keys', () => {
    expect(new Set(MAJOR_KEYS.map(noteName)).size).toBe(12);
    expect(new Set(MINOR_KEYS.map(noteName)).size).toBe(12);
  });
});

describe('chord pool', () => {
  const pool = chordPool();

  it('covers every pitch class for every quality', () => {
    for (const q of ['maj7', 'dom7', 'm7', 'm7b5', 'dim7'] as Quality[]) {
      expect(new Set(pool.filter((c) => c.quality === q).map((c) => pc(c.root))).size).toBe(12);
    }
    expect(pool.length).toBe(66);
  });

  it('only needs double accidentals on diminished 7ths, and the grid can answer them', () => {
    const gridNotes = GRID_ROWS.flat();
    for (const c of pool) {
      for (const t of chordTones(c)) {
        if (Math.abs(t.acc) === 2) expect(c.quality).toBe('dim7');
        expect(gridNotes.some((g) => accepts(t, g))).toBe(true);
      }
    }
  });
});

describe('answer checking', () => {
  it('accepts any spelling of the right pitch', () => {
    expect(accepts(note('Bbb'), note('A'))).toBe(true);
    expect(accepts(note('Fb'), note('E'))).toBe(true);
    expect(accepts(note('Gb'), note('F#'))).toBe(true);
    expect(accepts(note('Fb'), note('F'))).toBe(false);
    expect(sameNote(note('Eb'), note('E♭'))).toBe(true);
  });
});

describe('fretboard', () => {
  it('finds notes in standard tuning', () => {
    expect(pitchAt(0, 0)).toBe(4);
    expect(pitchAt(1, 3)).toBe(0);
    expect(pitchAt(4, 1)).toBe(0);
    expect(fretsFor(0, 4)).toEqual([0, 12]);
    expect(fretsFor(2, 7)).toEqual([5]);
  });
});
