let vibrateEnabled = true;

export function setVibrate(on: boolean) {
  vibrateEnabled = on;
}

/** Short buzz on a miss (Android only; iOS browsers ignore it). */
export function buzz() {
  if (vibrateEnabled) navigator.vibrate?.(40);
}

/** A longer double buzz, for "time's up" while both hands are on the guitar. */
export function nudge() {
  if (vibrateEnabled) navigator.vibrate?.([150, 100, 150]);
}
