import type { Area, Fact } from '../drills/facts';
import { type Progress, statusOf } from './progress';

const DAY = 86_400_000;
const MINUTE = 60_000;
/** A missed fact comes back after this many other questions. */
const RETRY_AFTER = 3;

export interface Session {
  /** Most recent fact ids, newest last. */
  recent: string[];
  /** Missed facts waiting to come back: id → questions left until due. */
  retry: Map<string, number>;
}

export const newSession = (): Session => ({ recent: [], retry: new Map() });

/** How much a fact needs practice. Misses dominate, then slowness, then time since last seen. */
export function priority(fact: Fact, progress: Progress, now = Date.now()): number {
  const stat = progress.facts[fact.id];
  if (!stat) return fact.weight * 2.5;
  const slow = stat.t === null ? 1 : Math.min(Math.max(stat.t / fact.targetMs - 1, 0), 2);
  const days = (now - stat.l) / DAY;
  let p = 0.6 + 5 * stat.e + 2 * slow + Math.min(days, 10) * 0.25;
  if (statusOf(stat, fact.targetMs) === 'fluent') p *= 0.35;
  if (!stat.w && now - stat.l < 10 * MINUTE) p *= 0.5;
  return fact.weight * p;
}

function weightedPick<T>(items: T[], weight: (t: T) => number, rand: () => number): T {
  const weights = items.map(weight);
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function pickNext(facts: Fact[], progress: Progress, session: Session, rand = Math.random): Fact {
  const lastGroups = session.recent.slice(-2).map((id) => facts.find((f) => f.id === id)?.group);

  for (const [id, left] of session.retry) {
    const fact = facts.find((f) => f.id === id);
    if (left <= 0 && fact && !lastGroups.includes(fact.group)) {
      session.retry.delete(id);
      return fact;
    }
  }

  // In a mix, pick the area first so the 400 chord-tone facts don't crowd out everything else.
  const areas = [...new Set(facts.map((f) => f.area))];
  const area: Area = areas[Math.floor(rand() * areas.length)];
  const inArea = facts.filter((f) => f.area === area);

  const recent = new Set(session.recent.slice(-6));
  const fresh = inArea.filter((f) => !recent.has(f.id) && !lastGroups.includes(f.group));
  const candidates = fresh.length > 0 ? fresh : inArea;
  return weightedPick(candidates, (f) => priority(f, progress), rand);
}

export function noteAnswer(session: Session, fact: Fact, correct: boolean): void {
  session.recent.push(fact.id);
  if (session.recent.length > 20) session.recent.shift();
  for (const [id, left] of session.retry) session.retry.set(id, left - 1);
  if (!correct) session.retry.set(fact.id, RETRY_AFTER);
}
