import { useRef } from 'react';
import { BPM_MAX, BPM_MIN, clampBpm } from '../play/tempo';

/** − / tempo / + / Tap, with a slider underneath. */
export function TempoControl({ bpm, onBpm }: { bpm: number; onBpm: (bpm: number) => void }) {
  const taps = useRef<number[]>([]);

  const tap = () => {
    const now = performance.now();
    const recent = [...taps.current.filter((t) => now - t < 2500), now].slice(-5);
    taps.current = recent;
    if (recent.length < 2) return;
    const gap = (recent.at(-1)! - recent[0]) / (recent.length - 1);
    onBpm(clampBpm(60000 / gap));
  };

  return (
    <>
      <div className="ctl-row tempo">
        <button type="button" className="key-chip" aria-label="Slower" onClick={() => onBpm(clampBpm(bpm - 2))}>
          −
        </button>
        <span className="bpm">
          <b>{bpm}</b> BPM
        </span>
        <button type="button" className="key-chip" aria-label="Faster" onClick={() => onBpm(clampBpm(bpm + 2))}>
          +
        </button>
        <button type="button" className="key-chip tap" onPointerDown={tap}>
          Tap
        </button>
      </div>
      <input
        type="range"
        className="bpm-slider"
        aria-label="Tempo"
        min={BPM_MIN}
        max={BPM_MAX}
        value={bpm}
        onChange={(e) => onBpm(Number(e.target.value))}
      />
    </>
  );
}
