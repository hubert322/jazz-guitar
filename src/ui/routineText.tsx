import { Fragment } from 'react';
import { type Exercise, fretStage, type Progression } from '../routine/routine';
import { dayKey } from '../srs/progress';

const PROGRESSION_LABEL: Record<Progression, string> = { iiVI: 'ii–V–I', diatonic: 'Diatonic chords', vamp: 'Vamp' };
const MODE_LABEL = { major: 'major', minor: 'minor', mix: 'major & minor' };

/** One line on what the exercise shows while playing. */
export function promptSummary(e: Exercise): string {
  const p = e.prompt;
  const cues = e.cues.length > 0 ? ` · ${e.cues.length} cues` : '';
  switch (p.kind) {
    case 'none':
      return `Timer and metronome${cues}`;
    case 'notes': {
      const stage = fretStage(p.stage);
      return `Stage ${p.stage}: ${stage.title}${stage.play === 'reps' ? '' : `, ${p.beatsEach} beats each`}${cues}`;
    }
    case 'chords': {
      const mode = p.progression === 'diatonic' ? '' : ` (${MODE_LABEL[p.mode]})`;
      return `${PROGRESSION_LABEL[p.progression]}${mode}, ${p.barsEach} ${p.barsEach === 1 ? 'bar' : 'bars'} each${cues}`;
    }
    case 'playAlong':
      return 'ii–V–I play-along';
  }
}

export function daysAgo(day: string, now = new Date()): string {
  const [y, m, d] = day.split('-').map(Number);
  const n = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n} days ago`;
}

/** "Clean at 48 · stage 2 · yesterday", or nothing yet. */
export function lastRun(e: Exercise): string {
  const last = e.log.at(-1);
  if (!last) return 'Not played yet';
  const how = last.clean ? 'Clean' : 'Messy';
  const stage = last.stage ? ` · stage ${last.stage}` : '';
  return `${last.bpm === null ? how : `${how} at ${last.bpm}`}${stage} · ${daysAgo(last.d)}`;
}

export const doneToday = (e: Exercise) => e.log.some((l) => l.d === dayKey());

const URL_RE = /(https?:\/\/\S+)/g;

/** Exercise notes as written, with links clickable. */
export function Notes({ text }: { text: string }) {
  return (
    <p className="ex-notes">
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
