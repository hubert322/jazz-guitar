import { mod } from './notes';

/** Standard tuning, low E (string 0) to high E (string 5), as pitch classes. */
export const OPEN_STRINGS = [4, 9, 2, 7, 11, 4];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const FRET_COUNT = 12;

export const pitchAt = (string: number, fret: number) => mod(OPEN_STRINGS[string] + fret, 12);

/** Every fret (0..12) on a string that sounds the given pitch class. */
export function fretsFor(string: number, pitch: number): number[] {
  const frets: number[] = [];
  for (let f = 0; f <= FRET_COUNT; f++) if (pitchAt(string, f) === pitch) frets.push(f);
  return frets;
}
