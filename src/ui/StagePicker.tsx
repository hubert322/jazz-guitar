import type { ReactNode } from 'react';
import { FRET_STAGES, fretStage } from '../routine/routine';

/** The fretboard exercise's stages as numbered chips, with what to do at the one picked. */
export function StagePicker({ stage, onStage, children }: { stage: number; onStage: (stage: number) => void; children?: ReactNode }) {
  const { title, how } = fretStage(stage);
  return (
    <section className="stage-pick">
      <div className="seg stage-seg">
        {FRET_STAGES.map((s, i) => (
          <button
            type="button"
            key={i}
            className={`key-chip ${stage === i + 1 ? 'on' : ''}`}
            aria-pressed={stage === i + 1}
            aria-label={`Stage ${i + 1}: ${s.title}`}
            onClick={() => onStage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="small">
        <b>
          Stage {stage}: {title}.
        </b>{' '}
        <span className="muted">
          {how} {children}
        </span>
      </p>
    </section>
  );
}
