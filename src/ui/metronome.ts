// The metronome everything plays along with: clicks and piano chords scheduled a little ahead on the
// audio clock, which keeps time even when the main thread stutters. A timer tops up the schedule
// and reports each beat to the screen when it's actually heard.

import type { Metronome } from '../play/metronome';
import { type Chord, chordPitches } from '../theory/chords';
import { context, loadClick, loadPiano, type PianoSamples, pianoNote, scheduledOutput, sleepAfter } from './sound';

export interface PlayerOptions {
  bpm: number;
  metronome: Metronome;
  /** Piano chord on beat 1 of every bar. */
  piano: boolean;
  volume: number;
}

export interface Beat {
  bar: number;
  /** 0 up to beats per bar − 1 */
  beat: number;
  /** In the bar of clicks before the form starts. */
  countIn: boolean;
}

/** Schedule this far ahead, in seconds. */
const LOOKAHEAD = 0.15;
const TICK_MS = 25;

/** The woodblock sample, a fifth higher and louder when accented. */
function click(sample: AudioBuffer, out: AudioNode, when: number, accent: boolean) {
  const ac = out.context;
  const src = ac.createBufferSource();
  src.buffer = sample;
  src.playbackRate.value = accent ? 1.5 : 1;
  const g = ac.createGain();
  g.gain.value = accent ? 0.9 : 0.6;
  src.connect(g).connect(out);
  src.start(when);
}

function strum(samples: PianoSamples, out: AudioNode, chord: Chord, when: number, barSecs: number) {
  // Samples are 1.5s long, so slow bars just let the chord ring out.
  const hold = Math.min(barSecs - 0.05, 1.3);
  for (const midi of chordPitches(chord)) pianoNote(samples, out, midi, when, hold, 0.4);
}

/**
 * `chordAt(bar)` is asked for each bar just before it plays (null for no chord); `onBeat` hears about each beat as it
 * sounds. Options can change while playing and apply from the next beat.
 */
export function createPlayer(chordAt: (bar: number) => Chord | null, onBeat: (b: Beat) => void) {
  let opts: PlayerOptions | null = null;
  let out: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  /** Bumped on every start and stop, so a start still loading samples knows it was cancelled. */
  let run = 0;

  async function start(fromBar: number, options: PlayerOptions) {
    stop();
    const mine = run;
    opts = options;
    const ac = context();
    const [samples, clickSample] = await Promise.all([loadPiano(), loadClick()]);
    if (mine !== run) return;

    const output = scheduledOutput();
    output.gain.value = opts.volume;
    out = output;
    let bar = fromBar;
    let beat = 0;
    let countIn = opts.metronome.countIn;
    let t = ac.currentTime + 0.1;
    const queue: (Beat & { time: number })[] = [];
    // What's scheduled now is heard this much later, which on Android Bluetooth can be a lot.
    const latency = (ac.outputLatency || 0) + ac.baseLatency;

    const tick = () => {
      const o = opts!;
      while (t < ac.currentTime + LOOKAHEAD) {
        const { clicks } = o.metronome;
        const beats = clicks.length;
        // The count-in clicks every beat, accented where the bar is.
        const level = countIn ? Math.max(1, clicks[beat] ?? 1) : (clicks[beat] ?? 0);
        if (level > 0) click(clickSample, output, t, level === 2);
        const chord = !countIn && beat === 0 && o.piano ? chordAt(bar) : null;
        if (chord) strum(samples, output, chord, t, (beats * 60) / o.bpm);
        queue.push({ time: t, bar, beat, countIn });
        t += 60 / o.bpm;
        if (++beat >= beats) {
          beat = 0;
          if (countIn) countIn = false;
          else bar++;
        }
      }
      const heard = ac.currentTime - latency;
      let latest: Beat | undefined;
      while (queue.length > 0 && queue[0].time <= heard) latest = queue.shift();
      if (latest) onBeat({ bar: latest.bar, beat: latest.beat, countIn: latest.countIn });
      sleepAfter();
    };
    timer = setInterval(tick, TICK_MS);
    tick();
  }

  function stop() {
    run++;
    clearInterval(timer);
    timer = undefined;
    if (out) {
      const old = out;
      old.gain.setTargetAtTime(0, old.context.currentTime, 0.02);
      setTimeout(() => old.disconnect(), 300);
      out = null;
    }
  }

  function update(options: PlayerOptions) {
    if (out && opts && options.volume !== opts.volume) out.gain.setTargetAtTime(options.volume, out.context.currentTime, 0.02);
    opts = options;
  }

  return { start, stop, update };
}
