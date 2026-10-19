// The practice routine: a few exercises in fixed slots, the rest on a shelf, each with a tempo log.
// Exercises are data the player writes in the app, so everything read from storage is checked here.

import type { Mode } from '../play/cycles';
import { BPM_MAX, BPM_MIN, clampBpm } from '../play/tempo';

export type SlotId = 'warmup' | 'focus' | 'apply';

export const SLOTS: { id: SlotId; title: string }[] = [
  { id: 'warmup', title: 'Warm-up' },
  { id: 'focus', title: 'Focus' },
  { id: 'apply', title: 'Apply' },
];

/** Minutes a slot can be set to. */
export const MINUTES = [5, 10, 15, 20, 30];

export type Progression = 'iiVI' | 'diatonic' | 'vamp';

export type Prompt =
  /** Timer and metronome only, e.g. working on a song. */
  | { kind: 'none' }
  /** A random note per pass across the strings, alternating up and down. */
  | { kind: 'notes'; set: 'naturals' | 'all'; beatsEach: number }
  /** Chords from the home screen's keys, `barsEach` bars per chord. */
  | { kind: 'chords'; progression: Progression; mode: Mode; barsEach: number }
  /** The ii–V–I bebop scale play-along, with its own tempo and settings. */
  | { kind: 'playAlong' };

export type ChordsPrompt = Extract<Prompt, { kind: 'chords' }>;

export interface LogEntry {
  /** Local date, "YYYY-MM-DD". */
  d: string;
  /** Tempo played at, or null when the metronome never ran. */
  bpm: number | null;
  clean: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  notes: string;
  prompt: Prompt;
  /** Ideas shown one at a time while playing (CAGED shapes, a modal idea per bar…). */
  cues: string[];
  cueOrder: 'turn' | 'random';
  /** Bars per cue; for a notes prompt, notes per cue. */
  cueEvery: number;
  bpm: number;
  goalBpm: number | null;
  /** Click on 2 and 4 rather than every beat (chords and none prompts). */
  backbeat: boolean;
  /** Piano plays the chords (chords prompts). */
  piano: boolean;
  log: LogEntry[];
}

export interface Slot {
  exercise: string | null;
  minutes: number;
}

export interface Routine {
  slots: Record<SlotId, Slot>;
  /** Every exercise; the ones not in a slot are the shelf. */
  exercises: Exercise[];
}

export const BEATS_EACH = [4, 6, 8];
export const BARS_EACH = [1, 2, 4];

const PROGRESSIONS: Progression[] = ['iiVI', 'diatonic', 'vamp'];
const MODES: Mode[] = ['major', 'minor', 'mix'];

export const newExerciseId = () => `x${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export function newExercise(id = newExerciseId()): Exercise {
  return {
    id,
    name: '',
    notes: '',
    prompt: { kind: 'none' },
    cues: [],
    cueOrder: 'turn',
    cueEvery: 4,
    bpm: 60,
    goalBpm: null,
    backbeat: false,
    piano: true,
    log: [],
  };
}

const ex = (id: string, fields: Partial<Exercise>): Exercise => ({ ...newExercise(id), ...fields });
const iiVI = (barsEach = 1): Prompt => ({ kind: 'chords', progression: 'iiVI', mode: 'major', barsEach });

/** The exercises from the lesson notes the app started with. */
export function seedRoutine(): Routine {
  return {
    slots: {
      warmup: { exercise: 'fretboard', minutes: 5 },
      focus: { exercise: 'bebop', minutes: 15 },
      apply: { exercise: 'arpeggios', minutes: 10 },
    },
    exercises: [
      ex('fretboard', {
        name: 'Fretboard notes',
        notes:
          'Frets 1–12, no open strings. Play the note on every string, one per beat: low to high on ↑, high to low on ↓. Move to the next note without stopping.\nWhen 7 naturals are clean at a tempo twice, go up a little. Goal: 80. Then switch to all 12 notes.',
        prompt: { kind: 'notes', set: 'naturals', beatsEach: 6 },
        bpm: 40,
        goalBpm: 80,
      }),
      ex('bebop', {
        name: 'ii–V–I ♭9♭13 bebop scale',
        notes: 'Bebop scale of the V (1 ♭2 3 4 5 ♭6 ♭7 7) through the ii and V bars, then improvise 2 bars over the I.',
        prompt: { kind: 'playAlong' },
      }),
      ex('arpeggios', {
        name: 'Arpeggios in CAGED shapes',
        notes: 'Stay inside the shape. Alternate direction each chord: Cmaj7 down, Dm7 up… Say the degree you start each one on.',
        prompt: { kind: 'chords', progression: 'diatonic', mode: 'major', barsEach: 1 },
        cues: ['C shape', 'A shape', 'G shape', 'E shape', 'D shape'],
        cueEvery: 7,
        goalBpm: 100,
      }),
      ex('song', {
        name: 'Song: Larry Carlton track (Guthrie Govan)',
        notes: 'Why is he playing those notes over those chords? Pull out licks, add them to your playing, then change them.',
      }),
      ex('arp-scale', {
        name: 'Arpeggio down, scale up',
        notes: 'Arpeggio down, then scale up, inside 4 beats. Then the next chord.',
        prompt: iiVI(),
      }),
      ex('drop2', {
        name: 'Drop 2 / drop 3 voice leading',
        notes: 'Resolve the leading tone of one chord to the 3rd of the next (Dm7 → G7 → C: C → B, F → E). Inversions, closest voicing each change.',
        prompt: iiVI(),
        cues: ['Root on 6th string', 'Root on 5th string', 'Root on 4th string'],
      }),
      ex('triads', {
        name: 'Triad voice-leading cycles',
        notes: 'Close and spread voicings.\nhttps://modernguitarharmony.com/wp-content/uploads/2023/05/Volume-1-Voice-leading-1.pdf',
      }),
      ex('modal', {
        name: 'Modal vamp: one idea per bar',
        notes: 'A new idea every bar instead of the same thing for 4 bars. Triad pairs: two chords of the same quality, 6 notes.',
        prompt: { kind: 'chords', progression: 'vamp', mode: 'minor', barsEach: 4 },
        cues: ['Dorian', 'Triad pairs', 'Harmonic minor', 'Pentatonic'],
        cueEvery: 1,
        bpm: 80,
      }),
      ex('cells', {
        name: 'Melodic cells',
        notes: 'Major chords 1 2 3 5, minor chords 1 3 4 5.',
        prompt: iiVI(),
        bpm: 80,
      }),
      ex('enclosures', {
        name: 'Approach tones / enclosures',
        notes: 'Target chord tones: one diatonic note above, one chromatic below, then land.',
        prompt: iiVI(),
        bpm: 80,
      }),
      ex('intervals', {
        name: 'Intervals from each finger',
        notes: 'Start on a note under this finger and play every diatonic interval from it.',
        cues: ['Index', 'Middle', 'Ring', 'Pinky'],
      }),
      ex('rhythm', {
        name: 'Rhythm: notes per beat',
        notes: 'Run a 3nps scale, changing how many notes per beat.',
        cues: ['Triplets', '16ths', 'Sextuplets'],
        cueOrder: 'random',
        cueEvery: 2,
      }),
      ex('3nps', {
        name: '3nps scale positions',
        notes: 'Three notes per string, one position per starting note of the scale.',
        cues: ['Position 1', 'Position 2', 'Position 3', 'Position 4', 'Position 5', 'Position 6', 'Position 7'],
      }),
    ],
  };
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const posInt = (v: unknown, fallback: number) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : fallback);

function cleanPrompt(raw: unknown): Prompt {
  if (!isObj(raw)) return { kind: 'none' };
  switch (raw.kind) {
    case 'notes':
      return { kind: 'notes', set: oneOf(raw.set, ['naturals', 'all'] as const, 'naturals'), beatsEach: oneOf(raw.beatsEach, BEATS_EACH, 6) };
    case 'chords':
      return {
        kind: 'chords',
        progression: oneOf(raw.progression, PROGRESSIONS, 'iiVI'),
        mode: oneOf(raw.mode, MODES, 'major'),
        barsEach: oneOf(raw.barsEach, BARS_EACH, 1),
      };
    case 'playAlong':
      return { kind: 'playAlong' };
    default:
      return { kind: 'none' };
  }
}

function cleanLog(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Raw => isObj(e) && typeof e.d === 'string' && typeof e.clean === 'boolean')
    .map((e) => ({ d: e.d as string, bpm: typeof e.bpm === 'number' ? clampBpm(e.bpm) : null, clean: e.clean as boolean }));
}

function cleanExercise(raw: Raw): Exercise {
  const base = newExercise(raw.id as string);
  return {
    ...base,
    name: typeof raw.name === 'string' ? raw.name : base.name,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    prompt: cleanPrompt(raw.prompt),
    cues: Array.isArray(raw.cues) ? raw.cues.filter((c): c is string => typeof c === 'string' && c.trim() !== '') : [],
    cueOrder: oneOf(raw.cueOrder, ['turn', 'random'] as const, 'turn'),
    cueEvery: posInt(raw.cueEvery, base.cueEvery),
    bpm: typeof raw.bpm === 'number' ? clampBpm(raw.bpm) : base.bpm,
    goalBpm: typeof raw.goalBpm === 'number' ? clampBpm(raw.goalBpm) : null,
    backbeat: raw.backbeat === true,
    piano: raw.piano !== false,
    log: cleanLog(raw.log),
  };
}

/** A routine read from storage, with anything unusable dropped or reset. Nothing stored → the seed. */
export function cleanRoutine(raw: unknown): Routine {
  if (!isObj(raw) || !Array.isArray(raw.exercises)) return seedRoutine();
  const seen = new Set<string>();
  const exercises: Exercise[] = [];
  for (const e of raw.exercises) {
    if (!isObj(e) || typeof e.id !== 'string' || e.id === '' || seen.has(e.id)) continue;
    seen.add(e.id);
    exercises.push(cleanExercise(e));
  }
  const seed = seedRoutine().slots;
  const rawSlots = isObj(raw.slots) ? raw.slots : {};
  const used = new Set<string>();
  const slots = {} as Record<SlotId, Slot>;
  for (const { id } of SLOTS) {
    const s = isObj(rawSlots[id]) ? (rawSlots[id] as Raw) : {};
    const exercise = typeof s.exercise === 'string' && seen.has(s.exercise) && !used.has(s.exercise) ? s.exercise : null;
    if (exercise) used.add(exercise);
    slots[id] = { exercise, minutes: oneOf(s.minutes, MINUTES, seed[id].minutes) };
  }
  return { slots, exercises };
}

export const findExercise = (r: Routine, id: string | null) => r.exercises.find((e) => e.id === id);

export const slotOf = (r: Routine, id: string): SlotId | undefined => SLOTS.find((s) => r.slots[s.id].exercise === id)?.id;

/** The exercises not in any slot. */
export const shelf = (r: Routine) => r.exercises.filter((e) => !slotOf(r, e.id));

/** Puts an exercise in a slot (or empties it with null). Whatever was there goes back to the shelf. */
export function assign(r: Routine, slot: SlotId, id: string | null): Routine {
  const slots = { ...r.slots };
  for (const { id: s } of SLOTS) if (id && slots[s].exercise === id) slots[s] = { ...slots[s], exercise: null };
  slots[slot] = { ...slots[slot], exercise: id };
  return { ...r, slots };
}

export const setMinutes = (r: Routine, slot: SlotId, minutes: number): Routine => ({
  ...r,
  slots: { ...r.slots, [slot]: { ...r.slots[slot], minutes } },
});

/** Adds the exercise, or replaces the one with the same id. */
export function saveExercise(r: Routine, e: Exercise): Routine {
  const exists = r.exercises.some((x) => x.id === e.id);
  return { ...r, exercises: exists ? r.exercises.map((x) => (x.id === e.id ? e : x)) : [...r.exercises, e] };
}

export const updateExercise = (r: Routine, id: string, patch: Partial<Exercise>): Routine => ({
  ...r,
  exercises: r.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
});

export function deleteExercise(r: Routine, id: string): Routine {
  const slot = slotOf(r, id);
  const without = { ...r, exercises: r.exercises.filter((e) => e.id !== id) };
  return slot ? assign(without, slot, null) : without;
}

export const logResult = (r: Routine, id: string, entry: LogEntry): Routine => {
  const e = findExercise(r, id);
  return e ? updateExercise(r, id, { log: [...e.log, entry] }) : r;
};

/** Days with at least one exercise finished. */
export function practicedDays(r: Routine): Set<string> {
  return new Set(r.exercises.flatMap((e) => e.log.map((l) => l.d)));
}

export const doneOn = (e: Exercise, day: string) => e.log.some((l) => l.d === day);

/** How much to speed up after clean runs. */
export const TEMPO_STEP = 4;

/**
 * What to suggest after a run at `bpm`. Two clean runs in a row at that tempo or faster suggest
 * going up a step (no further than the goal); a clean run at the goal means the exercise is done.
 */
export function tempoAdvice(e: Exercise, bpm: number): { suggest: number | null; goalReached: boolean } {
  const last = e.log.at(-1);
  const goalReached = e.goalBpm !== null && !!last?.clean && last.bpm !== null && last.bpm >= e.goalBpm;
  const recent = e.log.slice(-2);
  const steady = recent.length === 2 && recent.every((l) => l.clean && l.bpm !== null && l.bpm >= bpm);
  const next = Math.min(BPM_MAX, e.goalBpm ?? BPM_MAX, bpm + TEMPO_STEP);
  return { suggest: !goalReached && steady && next > bpm ? next : null, goalReached };
}

export interface DayTempo {
  d: string;
  /** Fastest clean tempo that day. */
  clean: number | null;
  /** Fastest messy tempo that day. */
  messy: number | null;
}

/** Per-day tempos for the history chart, oldest first, the last `days` days played. */
export function tempoHistory(e: Exercise, days = 30): DayTempo[] {
  const byDay = new Map<string, DayTempo>();
  for (const l of e.log) {
    if (l.bpm === null) continue;
    const day = byDay.get(l.d) ?? { d: l.d, clean: null, messy: null };
    const k = l.clean ? 'clean' : 'messy';
    day[k] = Math.max(day[k] ?? BPM_MIN, l.bpm);
    byDay.set(l.d, day);
  }
  return [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d)).slice(-days);
}
