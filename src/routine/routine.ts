// The practice routine: a few exercises in fixed slots, the rest on a shelf, each with a tempo log.
// Exercises are data the player writes in the app, so everything read from storage is checked here.

import type { Mode } from '../play/cycles';
import { backbeat, cleanMetronome, everyBeat, type Metronome } from '../play/metronome';
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

/** Notes a round draws from. `accidentals` and `spellings` count C♯ and D♭ as two notes. */
export type NoteSet = 'naturals' | 'accidentals' | 'all' | 'spellings';

export interface FretStage {
  title: string;
  /** What to do, from the lesson. */
  how: string;
  set: NoteSet;
  /**
   * reps: one note at a time with no metronome, three clean runs each, every note twice.
   * hold: one note at a time on the metronome, until you move on.
   * pair: two notes, the first going up and the second coming down, until you change them.
   * round: every note of the set once, in a random order shown up front, a new one each pass, then stop.
   */
  play: 'reps' | 'hold' | 'pair' | 'round';
}

/**
 * Stages of the fretboard notes exercise: 1–5 from the lesson, 6 and 7 carry stage 5 on to all 12
 * notes and then to every spelling. Numbered from 1, as in the lesson.
 */
export const FRET_STAGES: FretStage[] = [
  {
    title: 'One note, no metronome',
    how: 'Play the note on each string, low to high then high to low. Three times without a mistake, then the next note. All 7, twice.',
    set: 'naturals',
    play: 'reps',
  },
  { title: 'One note on the beat', how: 'One string per beat, up then down, until it’s clean. Then the next note, until all 7 are clean.', set: 'naturals', play: 'hold' },
  { title: 'Sharps & flats', how: 'As stage 2 with every sharp and flat. C♯ and D♭ come up separately.', set: 'accidentals', play: 'hold' },
  { title: 'Two notes', how: 'First note up, second note down, without stopping. Change the pair until it feels easy.', set: 'naturals', play: 'pair' },
  {
    title: 'All 7 in a row',
    how: 'Stage 4 with all 7 naturals: play them in the order shown, a new note each time you reach the last string, without stopping.',
    set: 'naturals',
    play: 'round',
  },
  { title: 'All 12 in a row', how: 'As stage 5 with all 12 notes, black keys spelled either way.', set: 'all', play: 'round' },
  { title: 'Every spelling in a row', how: 'As stage 5 with all 17 names: C♯ and D♭ are separate notes.', set: 'spellings', play: 'round' },
];

export const fretStage = (stage: number) => FRET_STAGES[stage - 1];

export type Prompt =
  /** Timer and metronome only, e.g. working on a song. */
  | { kind: 'none' }
  /**
   * Fretboard notes in stages (FRET_STAGES), a note per pass across the strings (a bar of the
   * metronome), alternating up and down. `bpms` keeps the tempo of the stages you're not on.
   */
  | { kind: 'notes'; stage: number; bpms: Record<number, number> }
  /** Chords from the home screen's keys, `barsEach` bars per chord. */
  | { kind: 'chords'; progression: Progression; mode: Mode; barsEach: number }
  /** The ii–V–I bebop scale play-along, with its own tempo and settings. */
  | { kind: 'playAlong' };

export type ChordsPrompt = Extract<Prompt, { kind: 'chords' }>;
export type NotesPrompt = Extract<Prompt, { kind: 'notes' }>;

export interface LogEntry {
  /** Local date, "YYYY-MM-DD". */
  d: string;
  /** Tempo played at, or null when the metronome never ran. */
  bpm: number | null;
  clean: boolean;
  /** Stage played, for staged exercises. */
  stage?: number;
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
  /** Tempo; for a staged exercise, the current stage's. */
  bpm: number;
  goalBpm: number | null;
  /** Counts against the slot's minutes. Off for exercises that run until they're clean. */
  timed: boolean;
  metronome: Metronome;
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
    timed: true,
    metronome: everyBeat(4),
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
          'Frets 1–12, no open strings. Play the note on every string: low to high on ↑, high to low on ↓. Pick the stage at the top.\nRepeat stages 2–5, a little faster each time. Goal: 80. Then stages 6 and 7.\nhttps://www.youtube.com/watch?v=PJddQ6Q0UDo',
        prompt: { kind: 'notes', stage: 1, bpms: {} },
        metronome: everyBeat(6),
        bpm: 40,
        goalBpm: 80,
        timed: false,
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
const isStage = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= FRET_STAGES.length;

function cleanPrompt(raw: unknown): Prompt {
  if (!isObj(raw)) return { kind: 'none' };
  switch (raw.kind) {
    case 'notes': {
      // Before stages, the note set was the setting: random naturals is stage 5, all 12 is stage 6.
      const stage = isStage(raw.stage) ? raw.stage : raw.set === 'all' ? 6 : 5;
      const bpms: Record<number, number> = {};
      if (isObj(raw.bpms)) for (const [k, v] of Object.entries(raw.bpms)) if (isStage(Number(k)) && typeof v === 'number') bpms[Number(k)] = clampBpm(v);
      return { kind: 'notes', stage, bpms };
    }
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
    .map((e) => ({
      d: e.d as string,
      bpm: typeof e.bpm === 'number' ? clampBpm(e.bpm) : null,
      clean: e.clean as boolean,
      ...(isStage(e.stage) && { stage: e.stage }),
    }));
}

/** The metronome from before it was shared: every beat (beats each, for notes), or 2 and 4. */
function oldMetronome(raw: Raw): Metronome {
  if (isObj(raw.prompt) && raw.prompt.kind === 'notes') return everyBeat(oneOf(raw.prompt.beatsEach, [4, 6, 8], 6));
  return raw.backbeat === true ? backbeat() : everyBeat(4);
}

function cleanExercise(raw: Raw): Exercise {
  const base = newExercise(raw.id as string);
  const prompt = cleanPrompt(raw.prompt);
  let log = cleanLog(raw.log);
  // Runs logged before stages were added belong to the stage the exercise was on.
  if (prompt.kind === 'notes') log = log.map((l) => (l.stage ? l : { ...l, stage: prompt.stage }));
  return {
    ...base,
    name: typeof raw.name === 'string' ? raw.name : base.name,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    prompt,
    cues: Array.isArray(raw.cues) ? raw.cues.filter((c): c is string => typeof c === 'string' && c.trim() !== '') : [],
    cueOrder: oneOf(raw.cueOrder, ['turn', 'random'] as const, 'turn'),
    cueEvery: posInt(raw.cueEvery, base.cueEvery),
    bpm: typeof raw.bpm === 'number' ? clampBpm(raw.bpm) : base.bpm,
    goalBpm: typeof raw.goalBpm === 'number' ? clampBpm(raw.goalBpm) : null,
    timed: raw.timed !== false,
    metronome: cleanMetronome(raw.metronome, oldMetronome(raw)),
    piano: raw.piano !== false,
    log,
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

/** The stage a staged exercise is on. */
export const stageOf = (e: Exercise): number | undefined => (e.prompt.kind === 'notes' ? e.prompt.stage : undefined);

/** Runs at the current stage; every run for an exercise without stages. */
export function stageLog(e: Exercise): LogEntry[] {
  const stage = stageOf(e);
  return stage === undefined ? e.log : e.log.filter((l) => l.stage === stage);
}

/** Moves a staged exercise to another stage, keeping each stage's tempo. A new stage starts at 40. */
export function changeStage(e: Exercise, stage: number): Exercise {
  const p = e.prompt;
  if (p.kind !== 'notes' || p.stage === stage || !isStage(stage)) return e;
  const bpms = { ...p.bpms, [p.stage]: e.bpm };
  return { ...e, bpm: bpms[stage] ?? BPM_MIN, prompt: { ...p, stage, bpms } };
}

export function setStage(r: Routine, id: string, stage: number): Routine {
  const e = findExercise(r, id);
  return e ? saveExercise(r, changeStage(e, stage)) : r;
}

/** How much to speed up after clean runs. */
export const TEMPO_STEP = 4;

/**
 * What to suggest after a run at `bpm` (at the current stage, for a staged exercise). Two clean runs in a row at that tempo or faster suggest
 * going up a step (no further than the goal); a clean run at the goal means the exercise is done.
 */
export function tempoAdvice(e: Exercise, bpm: number): { suggest: number | null; goalReached: boolean } {
  const log = stageLog(e);
  const last = log.at(-1);
  const goalReached = e.goalBpm !== null && !!last?.clean && last.bpm !== null && last.bpm >= e.goalBpm;
  const recent = log.slice(-2);
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

/** Per-day tempos for the history chart (at the current stage), oldest first, the last `days` days played. */
export function tempoHistory(e: Exercise, days = 30): DayTempo[] {
  const byDay = new Map<string, DayTempo>();
  for (const l of stageLog(e)) {
    if (l.bpm === null) continue;
    const day = byDay.get(l.d) ?? { d: l.d, clean: null, messy: null };
    const k = l.clean ? 'clean' : 'messy';
    day[k] = Math.max(day[k] ?? BPM_MIN, l.bpm);
    byDay.set(l.d, day);
  }
  return [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d)).slice(-days);
}
