import { KEY_CYCLE } from '../theory/keys';

/** Per-fact practice history, kept small because it's saved after every answer. */
export interface FactStat {
  /** attempts */
  n: number;
  /** correct answers */
  c: number;
  /** error rate, exponentially weighted (0 = always right, 1 = always wrong) */
  e: number;
  /** answer time in ms, exponentially weighted over correct answers only */
  t: number | null;
  /** current run of correct answers */
  s: number;
  /** last seen, epoch ms */
  l: number;
  /** last answer was wrong */
  w: boolean;
}

export interface Settings {
  vibrate: boolean;
  /** Major keys in rotation, as pitch classes. */
  keys: number[];
}

export interface Progress {
  v: 1;
  facts: Record<string, FactStat>;
  /** answers per local date, "YYYY-MM-DD" */
  days: Record<string, number>;
  settings: Settings;
}

const STORAGE_KEY = 'changes:v1';

export const emptyProgress = (): Progress => ({ v: 1, facts: {}, days: {}, settings: { vibrate: true, keys: KEY_CYCLE } });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Progress;
    if (parsed?.v !== 1 || typeof parsed.facts !== 'object') return emptyProgress();
    const settings = { ...emptyProgress().settings, ...parsed.settings };
    if (!Array.isArray(settings.keys) || settings.keys.length === 0) settings.keys = KEY_CYCLE;
    return { ...emptyProgress(), ...parsed, settings };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage full or blocked: keep practicing in memory.
  }
}

export function dayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ERROR_ALPHA = 0.35;
const TIME_ALPHA = 0.4;

export function recordAnswer(p: Progress, factId: string, correct: boolean, ms: number, targetMs: number, now = Date.now()): Progress {
  const prev = p.facts[factId];
  // A long pause (stop arrived, looked away) shouldn't wreck the average, so cap it.
  const time = Math.min(ms, targetMs * 3);
  const miss = correct ? 0 : 1;
  const stat: FactStat = prev
    ? {
        n: prev.n + 1,
        c: prev.c + (correct ? 1 : 0),
        e: prev.e * (1 - ERROR_ALPHA) + miss * ERROR_ALPHA,
        t: correct ? (prev.t === null ? time : prev.t * (1 - TIME_ALPHA) + time * TIME_ALPHA) : prev.t,
        s: correct ? prev.s + 1 : 0,
        l: now,
        w: !correct,
      }
    : { n: 1, c: correct ? 1 : 0, e: miss, t: correct ? time : null, s: correct ? 1 : 0, l: now, w: !correct };
  const today = dayKey(new Date(now));
  return {
    ...p,
    facts: { ...p.facts, [factId]: stat },
    days: { ...p.days, [today]: (p.days[today] ?? 0) + 1 },
  };
}

export type Status = 'new' | 'weak' | 'learning' | 'fluent';

export function statusOf(stat: FactStat | undefined, targetMs: number): Status {
  if (!stat) return 'new';
  if (stat.w || stat.e > 0.35) return 'weak';
  if (stat.t !== null && stat.t <= targetMs && stat.s >= 2) return 'fluent';
  return 'learning';
}

/** Combine several facts into one heatmap cell: any miss shows red, all fluent shows green. */
export function combineStatus(statuses: Status[]): Status {
  if (statuses.length === 0 || statuses.every((s) => s === 'new')) return 'new';
  if (statuses.includes('weak')) return 'weak';
  if (statuses.every((s) => s === 'fluent')) return 'fluent';
  return 'learning';
}

/** Consecutive days with practice, counting back from today (or yesterday if nothing yet today). */
export function streakDays(p: Progress, now = new Date()): number {
  const d = new Date(now);
  if (!p.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (p.days[dayKey(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
