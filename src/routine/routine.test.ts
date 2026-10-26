import { describe, expect, it } from 'vitest';
import { emptyProgress, streakDays } from '../srs/progress';
import { chordName } from '../theory/chords';
import { pc } from '../theory/notes';
import { chordPass, goesUp, nextCue, noteRound } from './prompts';
import {
  assign,
  changeStage,
  type ChordsPrompt,
  cleanRoutine,
  deleteExercise,
  type Exercise,
  findExercise,
  logResult,
  newExercise,
  type Routine,
  seedRoutine,
  shelf,
  setStage,
  slotOf,
  stageLog,
  tempoAdvice,
  tempoHistory,
} from './routine';

/** A repeatable stand-in for Math.random. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const withLog = (e: Exercise, log: [number | null, boolean][]): Exercise => ({
  ...e,
  log: log.map(([bpm, clean], i) => ({ d: `2026-10-${String(i + 1).padStart(2, '0')}`, bpm, clean })),
});

describe('routine storage', () => {
  it('seeds three slots from the lesson notes, the rest on the shelf', () => {
    const r = seedRoutine();
    expect(findExercise(r, r.slots.warmup.exercise)?.name).toBe('Fretboard notes');
    expect(findExercise(r, r.slots.focus.exercise)?.prompt.kind).toBe('playAlong');
    expect(shelf(r).length).toBe(r.exercises.length - 3);
    expect(new Set(r.exercises.map((e) => e.id)).size).toBe(r.exercises.length);
  });

  it('round-trips through cleaning unchanged', () => {
    const r = seedRoutine();
    expect(cleanRoutine(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it('falls back to the seed for nothing stored, and repairs junk', () => {
    expect(cleanRoutine(undefined)).toEqual(seedRoutine());
    const r = cleanRoutine({
      slots: { warmup: { exercise: 'a', minutes: 7 }, focus: { exercise: 'a' }, apply: { exercise: 'gone' } },
      exercises: [
        { id: 'a', name: 'A', bpm: 999, prompt: { kind: 'notes', beatsEach: 5 }, cues: ['x', 3, ' '], log: [{ d: '2026-10-01', bpm: 50, clean: true }, 'junk'] },
        { id: 'a', name: 'duplicate' },
        { name: 'no id' },
      ],
    });
    expect(r.exercises.map((e) => e.name)).toEqual(['A']);
    const a = r.exercises[0];
    expect(a.bpm).toBe(240);
    expect(a.prompt).toEqual({ kind: 'notes', stage: 5, beatsEach: 6, bpms: {} });
    expect(a.cues).toEqual(['x']);
    expect(a.log).toEqual([{ d: '2026-10-01', bpm: 50, clean: true, stage: 5 }]);
    expect(a.timed).toBe(true);
    // One exercise can't fill two slots, and a missing one leaves its slot empty.
    expect(r.slots.warmup).toEqual({ exercise: 'a', minutes: 5 });
    expect(r.slots.focus.exercise).toBeNull();
    expect(r.slots.apply.exercise).toBeNull();
  });

  it('turns the old note sets into stages, keeping their runs', () => {
    const load = (prompt: object, log: object[] = []) => cleanRoutine({ exercises: [{ id: 'f', prompt, log }] }).exercises[0];
    expect(load({ kind: 'notes', set: 'all', beatsEach: 6 }).prompt).toMatchObject({ stage: 6 });
    const f = load({ kind: 'notes', set: 'naturals', beatsEach: 8 }, [{ d: '2026-10-01', bpm: 60, clean: true }]);
    expect(f.prompt).toEqual({ kind: 'notes', stage: 5, beatsEach: 8, bpms: {} });
    expect(stageLog(f)).toHaveLength(1);
    expect(load({ kind: 'notes', stage: 9, bpms: { 2: 999, 8: 50, x: 1 } }).prompt).toMatchObject({ stage: 5, bpms: { 2: 240 } });
  });

  it('keeps an exercise untimed', () => {
    const r = cleanRoutine({ exercises: [{ id: 'a', timed: false }, { id: 'b' }] });
    expect(r.exercises.map((e) => e.timed)).toEqual([false, true]);
    expect(findExercise(seedRoutine(), 'fretboard')?.timed).toBe(false);
  });

  it('keeps the routine when loading old progress without one', () => {
    expect(emptyProgress().routine).toEqual(seedRoutine());
  });
});

describe('slots and shelf', () => {
  it('sends the exercise a slot held back to the shelf', () => {
    const r = assign(seedRoutine(), 'focus', 'drop2');
    expect(r.slots.focus.exercise).toBe('drop2');
    expect(slotOf(r, 'bebop')).toBeUndefined();
    expect(shelf(r).map((e) => e.id)).toContain('bebop');
  });

  it('moves an exercise between slots rather than copying it', () => {
    const r = assign(seedRoutine(), 'apply', 'fretboard');
    expect(r.slots.apply.exercise).toBe('fretboard');
    expect(r.slots.warmup.exercise).toBeNull();
  });

  it('empties the slot of a deleted exercise', () => {
    const r = deleteExercise(seedRoutine(), 'arpeggios');
    expect(r.slots.apply.exercise).toBeNull();
    expect(findExercise(r, 'arpeggios')).toBeUndefined();
  });
});

describe('tempo', () => {
  const e: Exercise = { ...newExercise('t'), bpm: 40, goalBpm: 80 };

  it('suggests going up after two clean runs in a row', () => {
    expect(tempoAdvice(withLog(e, [[40, true]]), 40).suggest).toBeNull();
    expect(tempoAdvice(withLog(e, [[40, true], [40, true]]), 40).suggest).toBe(44);
    expect(tempoAdvice(withLog(e, [[40, true], [40, false]]), 40).suggest).toBeNull();
    // Clean runs at a slower tempo don't count toward this one.
    expect(tempoAdvice(withLog(e, [[40, true], [40, true]]), 44).suggest).toBeNull();
  });

  it('stops at the goal and says when it is reached', () => {
    expect(tempoAdvice(withLog(e, [[78, true], [78, true]]), 78).suggest).toBe(80);
    expect(tempoAdvice(withLog(e, [[80, true]]), 80)).toEqual({ suggest: null, goalReached: true });
    expect(tempoAdvice(withLog(e, [[80, false]]), 80).goalReached).toBe(false);
  });

  it('charts the fastest clean and messy tempo per day', () => {
    const r = [
      { d: '2026-10-02', bpm: 44, clean: false },
      { d: '2026-10-01', bpm: 40, clean: true },
      { d: '2026-10-02', bpm: 40, clean: true },
      { d: '2026-10-02', bpm: 48, clean: false },
      { d: '2026-10-03', bpm: null, clean: true },
      { d: '2026-10-02', bpm: 60, clean: true, stage: 2 },
    ]
      .map((entry) => ({ stage: 1, ...entry }))
      .reduce((acc: Routine, entry) => logResult(acc, 'fretboard', entry), seedRoutine());
    expect(tempoHistory(findExercise(r, 'fretboard')!)).toEqual([
      { d: '2026-10-01', clean: 40, messy: null },
      { d: '2026-10-02', clean: 40, messy: 48 },
    ]);
  });

  it('keeps tempo and advice per stage', () => {
    const f = findExercise(seedRoutine(), 'fretboard')!;
    expect(f.prompt).toMatchObject({ stage: 1 });
    const at2 = { ...changeStage(f, 2), bpm: 52 };
    const at5 = changeStage(at2, 5);
    expect(at5.bpm).toBe(40);
    expect(changeStage(at5, 2).bpm).toBe(52);
    expect(changeStage(at5, 8)).toBe(at5);

    const logged = { ...at5, log: [{ d: '2026-10-01', bpm: 52, clean: true, stage: 2 }, { d: '2026-10-02', bpm: 52, clean: true, stage: 2 }] };
    expect(tempoAdvice(logged, 52).suggest).toBeNull();
    expect(tempoAdvice(changeStage(logged, 2), 52).suggest).toBe(56);

    const r = setStage(seedRoutine(), 'fretboard', 3);
    expect(findExercise(r, 'fretboard')?.prompt).toMatchObject({ stage: 3, bpms: { 1: 40 } });
  });

  it('counts routine days in the streak', () => {
    const p = emptyProgress();
    p.routine = logResult(p.routine, 'fretboard', { d: '2026-10-18', bpm: 40, clean: true });
    p.days['2026-10-19'] = 5;
    expect(streakDays(p, new Date(2026, 9, 19))).toBe(2);
  });
});

describe('prompts', () => {
  it('plays every natural once per round, never the same note twice running', () => {
    const rng = seeded(7);
    let last = null;
    for (let i = 0; i < 50; i++) {
      const round = noteRound('naturals', last, rng);
      expect(round.map(pc).sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
      if (last) expect(pc(round[0])).not.toBe(pc(last));
      last = round.at(-1)!;
    }
  });

  it('spells black keys both ways when all 12 are on', () => {
    const rng = seeded(3);
    const names = new Set(Array.from({ length: 40 }, () => noteRound('all', null, rng)).flat().filter((n) => n.acc !== 0).map((n) => n.acc));
    expect(names).toEqual(new Set([1, -1]));
    expect(noteRound('all', null, rng).length).toBe(12);
  });

  it('gives every sharp and flat its own turn, never the same fret twice running', () => {
    const rng = seeded(9);
    let last = null;
    for (let i = 0; i < 50; i++) {
      for (const set of ['accidentals', 'spellings'] as const) {
        const round = noteRound(set, last, rng);
        expect(round.length).toBe(set === 'accidentals' ? 10 : 17);
        expect(new Set(round.map((n) => `${n.letter}${n.acc}`)).size).toBe(round.length);
        const frets = (last ? [last, ...round] : round).map(pc);
        frets.slice(1).forEach((f, k) => expect(f).not.toBe(frets[k]));
        last = round.at(-1)!;
      }
    }
  });

  it('alternates up and down, starting up', () => {
    expect([0, 1, 2, 3].map(goesUp)).toEqual([true, false, true, false]);
  });

  const prompt = (p: Partial<ChordsPrompt>): ChordsPrompt => ({ kind: 'chords', progression: 'iiVI', mode: 'major', barsEach: 1, ...p });
  const names = (bars: { chord: Parameters<typeof chordName>[0] }[]) => bars.map((b) => chordName(b.chord)).join(' ');

  it('walks the diatonic chords of a key in order', () => {
    expect(names(chordPass(prompt({ progression: 'diatonic' }), [0], null))).toBe('Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5');
  });

  it('lays out ii | V | I | I and stretches bars', () => {
    expect(names(chordPass(prompt({}), [5], null))).toBe('Gm7 C7 Fmaj7 Fmaj7');
    expect(names(chordPass(prompt({ barsEach: 2 }), [0], null))).toBe('Dm7 Dm7 G7 G7 Cmaj7 Cmaj7 Cmaj7 Cmaj7');
    expect(chordPass(prompt({ mode: 'minor' }), [0], null)[0].key).toBe('A minor');
  });

  it('holds a vamp on the relative minor', () => {
    const bars = chordPass(prompt({ progression: 'vamp', mode: 'minor', barsEach: 4 }), [0], null);
    expect(names(bars)).toBe('Am7 Am7 Am7 Am7');
  });

  it('changes key between passes when it can', () => {
    const rng = seeded(11);
    let key: string | null = null;
    for (let i = 0; i < 20; i++) {
      const next: string = chordPass(prompt({}), [0, 5, 10], key, rng)[0].key;
      expect(next).not.toBe(key);
      key = next;
    }
  });

  it('takes cues in turn or at random without repeats', () => {
    expect([null, 0, 1, 2].map((p) => nextCue(3, 'turn', p))).toEqual([0, 1, 2, 0]);
    const rng = seeded(5);
    let prev = nextCue(4, 'random', null, rng);
    for (let i = 0; i < 30; i++) {
      const c = nextCue(4, 'random', prev, rng);
      expect(c).not.toBe(prev);
      prev = c;
    }
    expect(nextCue(1, 'random', 0, rng)).toBe(0);
  });
});
