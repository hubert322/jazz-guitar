import { activeFacts, AREAS, type Area } from '../drills/facts';
import { dayKey, type Progress, statusOf, streakDays } from '../srs/progress';
import { KEY_CYCLE, MAJOR_KEYS } from '../theory/keys';
import { noteName, pc } from '../theory/notes';

interface Props {
  progress: Progress;
  onStart: (area: Area | 'mix') => void;
  onPlay: () => void;
  onStats: () => void;
  onKeys: (keys: number[]) => void;
}

function fluentShare(progress: Progress, area: Area | 'mix') {
  const facts = activeFacts(area, progress.settings.keys);
  const fluent = facts.filter((f) => statusOf(progress.facts[f.id], f.targetMs) === 'fluent').length;
  return { fluent, total: facts.length };
}

const keyLabel = (p: number) => noteName(MAJOR_KEYS.find((k) => pc(k) === p)!);

/** Once any key-based drill is this fluent in the chosen keys, suggest the next key round the cycle. */
const READY_TO_GROW = 0.8;

function KeyPicker({ progress, onKeys }: { progress: Progress; onKeys: (keys: number[]) => void }) {
  const keys = progress.settings.keys;
  const all = keys.length === KEY_CYCLE.length;
  const toggle = (p: number) => {
    // From "all keys", a tap means "just this one"; after that taps add and remove.
    if (all) onKeys([p]);
    else if (!keys.includes(p)) onKeys(KEY_CYCLE.filter((k) => k === p || keys.includes(k)));
    else if (keys.length > 1) onKeys(keys.filter((k) => k !== p));
  };
  const next = KEY_CYCLE.find((k) => !keys.includes(k));
  const ready =
    next !== undefined &&
    (['spell', 'tones', 'keys'] as const).some((a) => {
      const { fluent, total } = fluentShare(progress, a);
      return fluent / total >= READY_TO_GROW;
    });

  return (
    <section className="keys">
      <div className="keys-head">
        <span className="keys-title">Keys</span>
        <span className="muted small">{all ? 'All 12 · tap one to focus' : `${keys.length} of 12`}</span>
        <button type="button" className={`key-chip key-all ${all ? 'on' : ''}`} aria-pressed={all} onClick={() => onKeys(KEY_CYCLE)}>
          All
        </button>
      </div>
      <div className="key-grid">
        {KEY_CYCLE.map((p) => (
          <button
            type="button"
            key={p}
            className={`key-chip ${!all && keys.includes(p) ? 'on' : ''}`}
            aria-pressed={keys.includes(p)}
            onClick={() => toggle(p)}
          >
            {keyLabel(p)}
          </button>
        ))}
      </div>
      {ready && (
        <button type="button" className="key-next" onClick={() => onKeys([...keys, next])}>
          Mostly fluent in these keys. Add {keyLabel(next)} →
        </button>
      )}
    </section>
  );
}

function Meter({ fluent, total }: { fluent: number; total: number }) {
  return (
    <div className="meter">
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${(fluent / total) * 100}%` }} />
      </div>
      <span className="meter-text">
        {fluent}/{total} fluent
      </span>
    </div>
  );
}

export function Home({ progress, onStart, onPlay, onStats, onKeys }: Props) {
  const today = progress.days[dayKey()] ?? 0;
  const streak = streakDays(progress);
  return (
    <div className="screen home">
      <header className="home-head">
        <h1>Changes</h1>
        <p className="muted">
          Today {today} {today === 1 ? 'answer' : 'answers'}
          {streak > 0 && <> · {streak}-day streak</>}
        </p>
      </header>

      <KeyPicker progress={progress} onKeys={onKeys} />

      <button type="button" className="card card-mix" onClick={() => onStart('mix')}>
        <div className="card-title">Mix</div>
        <div className="card-blurb">Everything, weighted toward what's slow or missed</div>
        <Meter {...fluentShare(progress, 'mix')} />
      </button>

      <div className="cards">
        {AREAS.map((a) => (
          <button type="button" key={a.id} className="card" onClick={() => onStart(a.id)}>
            <div className="card-title">{a.title}</div>
            <div className="card-blurb">{a.blurb}</div>
            <Meter {...fluentShare(progress, a.id)} />
          </button>
        ))}
      </div>

      <button type="button" className="card card-play" onClick={onPlay}>
        <div className="card-title">ii–V–I play-along</div>
        <div className="card-blurb">Random keys over a metronome: ♭9♭13 bebop scale on the ii–V, improvise on the I</div>
      </button>

      <button type="button" className="link-btn" onClick={onStats}>
        See weak spots →
      </button>
    </div>
  );
}
