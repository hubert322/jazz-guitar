# Changes

Jazz theory drills for guitar, built for short offline sessions on a phone. A web app (PWA): install it from Chrome and it runs with no connection.

## Drills

- **Chord spelling**: `B♭m7` → tap B♭ D♭ F A♭. 66 chords: the diatonic 7th chords of all 12 major keys, minor ii–V–i chords, and common °7s. After a slow or wrong answer, tap a note to hear it or ▶ to hear the chord (piano; mixes over other apps' music).
- **Chord tones**: "3rd of E♭7?" and "In D7, C is the…?" 3rds and 7ths come up about 3× as often as 5ths.
- **Keys & ii–V–I**: "ii in A♭?", "B♭m7 in D♭ is which degree?", "Gm7 → C7 → ?" (major and minor).
- **Fretboard**: name a marked note; find a note on every string.

**ii–V–I play-along** is for playing, not answering: a random ii–V–I in the 4-bar form ii | V | I | I, over a metronome. Play the ♭9♭13 bebop scale of the V (over G7: G A♭ B C D E♭ F F♯) through the ii and V bars, then improvise for the two bars of the I. The next key shows on the line below so you can get ready. Choose which beats click (2 and 4 by default), tempo (40–240, or tap it), major, minor or both, and how many times through each key before it moves on. A piano plays each chord unless you turn it off, and *Peek at scale* shows the scale's notes. The screen stays on while it plays.

**Routine** decides what to practice so you don't have to. *Today's practice* on the home screen holds three slots (Warm-up, Focus, Apply), one exercise each, with a time for each. Everything else waits on the shelf. *Start session* goes through the slots: tap ▶ on the timer to count against the slot's minutes, tap again to pause, and ↺ to reset it to 0:00 (the phone buzzes when time's up). The metronome and prompt for the exercise run below it, and the screen stays on. An exercise marked untimed (the fretboard one, which runs until it's clean) has no timer and doesn't count toward the session's minutes. Those are the defaults: during a session, tap the time to change the minutes or remove the timer, or *Add a timer* to an untimed exercise. That change lasts for this session only. Tap *Done*, then *Clean* or *Messy*, to log the tempo. After two clean runs at a tempo the app offers to go up 4 bpm; a clean run at the goal tempo offers to send the exercise back to the shelf. Tap any exercise for its notes, its tempo history, and to move it into a slot.

New exercises take a name, notes, and what to show while playing:

- *Nothing*: just the timer and metronome (songs, transcriptions).
- *Fretboard notes*: a note per pass across the strings, alternating ↑ and ↓, in stages from [this lesson](https://www.youtube.com/watch?v=PJddQ6Q0UDo). Pick the stage at the top while playing:
  1. One natural note, no metronome: tap *Clean* three times in a row, then it moves to the next note. All 7, twice.
  2. One note per beat on the metronome, until you tap *Next note*. On the last note, *All 7 clean* ends the round.
  3. As 2, with all 10 sharps and flats (C♯ and D♭ come up separately).
  4. Two notes: the first going up, the second coming down.
  5. Stage 4 with all 7 naturals: a random order shown up front, played straight through, a new note each pass.
  6. As 5 with all 12 notes, black keys spelled either way.
  7. As 5 with all 17 spellings.

  When a stage has been through every note (stages 1–3 and 5–7), tap *Done* to log it, or go through again (a new order, for 5–7). No round puts the same fret twice in a row, so C♯ never comes right after D♭. Each stage keeps its own tempo and tempo history. A clean run at the goal tempo offers the next stage.
- *Chords*: ii–V–I, the diatonic chords of a key, or a one-chord vamp, in the keys picked on the home screen.

Any exercise can also have cues, one per line (e.g. *C shape*, *A shape*…), shown in turn or at random every few bars. The app starts with exercises from the lesson notes: fretboard notes, the ii–V–I bebop scale and CAGED arpeggios in the slots, and the rest on the shelf.

**Keys** on the home screen limit spelling, chord tones and keys drills, and the play-along, to a few keys at a time. Keys are major keys; minor ii–V–i chords come from each key's relative minor (C → A minor). Picking C gives its 7 diatonic chords plus A minor's ii–V–i and G♯°7 (9 chords instead of 66). When any of those drills is 80% fluent in your keys, the app suggests the next key around the cycle of 4ths (C F B♭ E♭ …). The fretboard drill ignores the key setting.

Any spelling of the right pitch counts, since on guitar only the pitch matters: F♯ is accepted for the ♭7 of A♭7, and A for the B♭♭ of C°7. The chord spelling drill still shows the textbook spelling once you answer.

Every answer is timed. Facts you miss come back 3 questions later, and slow or missed facts come up more often. Practice history lives in the browser's local storage on the device.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # theory, scheduling, play-along and routine unit tests
npm run build    # type check + production build into dist/
```

In dev, `?only=<kind>` limits drills to one question type, e.g. `http://localhost:5173/?only=fretFind`. Kinds: `spell`, `tone`, `degree`, `diatonic`, `function`, `cadence`, `fretName`, `fretFind`.

App icons are generated from `public/icon.svg` with `npm run icons`.

## Getting it on an Android phone

**Hosted (best for updates).** Deploy `dist/` to any static host (GitHub Pages, Cloudflare Pages, Netlify). Open the URL in Chrome on the phone, then ⋮ → *Add to Home screen* / *Install app*. New versions install themselves the next time you open the app online.

**Over USB, no hosting.** Chrome treats `localhost` as secure, so the app installs and works offline this way too:

```bash
npm run build && npm run preview          # serves dist/ on localhost:4173
adb reverse tcp:4173 tcp:4173             # phone's localhost:4173 → this Mac
```

Then open `http://localhost:4173` in Chrome on the phone and install it. To update, plug in and repeat.

## Layout

- `src/theory/`: notes, intervals, chord spelling, keys, fretboard (pure functions, unit tested)
- `src/drills/facts.ts`: every drillable fact, with target answer time and weight
- `src/srs/`: practice history (`progress.ts`) and question picking (`scheduler.ts`)
- `src/play/`: the play-along's random key sequence
- `src/routine/`: routine slots, exercises and tempo log (`routine.ts`); notes, chord passes and cues shown while playing (`prompts.ts`)
- `src/ui/`: screens, keypads, fretboard SVG

## Credits

Piano samples: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC BY 3.0. Eight notes, trimmed to 1.5s and converted to mono.
