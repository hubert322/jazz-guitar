import { FRET_COUNT, STRING_NAMES } from '../theory/fretboard';

export interface Dot {
  string: number;
  fret: number;
  label?: string;
  tone: 'target' | 'right' | 'wrong' | 'missed' | 'new' | 'weak' | 'learning' | 'fluent';
}

interface Props {
  dots?: Dot[];
  onTap?: (string: number, fret: number) => void;
  compact?: boolean;
  /** Dot radius; smaller for the stats overview where every position has a dot. */
  dotRadius?: number;
}

// Drawn like a chord diagram: nut at the top, low E on the left.
const LEFT = 40;
const STRING_GAP = 44;
const OPEN_ROW = 36;
const LABEL_ROW = 22;
const INLAYS = [3, 5, 7, 9];

export function Fretboard({ dots = [], onTap, compact, dotRadius = 15 }: Props) {
  const fretH = compact ? 32 : 40;
  const width = LEFT + STRING_GAP * 5 + 40;
  const height = OPEN_ROW + fretH * FRET_COUNT + LABEL_ROW;
  const x = (s: number) => LEFT + s * STRING_GAP;
  const cy = (f: number) => (f === 0 ? OPEN_ROW / 2 : OPEN_ROW + (f - 0.5) * fretH);
  const midX = (x(2) + x(3)) / 2;

  return (
    <svg className="fretboard" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Guitar fretboard">
      <rect x={x(0)} y={OPEN_ROW} width={x(5) - x(0)} height={fretH * FRET_COUNT} className="fb-wood" />
      {INLAYS.map((f) => (
        <circle key={f} cx={midX} cy={cy(f)} r={6} className="fb-inlay" />
      ))}
      <circle cx={(x(1) + x(2)) / 2} cy={cy(12)} r={6} className="fb-inlay" />
      <circle cx={(x(3) + x(4)) / 2} cy={cy(12)} r={6} className="fb-inlay" />
      {[...INLAYS, 12].map((f) => (
        <text key={f} x={14} y={cy(f) + 4} className="fb-fretnum">
          {f}
        </text>
      ))}
      {Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
        <line key={f} x1={x(0)} x2={x(5)} y1={OPEN_ROW + f * fretH} y2={OPEN_ROW + f * fretH} className={f === 0 ? 'fb-nut' : 'fb-fret'} />
      ))}
      {STRING_NAMES.map((name, s) => (
        <g key={s}>
          <line x1={x(s)} x2={x(s)} y1={OPEN_ROW} y2={OPEN_ROW + fretH * FRET_COUNT} className="fb-string" strokeWidth={2.2 - s * 0.25} />
          <text x={x(s)} y={height - 6} className="fb-strname">
            {name}
          </text>
        </g>
      ))}
      {dots.map((d) => (
        <g key={`${d.string}:${d.fret}`} className={`fb-dot dot-${d.tone}`}>
          <circle cx={x(d.string)} cy={cy(d.fret)} r={d.label && d.label.length > 2 ? dotRadius + 2 : dotRadius} />
          {d.label && (
            <text x={x(d.string)} y={cy(d.fret) + 4} className="fb-dotlabel" style={{ fontSize: d.label.length > 2 ? 10 : 13 }}>
              {d.label}
            </text>
          )}
        </g>
      ))}
      {onTap &&
        Array.from({ length: 6 }, (_, s) =>
          Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
            <rect
              key={`${s}:${f}`}
              x={x(s) - STRING_GAP / 2}
              y={f === 0 ? 0 : OPEN_ROW + (f - 1) * fretH}
              width={STRING_GAP}
              height={f === 0 ? OPEN_ROW : fretH}
              className="fb-hit"
              onPointerDown={(e) => {
                e.preventDefault();
                onTap(s, f);
              }}
            />
          )),
        )}
    </svg>
  );
}
