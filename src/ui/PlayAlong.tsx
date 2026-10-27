import { useEffect, useRef, useState } from 'react';
import { BARS_PER_CYCLE, type Cycle, cycleBars, type Mode, nextCycle } from '../play/cycles';
import type { Click } from '../play/metronome';
import { type PlaySettings, REPEATS } from '../srs/progress';
import { type Chord, QUALITY_SYMBOL } from '../theory/chords';
import { keyName } from '../theory/keys';
import { noteName } from '../theory/notes';
import { bebopB9b13, plainSpelling } from '../theory/scales';
import { type Beat, createPlayer } from './metronome';
import { BeatDots, MetronomeControl } from './MetronomeControl';
import { VolumeStepper } from './questions';
import { TempoControl } from './TempoControl';
import { useWakeLock } from './wakeLock';

interface Props {
  keys: number[];
  play: PlaySettings;
  volume: number;
  onPlay: (play: PlaySettings) => void;
  onVolume: (volume: number) => void;
  onExit: () => void;
  /** Inside a routine session, which has its own header. */
  embedded?: boolean;
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
  { id: 'mix', label: 'Both' },
];

/** The random keys ahead, made as they're needed and kept so the screen and the audio agree. */
function useCycles(keys: number[], mode: Mode, repeat: number) {
  const cycles = useRef<Cycle[]>([]);
  /** Highest cycle the audio has asked for; those can't change any more. */
  const locked = useRef(-1);
  const [, redraw] = useState(0);
  // The audio asks for bars from a callback made once, so it reads the latest settings from here.
  const choice = useRef({ keys, mode, repeat });
  choice.current = { keys, mode, repeat };

  const at = (k: number): Cycle => {
    const c = choice.current;
    while (cycles.current.length <= k) cycles.current.push(nextCycle(cycles.current.at(-1) ?? null, c.keys, c.mode, c.repeat));
    return cycles.current[k];
  };

  /** After a settings change, picks again from cycle `from` on (keeping anything already heard). */
  const repick = (from: number) => {
    cycles.current.length = Math.max(from, locked.current + 1, 0);
    redraw((n) => n + 1);
  };

  return { at, repick, locked };
}

function ChordName({ chord }: { chord: Chord }) {
  return (
    <span className="ch">
      <span className="ch-root">{noteName(chord.root)}</span>
      <span className="ch-q">{QUALITY_SYMBOL[chord.quality]}</span>
    </span>
  );
}

function CycleLine({ cycle, at, clicks, repeat, next }: { cycle: Cycle; at: Beat | null; clicks: Click[]; repeat: number; next?: boolean }) {
  const bars = cycleBars(cycle);
  const v = cycle.cadence.chords[1];
  const inBar = at && !at.countIn ? at.bar % BARS_PER_CYCLE : -1;
  const box = (chord: Chord, span: number[]) => (
    <div className={`bar ${span.includes(inBar) ? 'bar-on' : ''}`}>
      <ChordName chord={chord} />
      <div className="beats">
        {span.map((b) => (
          <div key={b} className="beat-group">
            <BeatDots clicks={clicks} on={b === inBar ? at!.beat : -1} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className={`line ${next ? 'line-next' : ''}`}>
      <div className="line-head">
        <span className="line-key">
          {next && <span className="muted">Next · </span>}
          {keyName(cycle.cadence.tonic, cycle.cadence.minor)}
        </span>
        {repeat > 1 && (
          <span className="muted small">
            {cycle.rep} of {repeat}
          </span>
        )}
        {at?.countIn && <span className="count-in">Count-in {at.beat + 1}</span>}
      </div>
      <div className="line-spans">
        <span>{noteName(v.root)} ♭9♭13 scale</span>
        <span>improvise</span>
      </div>
      <div className="bars">
        {box(bars[0], [0])}
        {box(bars[1], [1])}
        {box(bars[2], [2, 3])}
      </div>
    </section>
  );
}

function Peek({ cycle }: { cycle: Cycle }) {
  const v = cycle.cadence.chords[1];
  return (
    <div className="chips chips-wide peek-notes" aria-label={`${noteName(v.root)} ♭9 ♭13 bebop scale`}>
      {bebopB9b13(v.root).map((t) => (
        <div key={t.label} className="chip">
          <span className="chip-main">{noteName(plainSpelling(t.note))}</span>
          <span className="chip-sub">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PlayAlong({ keys, play, volume, onPlay, onVolume, onExit, embedded }: Props) {
  const { at, repick, locked } = useCycles(keys, play.mode, play.repeat);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<Beat | null>(null);
  /** The cycle on screen while stopped, and where the next start begins. */
  const [home, setHome] = useState(0);
  const [peek, setPeek] = useState(false);

  const current = running && beat ? Math.floor(beat.bar / BARS_PER_CYCLE) : home;
  const currentRef = useRef(current);
  currentRef.current = current;

  const player = useRef<ReturnType<typeof createPlayer> | null>(null);
  player.current ??= createPlayer(
    (bar) => {
      const k = Math.floor(bar / BARS_PER_CYCLE);
      locked.current = Math.max(locked.current, k);
      return cycleBars(at(k))[bar % BARS_PER_CYCLE];
    },
    setBeat,
  );
  const options = { bpm: play.bpm, metronome: play.metronome, piano: play.piano, volume };

  useEffect(() => player.current!.update(options), [play.bpm, play.metronome, play.piano, volume]);
  useEffect(() => () => player.current!.stop(), []);
  useWakeLock(running);

  // A new key choice applies from the next line on while playing, and right away when stopped.
  const picked = useRef({ keys, mode: play.mode, repeat: play.repeat });
  useEffect(() => {
    const was = picked.current;
    if (was.keys === keys && was.mode === play.mode && was.repeat === play.repeat) return;
    picked.current = { keys, mode: play.mode, repeat: play.repeat };
    repick(running ? currentRef.current + 1 : currentRef.current);
  }, [keys, play.mode, play.repeat]);

  const start = () => {
    locked.current = home - 1;
    setBeat(null);
    setRunning(true);
    void player.current!.start(home * BARS_PER_CYCLE, options);
  };

  const stop = () => {
    player.current!.stop();
    locked.current = -1;
    setRunning(false);
    setHome(currentRef.current);
    setBeat(null);
  };

  // Timers stall in the background, so stop rather than drift.
  useEffect(() => {
    if (!running) return;
    const onHide = () => document.hidden && stop();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [running]);

  /** On to the next key, past any repeats of this one. */
  const skip = () => {
    let k = home + 1;
    while (at(k).rep !== 1) k++;
    setHome(k);
  };

  const set = (patch: Partial<PlaySettings>) => onPlay({ ...play, ...patch });

  return (
    <div className={embedded ? 'play play-embedded' : 'screen play'}>
      {!embedded && (
        <header className="drill-head">
          <button type="button" className="icon-btn" onClick={onExit} aria-label="Back">
            ←
          </button>
          <div className="drill-title">ii–V–I play-along</div>
          <VolumeStepper volume={volume} onVolume={onVolume} />
        </header>
      )}

      <CycleLine cycle={at(current)} at={running ? beat : null} clicks={play.metronome.clicks} repeat={play.repeat} />
      <CycleLine cycle={at(current + 1)} at={null} clicks={play.metronome.clicks} repeat={play.repeat} next />

      <div className="peek">
        {peek && <Peek cycle={at(current)} />}
        <div className="peek-btns">
          <button type="button" className="ghost-btn" aria-pressed={peek} onClick={() => setPeek(!peek)}>
            {peek ? 'Hide scale' : 'Peek at scale'}
          </button>
          {!running && (
            <button type="button" className="ghost-btn" onClick={skip}>
              Skip key →
            </button>
          )}
        </div>
      </div>

      <div className="play-controls">
        <button type="button" className={`start-btn ${running ? 'stop' : ''}`} onClick={running ? stop : start}>
          {running ? '■ Stop' : '▶ Start'}
        </button>

        <TempoControl bpm={play.bpm} onBpm={(bpm) => set({ bpm })} />

        <MetronomeControl metronome={play.metronome} onChange={(metronome) => set({ metronome })} />

        <div className="ctl-row">
          <span className="ctl-label">Chords</span>
          <div className="seg">
            {MODES.map((m) => (
              <button type="button" key={m.id} className={`key-chip ${play.mode === m.id ? 'on' : ''}`} aria-pressed={play.mode === m.id} onClick={() => set({ mode: m.id })}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ctl-row">
          <span className="ctl-label">Each key</span>
          <div className="seg">
            {REPEATS.map((r) => (
              <button type="button" key={r} className={`key-chip ${play.repeat === r ? 'on' : ''}`} aria-pressed={play.repeat === r} onClick={() => set({ repeat: r })}>
                {r}×
              </button>
            ))}
          </div>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={play.piano} onChange={(e) => set({ piano: e.target.checked })} />
          Piano plays the chords
        </label>
      </div>
    </div>
  );
}
