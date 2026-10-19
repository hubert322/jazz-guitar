// Piano playback from a few Salamander Grand Piano samples (public/piano/<midi>.mp3, one every
// minor 3rd, trimmed to 1.5s). Other notes are the nearest sample, pitch-shifted.
//
// Everything plays through Web Audio, not an <audio> element: media elements are what take
// Android audio focus and pause other apps' music. Where the Audio Session API exists we also
// ask for 'ambient' audio, which is defined as mixing with other audio.

const SAMPLES = [45, 48, 51, 54, 57, 60, 63, 66];

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let volume = 1;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let loading: Promise<Map<number, Sample>> | null = null;

/** Keep the audio output open this long after the last sound, so the next tap doesn't wait for it. */
const IDLE_SECS = 20;

interface Sample {
  buffer: AudioBuffer;
  /** Where the attack begins, skipping the MP3's leading silence. */
  onset: number;
}

/** First point the sample is audible, less half a millisecond so the attack stays intact. */
function onsetOf(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (const x of data) peak = Math.max(peak, Math.abs(x));
  const first = data.findIndex((x) => Math.abs(x) > peak * 0.01);
  return Math.max(0, first / buffer.sampleRate - 0.0005);
}

/** Decoding needs no live audio, so samples can load before any tap. */
let decoder: OfflineAudioContext | null = null;

async function fetchAudio(path: string): Promise<AudioBuffer> {
  decoder ??= new OfflineAudioContext(1, 1, 44100);
  const data = await fetch(`${import.meta.env.BASE_URL}${path}`).then((r) => r.arrayBuffer());
  return decoder.decodeAudioData(data);
}

/** Fetches and decodes the samples once. */
export function loadPiano(): Promise<Map<number, Sample>> {
  loading ??= (async () => {
    const entries = await Promise.all(
      SAMPLES.map(async (midi) => {
        const buffer = await fetchAudio(`piano/${midi}.mp3`);
        return [midi, { buffer, onset: onsetOf(buffer) }] as const;
      }),
    );
    return new Map(entries);
  })();
  loading.catch(() => (loading = null));
  return loading;
}

let clickLoading: Promise<AudioBuffer> | null = null;

/** The metronome's woodblock tick (public/metronome.wav), fetched and decoded once. */
export function loadClick(): Promise<AudioBuffer> {
  clickLoading ??= fetchAudio('metronome.wav');
  clickLoading.catch(() => (clickLoading = null));
  return clickLoading;
}

export function sleepAfter(secs = IDLE_SECS) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void ctx?.suspend(), secs * 1000);
}

/**
 * Gets audio ready before the first tap: samples decoded and the output already running.
 * Call right after a tap (the answer), since browsers only start audio from a user gesture.
 */
export function warmUp() {
  void loadPiano();
  context();
  sleepAfter(IDLE_SECS);
}

/** Playback loudness, 1 = as recorded. Above 1 the sound goes through a limiter so chords don't clip. */
export function setVolume(v: number) {
  volume = v;
}

export function context(): AudioContext {
  if (!ctx) {
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
    ctx = new AudioContext();
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    limiter.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const nearest = (midi: number) => SAMPLES.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));

/** One piano note at an exact audio-clock time, into `dest`. */
export function pianoNote(samples: Map<number, Sample>, dest: AudioNode, midi: number, when: number, hold: number, gain: number) {
  const ac = dest.context;
  const base = nearest(midi);
  const sample = samples.get(base)!;
  const src = ac.createBufferSource();
  src.buffer = sample.buffer;
  src.playbackRate.value = 2 ** ((midi - base) / 12);
  const g = ac.createGain();
  g.gain.value = gain;
  g.gain.setTargetAtTime(0, when + hold, 0.08);
  src.connect(g).connect(dest);
  src.start(when, sample.onset);
  src.stop(when + hold + 0.5);
}

/** An output for sound scheduled ahead of time (the play-along), always through the limiter so its volume can change live. */
export function scheduledOutput(): GainNode {
  const ac = context();
  const out = ac.createGain();
  out.gain.value = volume;
  out.connect(limiter!);
  return out;
}

export type PianoSamples = Map<number, Sample>;

interface NoteEvent {
  midi: number;
  /** Start, in seconds from now. */
  at: number;
  /** How long it rings before fading out. */
  hold: number;
  gain: number;
}

/** Plays notes, cutting off whatever was still ringing. */
async function play(events: NoteEvent[]) {
  const ac = context();
  const samples = await loadPiano();
  const now = ac.currentTime;

  if (bus) {
    bus.gain.setTargetAtTime(0, now, 0.015);
    const old = bus;
    setTimeout(() => old.disconnect(), 200);
  }
  bus = ac.createGain();
  bus.gain.value = volume;
  bus.connect(volume > 1 ? limiter! : ac.destination);

  for (const e of events) pianoNote(samples, bus, e.midi, now + e.at, e.hold, e.gain);

  sleepAfter(Math.max(...events.map((e) => e.at + e.hold)) + IDLE_SECS);
}

export function playNote(midi: number) {
  void play([{ midi, at: 0, hold: 0.7, gain: 0.9 }]);
}

/** One note at a time from the bottom up, then all together. */
export function playChord(midis: number[]) {
  const step = 0.25;
  void play([
    ...midis.map((midi, i) => ({ midi, at: i * step, hold: 0.45, gain: 0.8 })),
    ...midis.map((midi) => ({ midi, at: midis.length * step + 0.2, hold: 0.9, gain: 0.5 })),
  ]);
}
