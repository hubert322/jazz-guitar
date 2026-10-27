import { BEATS_MAX, BEATS_MIN, type Click, type Metronome, nextClick, withBeats } from '../play/metronome';

const CLICK_NAME: Record<Click, string> = { 0: 'silent', 1: 'click', 2: 'accent' };

/** Beats per bar, how each beat clicks, and the count-in: the same controls wherever the metronome runs. */
export function MetronomeControl({ metronome, onChange }: { metronome: Metronome; onChange: (m: Metronome) => void }) {
  const { clicks } = metronome;
  const n = clicks.length;
  return (
    <>
      <div className="ctl-row">
        <span className="ctl-label">Beats</span>
        <button type="button" className="key-chip" aria-label="Fewer beats" disabled={n <= BEATS_MIN} onClick={() => onChange(withBeats(metronome, n - 1))}>
          −
        </button>
        <span className="bpm stepper-value">
          <b>{n}</b> a bar
        </span>
        <button type="button" className="key-chip" aria-label="More beats" disabled={n >= BEATS_MAX} onClick={() => onChange(withBeats(metronome, n + 1))}>
          +
        </button>
      </div>
      <div className="ctl-row">
        <span className="ctl-label">Clicks</span>
        <div className="seg click-seg" style={{ gridTemplateColumns: `repeat(${n <= 6 ? n : Math.ceil(n / 2)}, 1fr)` }}>
          {clicks.map((c, j) => (
            <button
              type="button"
              key={j}
              className={`key-chip click-chip ${c > 0 ? 'on' : ''} ${c === 2 ? 'accent' : ''}`}
              aria-label={`Beat ${j + 1}: ${CLICK_NAME[c]}`}
              onClick={() => onChange({ ...metronome, clicks: clicks.map((x, i) => (i === j ? nextClick(x) : x)) })}
            >
              {c === 2 && <span className="accent-mark">&gt;</span>}
              {j + 1}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small click-hint">Tap a beat: click, accent, silent.</p>
      <label className="toggle">
        <input type="checkbox" checked={metronome.countIn} onChange={(e) => onChange({ ...metronome, countIn: e.target.checked })} />
        Count in a bar first
      </label>
    </>
  );
}

/** A bar's beats as dots: dim when silent, bigger when accented, lit on `on` (a beat index, or −1). */
export function BeatDots({ clicks, on }: { clicks: Click[]; on: number }) {
  return (
    <>
      {clicks.map((c, j) => (
        <span key={j} className={`beat ${c > 0 ? 'beat-click' : ''} ${c === 2 ? 'beat-accent' : ''} ${j === on ? 'beat-on' : ''}`} />
      ))}
    </>
  );
}
