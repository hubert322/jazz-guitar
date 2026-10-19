import { useEffect, useMemo, useRef, useState } from 'react';
import { chordPass, type ChordBar, goesUp, nextCue, noteRound } from '../routine/prompts';
import { assign, type Exercise, findExercise, logResult, type Routine, SLOTS, tempoAdvice, updateExercise } from '../routine/routine';
import { dayKey, type PlaySettings } from '../srs/progress';
import { type Chord, QUALITY_SYMBOL } from '../theory/chords';
import { type Note, noteName } from '../theory/notes';
import { nudge } from './feedback';
import { type Beat, createPlayer } from './metronome';
import { PlayAlong } from './PlayAlong';
import { VolumeStepper } from './questions';
import { Notes } from './routineText';
import { TempoControl } from './TempoControl';
import { useWakeLock } from './wakeLock';

interface Props {
  routine: Routine;
  keys: number[];
  play: PlaySettings;
  volume: number;
  onRoutine: (update: (r: Routine) => Routine) => void;
  onPlay: (play: PlaySettings) => void;
  onVolume: (volume: number) => void;
  onExit: () => void;
}

type Phase =
  | { name: 'run' }
  | { name: 'log'; bpm: number | null }
  | { name: 'faster'; bpm: number; suggest: number }
  | { name: 'goal'; bpm: number }
  | { name: 'end' };

/** Seconds since `start`, ticking once a second. */
function useElapsed(start: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.floor((now - start) / 1000));
}

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

export function Session({ routine, keys, play, volume, onRoutine, onPlay, onVolume, onExit }: Props) {
  // The slots to go through are fixed when the session starts.
  const [order] = useState(() => SLOTS.filter((s) => routine.slots[s.id].exercise));
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>({ name: 'run' });
  const [startedAt, setStartedAt] = useState(Date.now);
  /** Tempo the metronome last ran at in this slot, if it ran. */
  const ran = useRef<number | null>(null);
  const [done, setDone] = useState(0);
  useWakeLock(true);

  const slot = order[step];
  const exercise = slot && findExercise(routine, routine.slots[slot.id].exercise);
  const isPlayAlong = exercise?.prompt.kind === 'playAlong';

  const next = () => {
    if (step + 1 >= order.length) setPhase({ name: 'end' });
    else {
      setStep(step + 1);
      setPhase({ name: 'run' });
      setStartedAt(Date.now());
      ran.current = null;
    }
  };

  const finish = () => setPhase({ name: 'log', bpm: isPlayAlong ? play.bpm : ran.current });

  const log = (clean: boolean) => {
    if (!exercise || phase.name !== 'log') return;
    const entry = { d: dayKey(), bpm: phase.bpm, clean };
    const logged = { ...exercise, log: [...exercise.log, entry] };
    onRoutine((r) => logResult(r, exercise.id, entry));
    setDone((n) => n + 1);
    if (clean && phase.bpm !== null) {
      const { suggest, goalReached } = tempoAdvice(logged, phase.bpm);
      if (goalReached) return setPhase({ name: 'goal', bpm: phase.bpm });
      if (suggest) return setPhase({ name: 'faster', bpm: phase.bpm, suggest });
    }
    next();
  };

  const setTempo = (bpm: number) => {
    if (!exercise) return;
    if (isPlayAlong) onPlay({ ...play, bpm });
    else onRoutine((r) => updateExercise(r, exercise.id, { bpm }));
  };

  if (!exercise || phase.name === 'end') {
    return (
      <div className="screen session">
        <div className="session-end">
          <h1>{done > 0 ? 'Session done' : 'Nothing logged'}</h1>
          <p className="muted">
            {done} of {order.length} {order.length === 1 ? 'exercise' : 'exercises'} logged today.
          </p>
          <button type="button" className="start-btn" onClick={onExit}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const minutes = routine.slots[slot.id].minutes;

  return (
    <div className="screen session">
      <SlotStrip
        title={slot.title}
        step={step}
        count={order.length}
        startedAt={startedAt}
        minutes={minutes}
        volume={volume}
        onVolume={onVolume}
        onExit={onExit}
      />
      <div className="session-name">
        <h2>{exercise.name}</h2>
        {exercise.notes && (
          <details className="session-notes">
            <summary className="muted small">Notes</summary>
            <Notes text={exercise.notes} />
          </details>
        )}
      </div>

      {phase.name === 'run' &&
        (isPlayAlong ? (
          <PlayAlong keys={keys} play={play} volume={volume} onPlay={onPlay} onVolume={onVolume} onExit={onExit} embedded />
        ) : (
          <ExerciseRunner
            key={exercise.id}
            exercise={exercise}
            keys={keys}
            volume={volume}
            onPatch={(patch) => onRoutine((r) => updateExercise(r, exercise.id, patch))}
            onRun={(bpm) => (ran.current = bpm)}
          />
        ))}

      {phase.name === 'run' && (
        <div className="session-btns">
          <button type="button" className="ghost-btn" onClick={next}>
            Skip
          </button>
          <button type="button" className="start-btn done-btn" onClick={finish}>
            Done
          </button>
        </div>
      )}

      {phase.name === 'log' && (
        <div className="verdict">
          <p>How did it go{phase.bpm !== null ? ` at ${phase.bpm} bpm` : ''}?</p>
          <button type="button" className="start-btn" onClick={() => log(true)}>
            Clean
          </button>
          <button type="button" className="ghost-btn" onClick={() => log(false)}>
            Messy
          </button>
          <button type="button" className="link-btn" onClick={() => setPhase({ name: 'run' })}>
            Keep going
          </button>
        </div>
      )}

      {phase.name === 'faster' && (
        <div className="verdict">
          <p>Two clean runs at {phase.bpm}. Go up to {phase.suggest} next time?</p>
          <button
            type="button"
            className="start-btn"
            onClick={() => {
              setTempo(phase.suggest);
              next();
            }}
          >
            Yes, {phase.suggest} next time
          </button>
          <button type="button" className="ghost-btn" onClick={next}>
            Stay at {phase.bpm}
          </button>
        </div>
      )}

      {phase.name === 'goal' && (
        <div className="verdict">
          <p>
            Clean at {phase.bpm}: that's your goal. Put this back on the shelf and pick something new for {slot.title}?
          </p>
          <button
            type="button"
            className="start-btn"
            onClick={() => {
              onRoutine((r) => assign(r, slot.id, null));
              next();
            }}
          >
            Back to the shelf
          </button>
          <button type="button" className="ghost-btn" onClick={next}>
            Keep it for now
          </button>
        </div>
      )}
    </div>
  );
}

function SlotStrip({
  title,
  step,
  count,
  startedAt,
  minutes,
  volume,
  onVolume,
  onExit,
}: {
  title: string;
  step: number;
  count: number;
  startedAt: number;
  minutes: number;
  volume: number;
  onVolume: (v: number) => void;
  onExit: () => void;
}) {
  const secs = useElapsed(startedAt);
  const target = minutes * 60;
  const over = secs >= target;
  const buzzed = useRef(false);
  useEffect(() => {
    if (over && !buzzed.current) nudge();
    buzzed.current = over;
  }, [over]);

  return (
    <header className="slot-strip">
      <div className="drill-head">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Leave session">
          ←
        </button>
        <div className="drill-title">
          {title} <span className="muted small">· {step + 1} of {count}</span>
        </div>
        <VolumeStepper volume={volume} onVolume={onVolume} />
      </div>
      <div className="slot-timer">
        <div className="target-track">
          <div className={`slot-fill ${over ? 'over' : ''}`} style={{ width: `${Math.min(1, secs / target) * 100}%` }} />
        </div>
        <span className={`small ${over ? 'slot-over' : 'muted'}`}>
          {clock(secs)} / {minutes}:00
        </span>
      </div>
    </header>
  );
}

/** The random notes, chords and cues ahead, made as they're needed so the screen and audio agree. */
function useSequence(exercise: Exercise, keys: number[]) {
  const notes = useRef<Note[]>([]);
  const passes = useRef<ChordBar[][]>([]);
  const starts = useRef<number[]>([]);
  const cues = useRef<number[]>([]);
  const p = exercise.prompt;

  const noteAt = (bar: number): Note => {
    if (p.kind !== 'notes') throw new Error('not a notes prompt');
    while (notes.current.length <= bar) notes.current.push(...noteRound(p.set, notes.current.at(-1) ?? null));
    return notes.current[bar];
  };

  const addPass = () => {
    if (p.kind !== 'chords') throw new Error('not a chords prompt');
    const at = (starts.current.at(-1) ?? 0) + (passes.current.at(-1)?.length ?? 0);
    passes.current.push(chordPass(p, keys, passes.current.at(-1)?.[0].key ?? null));
    starts.current.push(at);
  };

  /** Index of the chord pass that bar is in. */
  const passOf = (bar: number): number => {
    while ((starts.current.at(-1) ?? 0) + (passes.current.at(-1)?.length ?? 0) <= bar) addPass();
    let i = starts.current.length - 1;
    while (starts.current[i] > bar) i--;
    return i;
  };

  const pass = (i: number) => {
    while (passes.current.length <= i) addPass();
    return { start: starts.current[i], bars: passes.current[i] };
  };

  const chordAt = (bar: number): Chord => {
    const i = passOf(bar);
    return passes.current[i][bar - starts.current[i]].chord;
  };

  const cueAt = (bar: number): string | null => {
    if (exercise.cues.length === 0) return null;
    const k = Math.floor(bar / exercise.cueEvery);
    while (cues.current.length <= k) cues.current.push(nextCue(exercise.cues.length, exercise.cueOrder, cues.current.at(-1) ?? null));
    return exercise.cues[cues.current[k]];
  };

  return { noteAt, passOf, pass, chordAt, cueAt };
}

function ExerciseRunner({
  exercise,
  keys,
  volume,
  onPatch,
  onRun,
}: {
  exercise: Exercise;
  keys: number[];
  volume: number;
  onPatch: (patch: Partial<Exercise>) => void;
  onRun: (bpm: number) => void;
}) {
  const p = exercise.prompt;
  const seq = useSequence(exercise, keys);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<Beat | null>(null);
  /** Where the next start begins, and what shows while stopped. */
  const [home, setHome] = useState(0);
  const bar = running && beat ? beat.bar : home;
  const barRef = useRef(bar);
  barRef.current = bar;

  const beatsPerBar = p.kind === 'notes' ? p.beatsEach : 4;
  const clicks = useMemo(
    () => Array.from({ length: beatsPerBar }, (_, i) => p.kind === 'notes' || !exercise.backbeat || i % 2 === 1),
    [beatsPerBar, p.kind, exercise.backbeat],
  );
  const options = { bpm: exercise.bpm, clicks, piano: p.kind === 'chords' && exercise.piano, volume, beatsPerBar };

  const player = useRef<ReturnType<typeof createPlayer> | null>(null);
  player.current ??= createPlayer((b) => (p.kind === 'chords' ? seq.chordAt(b) : null), setBeat);
  useEffect(() => player.current!.update(options), [exercise.bpm, clicks, options.piano, volume]);
  useEffect(() => () => player.current!.stop(), []);
  useEffect(() => {
    if (running) onRun(exercise.bpm);
  }, [running, exercise.bpm]);

  const start = () => {
    setBeat(null);
    setRunning(true);
    void player.current!.start(home, options);
  };

  const stop = () => {
    player.current!.stop();
    setRunning(false);
    // Chords start again from the top of the pass; notes from the note you were on.
    setHome(p.kind === 'chords' ? seq.pass(seq.passOf(barRef.current)).start : barRef.current);
    setBeat(null);
  };

  // Timers stall in the background, so stop rather than drift.
  useEffect(() => {
    if (!running) return;
    const onHide = () => document.hidden && stop();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [running]);

  const at = running ? beat : null;
  const passIndex = p.kind === 'chords' ? seq.passOf(bar) : null;
  const cue = seq.cueAt(bar);
  const cueNext = exercise.cues.length > 1 ? seq.cueAt((Math.floor(bar / exercise.cueEvery) + 1) * exercise.cueEvery) : null;

  return (
    <div className="runner">
      <div className="count-in runner-count" style={{ visibility: at?.countIn ? 'visible' : 'hidden' }}>
        Count-in {(at?.beat ?? 0) + 1}
      </div>

      {p.kind === 'notes' && <NotePrompt note={seq.noteAt(bar)} up={goesUp(bar)} next={seq.noteAt(bar + 1)} beats={beatsPerBar} at={at} />}

      {passIndex !== null && (
        <>
          <PassLine {...seq.pass(passIndex)} bar={bar} at={at} clicks={clicks} />
          <PassLine {...seq.pass(passIndex + 1)} bar={-1} at={null} clicks={clicks} next />
        </>
      )}

      {p.kind === 'none' && (
        <div className="beats free-beats">
          {clicks.map((c, j) => (
            <span key={j} className={`beat ${c ? 'beat-click' : ''} ${at && !at.countIn && j === at.beat ? 'beat-on' : ''}`} />
          ))}
        </div>
      )}

      {cue && (
        <div className="cue">
          <span className="cue-now">{cue}</span>
          {cueNext && cueNext !== cue && <span className="muted small">then {cueNext}</span>}
        </div>
      )}

      {p.kind === 'chords' && !running && (
        <div className="peek-btns">
          <button type="button" className="ghost-btn" onClick={() => setHome(seq.pass(seq.passOf(home) + 1).start)}>
            Skip key →
          </button>
        </div>
      )}

      <div className="play-controls">
        <button type="button" className={`start-btn ${running ? 'stop' : ''}`} onClick={running ? stop : start}>
          {running ? '■ Stop' : '▶ Start'}
        </button>
        <TempoControl bpm={exercise.bpm} onBpm={(bpm) => onPatch({ bpm })} />
        {p.kind !== 'notes' && (
          <div className="ctl-row">
            <span className="ctl-label">Click on</span>
            <div className="seg">
              <button type="button" className={`key-chip ${!exercise.backbeat ? 'on' : ''}`} aria-pressed={!exercise.backbeat} onClick={() => onPatch({ backbeat: false })}>
                Every beat
              </button>
              <button type="button" className={`key-chip ${exercise.backbeat ? 'on' : ''}`} aria-pressed={exercise.backbeat} onClick={() => onPatch({ backbeat: true })}>
                2 & 4
              </button>
            </div>
          </div>
        )}
        {p.kind === 'chords' && (
          <label className="toggle">
            <input type="checkbox" checked={exercise.piano} onChange={(e) => onPatch({ piano: e.target.checked })} />
            Piano plays the chords
          </label>
        )}
      </div>
    </div>
  );
}

function NotePrompt({ note, up, next, beats, at }: { note: Note; up: boolean; next: Note; beats: number; at: Beat | null }) {
  return (
    <section className="note-prompt">
      <div className="note-big">{noteName(note)}</div>
      <div className="note-dir">{up ? '↑ low E to high E' : '↓ high E to low E'}</div>
      <div className="beats note-beats">
        {Array.from({ length: beats }, (_, j) => (
          <span key={j} className={`beat beat-click ${at && !at.countIn && j === at.beat ? 'beat-on' : ''}`} />
        ))}
      </div>
      <div className="muted small">
        Next: {noteName(next)} {up ? '↓' : '↑'}
      </div>
    </section>
  );
}

/** A pass of chords, with repeated bars of one chord drawn as one box. */
function PassLine({ start, bars, bar, at, clicks, next }: { start: number; bars: ChordBar[]; bar: number; at: Beat | null; clicks: boolean[]; next?: boolean }) {
  const spans: { chord: Chord; from: number; count: number }[] = [];
  bars.forEach((b, i) => {
    const last = spans.at(-1);
    if (last && last.chord === b.chord) last.count++;
    else spans.push({ chord: b.chord, from: start + i, count: 1 });
  });
  const inBar = at && !at.countIn ? bar : -1;

  return (
    <section className={`line ${next ? 'line-next' : ''}`}>
      <div className="line-head">
        <span className="line-key">
          {next && <span className="muted">Next · </span>}
          {bars[0].key}
        </span>
      </div>
      <div className="pass">
        {spans.map((s) => {
          const on = inBar >= s.from && inBar < s.from + s.count;
          return (
            <div key={s.from} className={`bar ${on ? 'bar-on' : ''}`} style={{ flexGrow: s.count }}>
              <span className="ch">
                <span className="ch-root">{noteName(s.chord.root)}</span>
                <span className="ch-q">{QUALITY_SYMBOL[s.chord.quality]}</span>
              </span>
              <div className="beats">
                {Array.from({ length: s.count }, (_, k) => (
                  <div key={k} className="beat-group">
                    {clicks.map((c, j) => (
                      <span key={j} className={`beat ${c ? 'beat-click' : ''} ${s.from + k === inBar && j === at!.beat ? 'beat-on' : ''}`} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
