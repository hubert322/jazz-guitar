import { type ReactNode, useRef, useState } from 'react';
import type { Fact } from '../drills/facts';
import { type Chord, chordName, chordTones, type Degree, DEGREE_LABEL, type Quality, QUALITY_DEGREES, QUALITY_SYMBOL, TONE_ORDINAL } from '../theory/chords';
import { fretsFor, pitchAt } from '../theory/fretboard';
import { diatonicChord, diatonicChords, keyName, ROMAN, twoFiveOne } from '../theory/keys';
import { accepts, GRID_ROWS, type Note, noteName, pc, pitchNames, sameNote } from '../theory/notes';
import { buzz } from './feedback';
import { type Dot, Fretboard } from './Fretboard';
import { DegreePad, type Mark, NoteGrid, QualityPad, RomanPad } from './pads';

type FactOf<K extends Fact['kind']> = Extract<Fact, { kind: K }>;

export interface QuestionProps<F extends Fact = Fact> {
  fact: F;
  revealed: boolean;
  onAnswer: (correct: boolean) => void;
}

export function QuestionView(props: QuestionProps) {
  const { fact } = props;
  switch (fact.kind) {
    case 'spell':
      return <SpellQuestion {...props} fact={fact} />;
    case 'tone':
      return <ToneQuestion {...props} fact={fact} />;
    case 'degree':
      return <DegreeQuestion {...props} fact={fact} />;
    case 'diatonic':
      return <DiatonicQuestion {...props} fact={fact} />;
    case 'function':
      return <FunctionQuestion {...props} fact={fact} />;
    case 'cadence':
      return <CadenceQuestion {...props} fact={fact} />;
    case 'fretName':
      return <FretNameQuestion {...props} fact={fact} />;
    case 'fretFind':
      return <FretFindQuestion {...props} fact={fact} />;
  }
}

function Prompt({ kicker, main, ask, long }: { kicker?: ReactNode; main: ReactNode; ask: ReactNode; long?: boolean }) {
  return (
    <div className="prompt">
      {kicker && <div className="kicker">{kicker}</div>}
      <div className={`main ${long ? 'long' : ''}`}>{main}</div>
      <div className="ask">{ask}</div>
    </div>
  );
}

/** Grid labels that count as the expected note (a double flat maps to its enharmonic). */
function gridMatches(expected: Note): string[] {
  return GRID_ROWS.flat()
    .filter((g) => accepts(expected, g))
    .map(noteName);
}

function marksFor(revealed: boolean, rightLabels: string[], picked?: string): Record<string, Mark> {
  if (!revealed) return picked ? { [picked]: 'picked' } : {};
  const marks: Record<string, Mark> = {};
  if (picked) marks[picked] = 'wrong';
  for (const l of rightLabels) marks[l] = 'right';
  return marks;
}

function ChordChips({ chord, highlight }: { chord: Chord; highlight?: number }) {
  const degrees = QUALITY_DEGREES[chord.quality];
  return (
    <div className="chips">
      {chordTones(chord).map((t, i) => (
        <div key={i} className={`chip ${i === highlight ? 'hl' : ''}`}>
          <span className="chip-main">{noteName(t)}</span>
          <span className="chip-sub">{DEGREE_LABEL[degrees[i]]}</span>
        </div>
      ))}
    </div>
  );
}

function DiatonicRow({ keyNote, highlight }: { keyNote: Note; highlight: number }) {
  return (
    <div className="chips chips-wide">
      {diatonicChords(keyNote).map((c, i) => (
        <div key={i} className={`chip ${i === highlight ? 'hl' : ''}`}>
          <span className="chip-main">{chordName(c)}</span>
          <span className="chip-sub">{ROMAN[i]}</span>
        </div>
      ))}
    </div>
  );
}

// --- Chord spelling ------------------------------------------------------------------------

function SpellQuestion({ fact, revealed, onAnswer }: QuestionProps<FactOf<'spell'>>) {
  const tones = chordTones(fact.chord);
  const degrees = QUALITY_DEGREES[fact.chord.quality];
  const [entries, setEntries] = useState<{ given: Note; ok: boolean }[]>([]);
  const entriesRef = useRef(entries);

  const pick = (n: Note) => {
    const current = entriesRef.current;
    if (current.length >= 3) return;
    const ok = accepts(tones[current.length + 1], n);
    if (!ok) buzz();
    const next = [...current, { given: n, ok }];
    entriesRef.current = next;
    setEntries(next);
    if (next.length === 3) onAnswer(next.every((e) => e.ok));
  };

  return (
    <>
      <div className="stage">
        <Prompt main={chordName(fact.chord)} ask="Spell it: 3rd, 5th, 7th" />
        <div className="slots">
          {tones.map((t, i) => {
            const entry = i === 0 ? undefined : entries[i - 1];
            const state = i === 0 ? 'root' : !entry ? (i === entries.length + 1 ? 'next' : 'empty') : entry.ok ? 'ok' : 'bad';
            return (
              <div key={i} className={`slot slot-${state}`}>
                <span className="slot-note">
                  {i === 0 || entry ? noteName(t) : ''}
                  {entry && !entry.ok && <s className="slot-typed">{noteName(entry.given)}</s>}
                </span>
                <span className="slot-label">{revealed || entry ? DEGREE_LABEL[degrees[i]] : TONE_ORDINAL[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="pad">
        <NoteGrid onPick={pick} disabled={revealed} />
      </div>
    </>
  );
}

// --- Chord tones -----------------------------------------------------------------------------

function ToneQuestion({ fact, revealed, onAnswer }: QuestionProps<FactOf<'tone'>>) {
  const expected = chordTones(fact.chord)[fact.index];
  const [picked, setPicked] = useState<Note>();
  const pick = (n: Note) => {
    if (picked) return;
    setPicked(n);
    onAnswer(accepts(expected, n));
  };
  const pickedLabel = picked && !accepts(expected, picked) ? noteName(picked) : undefined;
  return (
    <>
      <div className="stage">
        <Prompt main={chordName(fact.chord)} ask={`What's the ${TONE_ORDINAL[fact.index]}?`} />
        {revealed && <ChordChips chord={fact.chord} highlight={fact.index} />}
      </div>
      <div className="pad">
        <NoteGrid onPick={pick} disabled={revealed} marks={marksFor(revealed, gridMatches(expected), pickedLabel)} />
      </div>
    </>
  );
}

function DegreeQuestion({ fact, revealed, onAnswer }: QuestionProps<FactOf<'degree'>>) {
  const given = chordTones(fact.chord)[fact.index];
  const expected = QUALITY_DEGREES[fact.chord.quality][fact.index];
  const [picked, setPicked] = useState<Degree>();
  const pick = (d: Degree) => {
    if (picked) return;
    setPicked(d);
    onAnswer(d === expected);
  };
  const pickedLabel = picked && picked !== expected ? DEGREE_LABEL[picked] : undefined;
  return (
    <>
      <div className="stage">
        <Prompt main={chordName(fact.chord)} ask={<><b>{noteName(given)}</b> is the…</>} />
        {revealed && <ChordChips chord={fact.chord} highlight={fact.index} />}
      </div>
      <div className="pad">
        <DegreePad onPick={pick} disabled={revealed} marks={marksFor(revealed, [DEGREE_LABEL[expected]], pickedLabel)} />
      </div>
    </>
  );
}

// --- Keys ------------------------------------------------------------------------------------

function DiatonicQuestion({ fact, revealed, onAnswer }: QuestionProps<FactOf<'diatonic'>>) {
  const expected = diatonicChord(fact.key, fact.degree);
  const [root, setRoot] = useState<Note>();
  const [quality, setQuality] = useState<Quality>();
  const done = useRef(false);

  const tryFinish = (r?: Note, q?: Quality) => {
    if (!r || !q || done.current) return;
    done.current = true;
    onAnswer(sameNote(r, expected.root) && q === expected.quality);
  };
  const pickRoot = (n: Note) => {
    if (done.current) return;
    setRoot(n);
    tryFinish(n, quality);
  };
  const pickQuality = (q: Quality) => {
    if (done.current) return;
    setQuality(q);
    tryFinish(root, q);
  };

  const rootMarks: Record<string, Mark> = revealed
    ? { ...(root && !sameNote(root, expected.root) ? { [noteName(root)]: 'wrong' } : {}), [noteName(expected.root)]: 'right' }
    : root
      ? { [noteName(root)]: 'picked' }
      : {};
  const qualityMarks: Record<string, Mark> = revealed
    ? { ...(quality && quality !== expected.quality ? { [QUALITY_SYMBOL[quality]]: 'wrong' } : {}), [QUALITY_SYMBOL[expected.quality]]: 'right' }
    : quality
      ? { [QUALITY_SYMBOL[quality]]: 'picked' }
      : {};

  return (
    <>
      <div className="stage">
        <Prompt kicker={keyName(fact.key)} main={ROMAN[fact.degree]} ask="Which chord? Root + quality" />
        {revealed && <DiatonicRow keyNote={fact.key} highlight={fact.degree} />}
      </div>
      <div className="pad">
        <QualityPad onPick={pickQuality} disabled={revealed} marks={qualityMarks} />
        <NoteGrid onPick={pickRoot} disabled={revealed} marks={rootMarks} />
      </div>
    </>
  );
}

function FunctionQuestion({ fact, revealed, onAnswer }: QuestionProps<FactOf<'function'>>) {
  const c = diatonicChord(fact.key, fact.degree);
  const [picked, setPicked] = useState<number>();
  const pick = (d: number) => {
    if (picked !== undefined) return;
    setPicked(d);
    onAnswer(d === fact.degree);
  };
  const pickedLabel = picked !== undefined && picked !== fact.degree ? ROMAN[picked] : undefined;
  return (
    <>
      <div className="stage">
        <Prompt kicker={`in ${keyName(fact.key)}`} main={chordName(c)} ask="Which degree?" />
        {revealed && <DiatonicRow keyNote={fact.key} highlight={fact.degree} />}
      </div>
      <div className="pad">
        <RomanPad onPick={pick} disabled={revealed} marks={marksFor(revealed, [ROMAN[fact.degree]], pickedLabel)} />
      </div>
    </>
  );
}

function CadenceQuestion({ fact, revealed, onAnswer }: QuestionProps<FactOf<'cadence'>>) {
  const { chords } = twoFiveOne(fact.tonic, fact.minor);
  const [picked, setPicked] = useState<Note>();
  const pick = (n: Note) => {
    if (picked) return;
    setPicked(n);
    onAnswer(sameNote(n, fact.tonic));
  };
  const pickedLabel = picked && !sameNote(picked, fact.tonic) ? noteName(picked) : undefined;
  return (
    <>
      <div className="stage">
        <Prompt main={`${chordName(chords[0])} → ${chordName(chords[1])} → ?`} long ask="Resolves to which key?" />
        {revealed && (
          <div className="reveal-line">
            <b>{keyName(fact.tonic, fact.minor)}</b>: {chords.map(chordName).join(' → ')}
          </div>
        )}
      </div>
      <div className="pad">
        <NoteGrid onPick={pick} disabled={revealed} marks={marksFor(revealed, [noteName(fact.tonic)], pickedLabel)} />
      </div>
    </>
  );
}

// --- Fretboard -------------------------------------------------------------------------------

/** Grid labels for a pitch with no key context: the natural, or else its ♯ and ♭ names. */
function plainNames(pitch: number): string[] {
  const matches = GRID_ROWS.flat().filter((n) => pc(n) === pitch);
  const natural = matches.filter((n) => n.acc === 0);
  return (natural.length ? natural : matches).map(noteName);
}

function FretNameQuestion({ fact, revealed, onAnswer }: QuestionProps<FactOf<'fretName'>>) {
  const pitch = pitchAt(fact.string, fact.fret);
  const [picked, setPicked] = useState<Note>();
  const pick = (n: Note) => {
    if (picked) return;
    setPicked(n);
    onAnswer(pc(n) === pitch);
  };
  const pickedLabel = picked && pc(picked) !== pitch ? noteName(picked) : undefined;
  const dot: Dot = { string: fact.string, fret: fact.fret, tone: revealed ? (pickedLabel ? 'wrong' : 'right') : 'target', label: revealed ? pitchNames(pitch) : undefined };
  return (
    <>
      <div className="stage stage-board">
        <div className="ask-top">Name this note</div>
        <Fretboard dots={[dot]} compact />
      </div>
      <div className="pad">
        <NoteGrid onPick={pick} disabled={revealed} marks={marksFor(revealed, plainNames(pitch), pickedLabel)} />
      </div>
    </>
  );
}

function FretFindQuestion({ fact, revealed, onAnswer }: QuestionProps<FactOf<'fretFind'>>) {
  const [name] = useState(() => {
    const names = plainNames(fact.pitch);
    return names[Math.floor(Math.random() * names.length)];
  });
  const [found, setFound] = useState<Dot[]>([]);
  const [misses, setMisses] = useState<Dot[]>([]);
  const state = useRef({ found: [] as Dot[], misses: 0, done: false });

  const finish = (correct: boolean) => {
    if (state.current.done) return;
    state.current.done = true;
    onAnswer(correct);
  };

  const tap = (string: number, fret: number) => {
    const s = state.current;
    if (s.done || s.found.some((d) => d.string === string)) return;
    if (pitchAt(string, fret) === fact.pitch) {
      s.found = [...s.found, { string, fret, tone: 'right', label: name }];
      setFound(s.found);
      if (s.found.length === 6) finish(s.misses === 0);
    } else {
      s.misses++;
      buzz();
      // Label the miss with what it actually is, so a wrong tap still teaches something.
      const miss: Dot = { string, fret, tone: 'wrong', label: pitchNames(pitchAt(string, fret)) };
      setMisses((m) => (m.some((d) => d.string === string && d.fret === fret) ? m : [...m, miss]));
    }
  };

  // After a give-up, show where the rest were.
  const missed: Dot[] = revealed
    ? Array.from({ length: 6 }, (_, string) => string)
        .filter((string) => !found.some((d) => d.string === string))
        .flatMap((string) => fretsFor(string, fact.pitch).map((fret) => ({ string, fret, tone: 'missed' as const, label: name })))
    : [];

  return (
    <>
      <div className="stage stage-board">
        <div className="ask-top">
          Find <b>{name}</b> on every string <span className="muted">· {found.length}/6</span>
        </div>
        <Fretboard dots={[...misses, ...found, ...missed]} onTap={revealed ? undefined : tap} />
      </div>
      <div className="pad pad-slim">
        <button type="button" className="ghost-btn" disabled={revealed} onClick={() => finish(false)}>
          Show me
        </button>
      </div>
    </>
  );
}
