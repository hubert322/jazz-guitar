import { useState } from 'react';
import { BPM_MAX, BPM_MIN } from '../play/tempo';
import {
  assign,
  type Exercise,
  findExercise,
  MINUTES,
  type Routine,
  setMinutes,
  shelf,
  SLOTS,
  type SlotId,
  slotOf,
  stageLog,
  stageOf,
  tempoHistory,
} from '../routine/routine';
import { daysAgo, doneToday, lastRun, Notes, promptSummary } from './routineText';

interface Props {
  routine: Routine;
  onRoutine: (update: (r: Routine) => Routine) => void;
  onStart: () => void;
  onEdit: (id: string | null) => void;
  onBack: () => void;
}

export function RoutineScreen({ routine, onRoutine, onStart, onEdit, onBack }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const opened = findExercise(routine, open);
  const inSlots = SLOTS.map((s) => ({ ...s, exercise: findExercise(routine, routine.slots[s.id].exercise) }));
  const filled = inSlots.some((s) => s.exercise);
  const total = inSlots.reduce((sum, s) => sum + (s.exercise?.timed ? routine.slots[s.id].minutes : 0), 0);
  const untimed = inSlots.filter((s) => s.exercise && !s.exercise.timed).length;

  const cycleMinutes = (slot: SlotId) => {
    const now = MINUTES.indexOf(routine.slots[slot].minutes);
    onRoutine((r) => setMinutes(r, slot, MINUTES[(now + 1) % MINUTES.length]));
  };

  return (
    <div className="screen routine">
      <header className="drill-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div className="drill-title">Routine</div>
        <span />
      </header>

      <div className="rt-slots">
        {inSlots.map(({ id, title, exercise: e }) => {
          return (
            <div key={id} className="rt-slot">
              <div className="slot-head">
                <span className="slot-title">{title}</span>
                {e && !e.timed ? (
                  <span className="muted small">No timer</span>
                ) : (
                  <button type="button" className="key-chip slot-min" onClick={() => cycleMinutes(id)} aria-label={`${title} minutes`}>
                    {routine.slots[id].minutes} min
                  </button>
                )}
              </div>
              {e ? (
                <button type="button" className="ex-row" onClick={() => setOpen(e.id)}>
                  <span className="ex-name">
                    {e.name}
                    {doneToday(e) && <span className="done-mark"> ✓</span>}
                  </span>
                  <span className="muted small">{lastRun(e)}</span>
                </button>
              ) : (
                <p className="muted small slot-empty">Empty. Pick something from the shelf below.</p>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="start-btn" disabled={!filled} onClick={onStart}>
        ▶ Start session · {untimed === 0 ? `${total} min` : total === 0 ? 'untimed' : `${total} min + ${untimed} untimed`}
      </button>

      <h2 className="shelf-title">Shelf</h2>
      <div className="shelf">
        {shelf(routine).map((e) => (
          <button type="button" key={e.id} className="ex-row" onClick={() => setOpen(e.id)}>
            <span className="ex-name">{e.name}</span>
            <span className="muted small">{promptSummary(e)}</span>
          </button>
        ))}
        <button type="button" className="ghost-btn new-ex" onClick={() => onEdit(null)}>
          + New exercise
        </button>
      </div>

      {opened && (
        <ExerciseSheet
          exercise={opened}
          slot={slotOf(routine, opened.id)}
          onAssign={(slot) => {
            onRoutine((r) => assign(r, slot, opened.id));
            setOpen(null);
          }}
          onShelve={(slot) => {
            onRoutine((r) => assign(r, slot, null));
            setOpen(null);
          }}
          onEdit={() => onEdit(opened.id)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function ExerciseSheet({
  exercise,
  slot,
  onAssign,
  onShelve,
  onEdit,
  onClose,
}: {
  exercise: Exercise;
  slot: SlotId | undefined;
  onAssign: (slot: SlotId) => void;
  onShelve: (slot: SlotId) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={exercise.name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{exercise.name}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted small">{promptSummary(exercise)}</p>
        {exercise.notes && <Notes text={exercise.notes} />}
        <TempoChart exercise={exercise} />

        <div className="ctl-row">
          <span className="ctl-label">Put in</span>
          <div className="seg">
            {SLOTS.map((s) => (
              <button
                type="button"
                key={s.id}
                className={`key-chip ${slot === s.id ? 'on' : ''}`}
                aria-pressed={slot === s.id}
                onClick={() => (slot === s.id ? onClose() : onAssign(s.id))}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
        <div className="sheet-btns">
          {slot && (
            <button type="button" className="ghost-btn" onClick={() => onShelve(slot)}>
              Back to shelf
            </button>
          )}
          <button type="button" className="ghost-btn" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fastest tempo per day played: filled dots clean, hollow dots messy. */
function TempoChart({ exercise }: { exercise: Exercise }) {
  const days = tempoHistory(exercise);
  const runs = stageLog(exercise).length;
  const stage = stageOf(exercise);
  const atStage = stage ? ` at stage ${stage}` : '';
  if (days.length === 0) {
    return <p className="muted small">{runs > 0 ? `Played ${runs}×${atStage} with no metronome.` : `No tempo history${atStage} yet.`}</p>;
  }
  const values = days.flatMap((d) => [d.clean, d.messy]).filter((v): v is number => v !== null);
  if (exercise.goalBpm) values.push(exercise.goalBpm);
  const lo = Math.max(BPM_MIN, Math.min(...values) - 4);
  const hi = Math.min(BPM_MAX, Math.max(...values) + 4);
  const W = 300;
  const H = 90;
  const x = (i: number) => (days.length === 1 ? W / 2 : 10 + (i * (W - 20)) / (days.length - 1));
  const y = (v: number) => H - 10 - ((v - lo) / Math.max(1, hi - lo)) * (H - 20);
  const cleanPts = days.map((d, i) => (d.clean === null ? null : `${x(i)},${y(d.clean)}`)).filter(Boolean);
  const best = Math.max(...days.map((d) => d.clean ?? 0));

  return (
    <figure className="tempo-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tempo history, best clean ${best || 'none yet'}`}>
        {exercise.goalBpm && <line className="tc-goal" x1={0} x2={W} y1={y(exercise.goalBpm)} y2={y(exercise.goalBpm)} />}
        {cleanPts.length > 1 && <polyline className="tc-line" points={cleanPts.join(' ')} />}
        {days.map((d, i) => (
          <g key={d.d}>
            {d.messy !== null && <circle className="tc-messy" cx={x(i)} cy={y(d.messy)} r={4} />}
            {d.clean !== null && <circle className="tc-clean" cx={x(i)} cy={y(d.clean)} r={4} />}
          </g>
        ))}
      </svg>
      <figcaption className="muted small">
        {stage && `Stage ${stage} · `}
        {best ? `Best clean ${best} bpm` : 'No clean run yet'}
        {exercise.goalBpm && ` · goal ${exercise.goalBpm}`} · since {daysAgo(days[0].d)}
      </figcaption>
    </figure>
  );
}
