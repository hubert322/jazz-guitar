import { useState } from 'react';
import { type Area, type Fact, factsIn } from '../drills/facts';
import { combineStatus, type Progress, type Status, statusOf } from '../srs/progress';
import { QUALITIES, QUALITY_SYMBOL } from '../theory/chords';
import { MAJOR_KEYS, MINOR_KEYS, ROMAN } from '../theory/keys';
import { noteName, pc, pitchNames } from '../theory/notes';
import { Fretboard } from './Fretboard';

interface Props {
  progress: Progress;
  onBack: () => void;
  onVibrate: (on: boolean) => void;
  onReset: () => void;
}

/** Cycle of 4ths, the order jazz players practice keys in. */
const CYCLE = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];
const ROW_LABEL = ['C', 'D♭ C♯', 'D', 'E♭ D♯', 'E', 'F', 'G♭ F♯', 'G', 'A♭ G♯', 'A', 'B♭ A♯', 'B'];

const STATUS_LABEL: Record<Status, string> = { new: 'Not seen', weak: 'Missed', learning: 'Getting there', fluent: 'Fluent' };

function summarize(facts: Fact[], progress: Progress): { status: Status; secs?: string } {
  const status = combineStatus(facts.map((f) => statusOf(progress.facts[f.id], f.targetMs)));
  const times = facts.map((f) => progress.facts[f.id]?.t).filter((t): t is number => t != null);
  const secs = times.length ? (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1) : undefined;
  return { status, secs };
}

function Cell({ facts, progress }: { facts: Fact[]; progress: Progress }) {
  if (facts.length === 0) return <td className="cell cell-none" />;
  const { status, secs } = summarize(facts, progress);
  return <td className={`cell st-${status}`}>{secs ?? ''}</td>;
}

function ChordTable({ area, progress }: { area: 'spell' | 'tones'; progress: Progress }) {
  const facts = factsIn(area).filter((f): f is Extract<Fact, { kind: 'spell' | 'tone' | 'degree' }> => 'chord' in f);
  return (
    <table className="heat">
      <thead>
        <tr>
          <th />
          {QUALITIES.map((q) => (
            <th key={q}>{QUALITY_SYMBOL[q]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CYCLE.map((p) => (
          <tr key={p}>
            <th>{ROW_LABEL[p]}</th>
            {QUALITIES.map((q) => (
              <Cell key={q} progress={progress} facts={facts.filter((f) => f.chord.quality === q && pc(f.chord.root) === p)} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KeysTable({ progress }: { progress: Progress }) {
  const facts = factsIn('keys');
  const keyed = facts.filter((f): f is Extract<Fact, { kind: 'diatonic' | 'function' }> => f.kind === 'diatonic' || f.kind === 'function');
  const cadences = facts.filter((f): f is Extract<Fact, { kind: 'cadence' }> => f.kind === 'cadence');
  const majorKeys = CYCLE.map((p) => MAJOR_KEYS.find((k) => pc(k) === p)!);
  return (
    <>
      <table className="heat">
        <thead>
          <tr>
            <th>Key</th>
            {ROMAN.slice(1).map((r) => (
              <th key={r}>{r}</th>
            ))}
            <th>ii–V–I</th>
          </tr>
        </thead>
        <tbody>
          {majorKeys.map((k) => (
            <tr key={noteName(k)}>
              <th>{noteName(k)}</th>
              {ROMAN.slice(1).map((r, i) => (
                <Cell key={r} progress={progress} facts={keyed.filter((f) => f.degree === i + 1 && pc(f.key) === pc(k))} />
              ))}
              <Cell progress={progress} facts={cadences.filter((f) => !f.minor && pc(f.tonic) === pc(k))} />
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Minor ii–V–i</h3>
      <div className="chip-cells">
        {MINOR_KEYS.map((k) => {
          const { status, secs } = summarize(cadences.filter((f) => f.minor && pc(f.tonic) === pc(k)), progress);
          return (
            <div key={noteName(k)} className={`cell chip-cell st-${status}`}>
              <b>{noteName(k)}m</b>
              <span>{secs ?? ''}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function FretboardStats({ progress }: { progress: Progress }) {
  const facts = factsIn('fretboard');
  const dots = facts.flatMap((f) =>
    f.kind === 'fretName' ? [{ string: f.string, fret: f.fret, tone: statusOf(progress.facts[f.id], f.targetMs) }] : [],
  );
  return (
    <>
      <div className="stats-board">
        <Fretboard dots={dots} dotRadius={10} />
      </div>
      <h3>Find on every string</h3>
      <div className="chip-cells">
        {facts.map((f) => {
          if (f.kind !== 'fretFind') return null;
          const { status, secs } = summarize([f], progress);
          return (
            <div key={f.id} className={`cell chip-cell st-${status}`}>
              <b>{pitchNames(f.pitch).split('/')[0]}</b>
              <span>{secs ?? ''}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

const TABS: { id: Area; label: string }[] = [
  { id: 'spell', label: 'Spelling' },
  { id: 'tones', label: 'Tones' },
  { id: 'keys', label: 'Keys' },
  { id: 'fretboard', label: 'Fretboard' },
];

export function Stats({ progress, onBack, onVibrate, onReset }: Props) {
  const [tab, setTab] = useState<Area>('spell');
  return (
    <div className="screen stats">
      <header className="drill-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div className="drill-title">Weak spots</div>
        <div />
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="legend">
        {(['new', 'weak', 'learning', 'fluent'] as Status[]).map((s) => (
          <span key={s}>
            <i className={`swatch st-${s}`} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
      <p className="muted small">Numbers are average answer time in seconds.</p>

      <div className="stats-body">
        {tab === 'spell' && <ChordTable area="spell" progress={progress} />}
        {tab === 'tones' && <ChordTable area="tones" progress={progress} />}
        {tab === 'keys' && <KeysTable progress={progress} />}
        {tab === 'fretboard' && <FretboardStats progress={progress} />}
      </div>

      <section className="settings">
        <label className="toggle">
          <input type="checkbox" checked={progress.settings.vibrate} onChange={(e) => onVibrate(e.target.checked)} />
          Vibrate on a miss
        </label>
        <button
          type="button"
          className="danger-btn"
          onClick={() => {
            if (confirm('Erase all practice history? This cannot be undone.')) onReset();
          }}
        >
          Reset progress
        </button>
      </section>
    </div>
  );
}
