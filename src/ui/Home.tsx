import { AREAS, type Area, FACTS, factsIn } from '../drills/facts';
import { dayKey, type Progress, statusOf, streakDays } from '../srs/progress';

interface Props {
  progress: Progress;
  onStart: (area: Area | 'mix') => void;
  onStats: () => void;
}

function fluentShare(progress: Progress, area?: Area) {
  const facts = area ? factsIn(area) : FACTS;
  const fluent = facts.filter((f) => statusOf(progress.facts[f.id], f.targetMs) === 'fluent').length;
  return { fluent, total: facts.length };
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

export function Home({ progress, onStart, onStats }: Props) {
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

      <button type="button" className="card card-mix" onClick={() => onStart('mix')}>
        <div className="card-title">Mix</div>
        <div className="card-blurb">Everything, weighted toward what's slow or missed</div>
        <Meter {...fluentShare(progress)} />
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

      <button type="button" className="link-btn" onClick={onStats}>
        See weak spots →
      </button>
    </div>
  );
}
