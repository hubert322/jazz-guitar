import { useEffect, useMemo, useRef, useState } from 'react';
import { AREAS, type Area, type Fact, FACTS, factsIn } from '../drills/facts';
import type { Progress } from '../srs/progress';
import { newSession, noteAnswer, pickNext } from '../srs/scheduler';
import { QuestionView } from './questions';

interface Props {
  area: Area | 'mix';
  progress: Progress;
  onRecord: (fact: Fact, correct: boolean, ms: number) => void;
  onExit: () => void;
}

/** Times a question, leaving out time the app spent in the background (phone locked, other app). */
function useQuestionTimer(questionKey: number) {
  const start = useRef(0);
  const paused = useRef(0);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    start.current = performance.now();
    paused.current = 0;
    hiddenAt.current = document.hidden ? performance.now() : null;
  }, [questionKey]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) hiddenAt.current = performance.now();
      else if (hiddenAt.current !== null) {
        paused.current += performance.now() - hiddenAt.current;
        hiddenAt.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return () => performance.now() - start.current - paused.current;
}

const fmtSecs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** Question types whose answer can be played back after a slow or wrong answer. */
const AUDIBLE: ReadonlySet<Fact['kind']> = new Set(['spell']);

export function DrillScreen({ area, progress, onRecord, onExit }: Props) {
  const facts = useMemo(() => {
    const all = area === 'mix' ? FACTS : factsIn(area);
    // Dev only: ?only=fretFind limits a drill to one question type for testing.
    const only = import.meta.env.DEV ? new URLSearchParams(location.search).get('only') : null;
    return only ? FACTS.filter((f) => f.kind === only) : all;
  }, [area]);
  const session = useRef(newSession());
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const [question, setQuestion] = useState(() => ({ n: 0, fact: pickNext(facts, progress, session.current) }));
  const [result, setResult] = useState<{ correct: boolean; ms: number; at: number } | null>(null);
  const [tally, setTally] = useState({ right: 0, total: 0, rightMs: 0 });
  const elapsed = useQuestionTimer(question.n);

  const answer = (correct: boolean) => {
    if (result) return;
    const ms = elapsed();
    noteAnswer(session.current, question.fact, correct);
    onRecord(question.fact, correct, ms);
    setResult({ correct, ms, at: performance.now() });
    setTally((t) => ({ right: t.right + (correct ? 1 : 0), total: t.total + 1, rightMs: t.rightMs + (correct ? ms : 0) }));
  };

  const next = () => {
    // Picked outside the state updater: pickNext consumes due retries, so it must run exactly once.
    const fact = pickNext(facts, progressRef.current, session.current);
    setResult(null);
    setQuestion((q) => ({ n: q.n + 1, fact }));
  };

  const slow = !!result?.correct && result.ms > question.fact.targetMs;
  const listen = AUDIBLE.has(question.fact.kind) && !!result && (!result.correct || slow);
  // Wait for a tap after a miss, or when there's an answer to listen to.
  const hold = !!result && (!result.correct || listen);

  useEffect(() => {
    if (!result || hold) return;
    const id = setTimeout(next, 650);
    return () => clearTimeout(id);
  }, [result, hold]);

  const title = area === 'mix' ? 'Mix' : AREAS.find((a) => a.id === area)!.title;

  return (
    <div className="screen drill">
      <header className="drill-head">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Back">
          ←
        </button>
        <div className="drill-title">{title}</div>
        <div className="tally">
          {tally.total > 0 && (
            <>
              {tally.right}/{tally.total}
              {tally.right > 0 && <span className="muted"> · {fmtSecs(tally.rightMs / tally.right)}</span>}
            </>
          )}
        </div>
      </header>
      <div className="target-track">
        <div
          key={question.n}
          className={`target-bar ${result ? 'stopped' : ''}`}
          style={{ animationDuration: `${question.fact.targetMs}ms` }}
        />
      </div>

      <QuestionView key={question.n} fact={question.fact} revealed={result !== null} listen={listen} onAnswer={answer} />

      <div className={`result ${result ? (result.correct ? (slow ? 'result-slow' : 'result-ok') : 'result-bad') : ''}`} aria-live="polite">
        {result &&
          (result.correct ? (
            <>✓ {fmtSecs(result.ms)}{slow && <span> · aim for {fmtSecs(question.fact.targetMs)}</span>}</>
          ) : (
            <>✗ Not quite{!listen && '. Tap anywhere to continue'}</>
          ))}
      </div>

      {hold && (
        <div
          className="continue-layer"
          onPointerDown={(e) => {
            // Ignore the tail of the tap that gave the answer.
            if (performance.now() - result!.at < 350) return;
            e.preventDefault();
            next();
          }}
        />
      )}
    </div>
  );
}
