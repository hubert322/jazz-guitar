import { useEffect } from 'react';

/** Keeps the screen on while `on`; Android drops the lock whenever the app is hidden. */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    navigator.wakeLock
      .request('screen')
      .then((l) => (done ? void l.release() : (lock = l)))
      .catch(() => {});
    return () => {
      done = true;
      void lock?.release();
    };
  }, [on]);
}
