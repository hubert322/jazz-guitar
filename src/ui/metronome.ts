// The play-along's clock: metronome clicks and piano chords scheduled a little ahead on the
// audio clock, which keeps time even when the main thread stutters. A timer tops up the schedule
// and reports each beat to the screen when it's actually heard.

import { type Chord, chordPitches } from '../theory/chords';
import { context, loadPiano, type PianoSamples, pianoNote, scheduledOutput, sleepAfter } from './sound';

export interface PlayerOptions {
  bpm: number;
  /** Which of beats 1–4 click. */
  clicks: boolean[];
  /** Piano chord on beat 1 of every bar. */
  piano: boolean;
  volume: number;
}

export interface Beat {
  bar: number;
  /** 0..3 */
  beat: number;
  /** The bar of clicks before the form starts. */
  countIn: boolean;
}

const BEATS_PER_BAR = 4;
/** Schedule this far ahead, in seconds. */
const LOOKAHEAD = 0.15;
const TICK_MS = 25;

/** A short woodblock-ish tick, higher on beat 1. */
function click(out: AudioNode, when: number, accent: boolean) {
  const ac = out.context;
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(accent ? 2000 : 1400, when);
  osc.frequency.exponentialRampToValueAtTime(accent ? 1000 : 700, when + 0.03);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.6, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  osc.connect(g).connect(out);
  osc.start(when);
  osc.stop(when + 0.07);
}

function strum(samples: PianoSamples, out: AudioNode, chord: Chord, when: number, barSecs: number) {
  // Samples are 1.5s long, so slow bars just let the chord ring out.
  const hold = Math.min(barSecs - 0.05, 1.3);
  for (const midi of chordPitches(chord)) pianoNote(samples, out, midi, when, hold, 0.4);
}

/**
 * `chordAt(bar)` is asked for each bar just before it plays; `onBeat` hears about each beat as it
 * sounds. Options can change while playing and apply from the next beat.
 */
export function createPlayer(chordAt: (bar: number) => Chord, onBeat: (b: Beat) => void) {
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
    const samples = await loadPiano();
    if (mine !== run) return;

    const output = scheduledOutput();
    output.gain.value = opts.volume;
    out = output;
    let bar = fromBar;
    let beat = 0;
    let countIn = true;
    let t = ac.currentTime + 0.1;
    const queue: (Beat & { time: number })[] = [];
    // What's scheduled now is heard this much later, which on Android Bluetooth can be a lot.
    const latency = (ac.outputLatency || 0) + ac.baseLatency;

    const tick = () => {
      const o = opts!;
      while (t < ac.currentTime + LOOKAHEAD) {
        if (countIn || o.clicks[beat]) click(output, t, beat === 0);
        if (!countIn && beat === 0 && o.piano) strum(samples, output, chordAt(bar), t, (BEATS_PER_BAR * 60) / o.bpm);
        queue.push({ time: t, bar, beat, countIn });
        t += 60 / o.bpm;
        if (++beat === BEATS_PER_BAR) {
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
