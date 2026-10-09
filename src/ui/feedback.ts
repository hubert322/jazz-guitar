let vibrateEnabled = true;

export function setVibrate(on: boolean) {
  vibrateEnabled = on;
}

/** Short buzz on a miss (Android only; iOS browsers ignore it). */
export function buzz() {
  if (vibrateEnabled) navigator.vibrate?.(40);
}
