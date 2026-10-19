import { type ReactNode, useState } from 'react';
import type { Mode } from '../play/cycles';
import { clampBpm } from '../play/tempo';
import { BARS_EACH, BEATS_EACH, type Exercise, type Progression, type Prompt } from '../routine/routine';
import { TempoControl } from './TempoControl';

interface Props {
  exercise: Exercise;
  isNew: boolean;
  onSave: (e: Exercise) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const KINDS: { id: Prompt['kind']; label: string }[] = [
  { id: 'none', label: 'Nothing' },
  { id: 'notes', label: 'Notes' },
  { id: 'chords', label: 'Chords' },
];

const DEFAULT_PROMPT: Record<'none' | 'notes' | 'chords', Prompt> = {
  none: { kind: 'none' },
  notes: { kind: 'notes', set: 'naturals', beatsEach: 6 },
  chords: { kind: 'chords', progression: 'iiVI', mode: 'major', barsEach: 1 },
};

/** A row of mutually exclusive chips. */
function Seg<T>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="ctl-row">
      <span className="ctl-label">{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button type="button" key={String(o.id)} className={`key-chip ${value === o.id ? 'on' : ''}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExerciseEditor({ exercise, isNew, onSave, onDelete, onCancel }: Props) {
  const [e, setE] = useState(exercise);
  const [cueText, setCueText] = useState(exercise.cues.join('\n'));
  const set = (patch: Partial<Exercise>) => setE((x) => ({ ...x, ...patch }));
  const p = e.prompt;
  const setPrompt = (patch: Partial<Prompt>) => set({ prompt: { ...p, ...patch } as Prompt });
  const cues = cueText
    .split('\n')
    .map((c) => c.trim())
    .filter(Boolean);
  const unit = p.kind === 'notes' ? 'notes' : 'bars';

  const save = () =>
    onSave({ ...e, name: e.name.trim(), notes: e.notes.trim(), cues, goalBpm: e.goalBpm === null || Number.isNaN(e.goalBpm) ? null : clampBpm(e.goalBpm) });

  return (
    <div className="screen editor">
      <header className="drill-head">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cancel">
          ←
        </button>
        <div className="drill-title">{isNew ? 'New exercise' : 'Edit exercise'}</div>
        <button type="button" className="key-chip save-btn" disabled={!e.name.trim()} onClick={save}>
          Save
        </button>
      </header>

      <label className="field">
        <span className="field-label">Name</span>
        <input value={e.name} onChange={(ev) => set({ name: ev.target.value })} placeholder="e.g. Guide tones over Autumn Leaves" />
      </label>

      <label className="field">
        <span className="field-label">Notes</span>
        <textarea rows={4} value={e.notes} onChange={(ev) => set({ notes: ev.target.value })} placeholder="What to play, what to listen for, links" />
      </label>

      <section className="field">
        <span className="field-label">While playing, show</span>
        {p.kind === 'playAlong' ? (
          <p className="muted small">The ii–V–I play-along (its tempo and settings are on its own screen).</p>
        ) : (
          <>
            <Seg label="Show" value={p.kind} options={KINDS} onChange={(k) => k !== p.kind && set({ prompt: DEFAULT_PROMPT[k as keyof typeof DEFAULT_PROMPT] })} />
            {p.kind === 'notes' && (
              <>
                <Seg
                  label="Notes"
                  value={p.set}
                  options={[
                    { id: 'naturals' as const, label: '7 naturals' },
                    { id: 'all' as const, label: 'All 12' },
                  ]}
                  onChange={(v) => setPrompt({ set: v })}
                />
                <Seg label="Beats each" value={p.beatsEach} options={BEATS_EACH.map((n) => ({ id: n, label: n }))} onChange={(v) => setPrompt({ beatsEach: v })} />
              </>
            )}
            {p.kind === 'chords' && (
              <>
                <Seg<Progression>
                  label="Chords"
                  value={p.progression}
                  options={[
                    { id: 'iiVI', label: 'ii–V–I' },
                    { id: 'diatonic', label: 'Diatonic' },
                    { id: 'vamp', label: 'Vamp' },
                  ]}
                  onChange={(v) => setPrompt({ progression: v })}
                />
                {p.progression !== 'diatonic' && (
                  <Seg<Mode>
                    label="Keys"
                    value={p.mode}
                    options={[
                      { id: 'major', label: 'Major' },
                      { id: 'minor', label: 'Minor' },
                      { id: 'mix', label: 'Both' },
                    ]}
                    onChange={(v) => setPrompt({ mode: v })}
                  />
                )}
                <Seg label="Bars each" value={p.barsEach} options={BARS_EACH.map((n) => ({ id: n, label: n }))} onChange={(v) => setPrompt({ barsEach: v })} />
                <p className="muted small">Keys come from the key picker on the home screen.</p>
              </>
            )}
          </>
        )}
      </section>

      {p.kind !== 'playAlong' && (
        <>
          <label className="field">
            <span className="field-label">Cues, one per line</span>
            <textarea rows={4} value={cueText} onChange={(ev) => setCueText(ev.target.value)} placeholder={'C shape\nA shape\nG shape'} />
          </label>
          {cues.length > 1 && (
            <>
              <Seg
                label="Order"
                value={e.cueOrder}
                options={[
                  { id: 'turn' as const, label: 'In turn' },
                  { id: 'random' as const, label: 'Random' },
                ]}
                onChange={(v) => set({ cueOrder: v })}
              />
              <div className="ctl-row">
                <span className="ctl-label">Change every</span>
                <button type="button" className="key-chip" aria-label="Fewer" onClick={() => set({ cueEvery: Math.max(1, e.cueEvery - 1) })}>
                  −
                </button>
                <span className="bpm stepper-value">
                  <b>{e.cueEvery}</b> {e.cueEvery === 1 ? unit.slice(0, -1) : unit}
                </span>
                <button type="button" className="key-chip" aria-label="More" onClick={() => set({ cueEvery: Math.min(32, e.cueEvery + 1) })}>
                  +
                </button>
              </div>
            </>
          )}

          <section className="field">
            <span className="field-label">Starting tempo</span>
            <TempoControl bpm={e.bpm} onBpm={(bpm) => set({ bpm })} />
          </section>
        </>
      )}

      <label className="field">
        <span className="field-label">Goal tempo (optional)</span>
        <input
          type="number"
          inputMode="numeric"
          min={40}
          max={240}
          value={e.goalBpm ?? ''}
          placeholder="e.g. 80"
          onChange={(ev) => set({ goalBpm: ev.target.value === '' ? null : Number(ev.target.value) })}
          onBlur={() => e.goalBpm !== null && set({ goalBpm: clampBpm(e.goalBpm) })}
        />
      </label>

      {!isNew && (
        <button
          type="button"
          className="danger-btn delete-ex"
          onClick={() => {
            if (confirm(`Delete "${exercise.name}" and its tempo history?`)) onDelete(exercise.id);
          }}
        >
          Delete exercise
        </button>
      )}
    </div>
  );
}
