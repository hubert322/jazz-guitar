import { DEGREE_LABEL, DEGREE_PAD, type Degree, type Quality, QUALITIES, QUALITY_SYMBOL } from '../theory/chords';
import { ROMAN } from '../theory/keys';
import { GRID_ROWS, type Note, noteName } from '../theory/notes';

export type Mark = 'right' | 'wrong' | 'picked';

interface PadProps<T> {
  onPick: (value: T) => void;
  disabled?: boolean;
  /** Highlight state per button, keyed by its label. */
  marks?: Record<string, Mark>;
}

function PadButton({ label, mark, disabled, onClick, className = '' }: { label: string; mark?: Mark; disabled?: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`pad-btn ${className} ${mark ? `mark-${mark}` : ''}`}
      disabled={disabled}
      // pointerdown feels instant on a phone; click would wait for the finger to lift.
      onPointerDown={(e) => {
        if (e.button !== 0 || disabled) return;
        e.preventDefault();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

/** 3×7 grid: ♯ row, natural row, ♭ row. Every note is a single tap. */
export function NoteGrid({ onPick, disabled, marks = {} }: PadProps<Note>) {
  return (
    <div className="note-grid">
      {GRID_ROWS.map((row, r) =>
        row.map((n) => {
          const label = noteName(n);
          return (
            <PadButton
              key={label}
              label={label}
              mark={marks[label]}
              disabled={disabled}
              className={r === 1 ? 'natural' : 'accidental'}
              onClick={() => onPick(n)}
            />
          );
        }),
      )}
    </div>
  );
}

export function DegreePad({ onPick, disabled, marks = {} }: PadProps<Degree>) {
  return (
    <div className="row-pad" style={{ gridTemplateColumns: `repeat(${DEGREE_PAD.length}, 1fr)` }}>
      {DEGREE_PAD.map((d) => (
        <PadButton key={d} label={DEGREE_LABEL[d]} mark={marks[DEGREE_LABEL[d]]} disabled={disabled} onClick={() => onPick(d)} />
      ))}
    </div>
  );
}

export function RomanPad({ onPick, disabled, marks = {} }: PadProps<number>) {
  // The I chord is never asked, so the pad starts at ii.
  return (
    <div className="row-pad" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
      {ROMAN.slice(1).map((r, i) => (
        <PadButton key={r} label={r} mark={marks[r]} disabled={disabled} onClick={() => onPick(i + 1)} />
      ))}
    </div>
  );
}

export function QualityPad({ onPick, disabled, marks = {} }: PadProps<Quality>) {
  return (
    <div className="row-pad" style={{ gridTemplateColumns: `repeat(${QUALITIES.length}, 1fr)` }}>
      {QUALITIES.map((q) => (
        <PadButton key={q} label={QUALITY_SYMBOL[q]} mark={marks[QUALITY_SYMBOL[q]]} disabled={disabled} onClick={() => onPick(q)} />
      ))}
    </div>
  );
}
