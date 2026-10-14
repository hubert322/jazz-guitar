import { describe, expect, it } from 'vitest';
import { activeFacts, FACTS, factsIn } from '../drills/facts';
import { emptyProgress, recordAnswer, statusOf, streakDays } from './progress';
import { newSession, noteAnswer, pickNext, priority } from './scheduler';

describe('facts', () => {
  it('have unique ids', () => {
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length);
  });

  it('limit chord spelling to the chosen keys', () => {
    const spelled = (keys: number[]) => activeFacts('spell', keys).map((f) => f.id.slice('spell:'.length)).sort();
    expect(spelled([0])).toEqual(['Am7', 'Bm7♭5', 'Cmaj7', 'Dm7', 'E7', 'Em7', 'Fmaj7', 'G7', 'G♯°7']);
    // °7s are spelled once in the pool, so B♭ major's F♯°7 and E major's C°7 (B♯°7) both turn up.
    expect(spelled([10])).toContain('F♯°7');
    expect(spelled([4])).toContain('C°7');
  });

  it('puts every key-based fact in some key and leaves the fretboard alone', () => {
    for (const f of FACTS) expect(f.keys.length > 0).toBe(f.area !== 'fretboard');
    expect(activeFacts('fretboard', [0])).toEqual(factsIn('fretboard'));
    const cadences = activeFacts('keys', [0]).filter((f) => f.kind === 'cadence').map((f) => f.id);
    expect(cadences.sort()).toEqual(['cadence:A minor', 'cadence:C major']);
  });
});

describe('progress', () => {
  it('moves a fact from new to fluent after fast correct answers', () => {
    let p = emptyProgress();
    expect(statusOf(p.facts.x, 2500)).toBe('new');
    p = recordAnswer(p, 'x', true, 1500, 2500);
    expect(statusOf(p.facts.x, 2500)).toBe('learning');
    p = recordAnswer(p, 'x', true, 1500, 2500);
    expect(statusOf(p.facts.x, 2500)).toBe('fluent');
    p = recordAnswer(p, 'x', false, 1500, 2500);
    expect(statusOf(p.facts.x, 2500)).toBe('weak');
  });

  it('caps long pauses so one distracted answer does not wreck the average', () => {
    const p = recordAnswer(emptyProgress(), 'x', true, 60_000, 2500);
    expect(p.facts.x.t).toBe(7500);
  });

  it('counts a streak of practice days', () => {
    const p = { ...emptyProgress(), days: { '2026-10-06': 3, '2026-10-07': 5, '2026-10-08': 1 } };
    expect(streakDays(p, new Date(2026, 9, 8, 12))).toBe(3);
    expect(streakDays(p, new Date(2026, 9, 9, 12))).toBe(3);
    expect(streakDays(p, new Date(2026, 9, 10, 12))).toBe(0);
  });
});

describe('scheduler', () => {
  const facts = factsIn('spell');

  it('brings a missed fact back after three other questions', () => {
    const session = newSession();
    const p = emptyProgress();
    const missed = facts[0];
    noteAnswer(session, missed, false);
    const asked: string[] = [];
    for (let i = 0; i < 3; i++) {
      const f = pickNext(facts, p, session);
      asked.push(f.id);
      noteAnswer(session, f, true);
    }
    expect(asked).not.toContain(missed.id);
    expect(pickNext(facts, p, session).id).toBe(missed.id);
  });

  it('does not repeat recent facts', () => {
    const session = newSession();
    const p = emptyProgress();
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
      const f = pickNext(facts, p, session);
      expect(seen.slice(-6)).not.toContain(f.id);
      seen.push(f.id);
      noteAnswer(session, f, true);
    }
  });

  it('ranks missed and slow facts above fluent ones', () => {
    const [a, b, c] = facts;
    let p = emptyProgress();
    const old = Date.now() - 3 * 86_400_000;
    p = recordAnswer(p, a.id, false, 3000, a.targetMs, old);
    p = recordAnswer(p, b.id, true, b.targetMs * 2, b.targetMs, old);
    p = recordAnswer(p, c.id, true, 1000, c.targetMs, old);
    p = recordAnswer(p, c.id, true, 1000, c.targetMs, old);
    expect(priority(a, p)).toBeGreaterThan(priority(b, p));
    expect(priority(b, p)).toBeGreaterThan(priority(c, p));
  });
});
