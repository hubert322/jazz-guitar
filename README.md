# Changes

Jazz theory drills for guitar, built for short offline sessions on a phone. A web app (PWA): install it from Chrome and it runs with no connection.

## Drills

- **Chord spelling**: `B♭m7` → tap B♭ D♭ F A♭. 66 chords: the diatonic 7th chords of all 12 major keys, minor ii–V–i chords, and common °7s.
- **Chord tones**: "3rd of E♭7?" and "In D7, C is the…?" 3rds and 7ths come up about 3× as often as 5ths.
- **Keys & ii–V–I**: "ii in A♭?", "B♭m7 in D♭ is which degree?", "Gm7 → C7 → ?" (major and minor).
- **Fretboard**: name a marked note; find a note on every string.

Spelling is strict (A♭7 has a G♭, not an F♯). The one exception is double flats, which the keypad doesn't have: for C°7 either B♭♭ or A counts.

Every answer is timed. Facts you miss come back 3 questions later, and slow or missed facts come up more often. Practice history lives in the browser's local storage on the device.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # theory + scheduling unit tests
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
- `src/ui/`: screens, keypads, fretboard SVG
