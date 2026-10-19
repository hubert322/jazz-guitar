export const BPM_MIN = 40;
export const BPM_MAX = 240;

export const clampBpm = (bpm: number) => Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, bpm)));
