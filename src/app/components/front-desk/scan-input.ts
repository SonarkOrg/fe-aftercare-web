/** A hand-held scanner types a whole card in a burst; a person never does (spec 11.5, D35). */
export const BURST_MIN_CHARS = 12;
export const BURST_MAX_AVG_GAP_MS = 35;

/** True when `timestamps` (ms, one per printable key, oldest first) hold at least 12 keys at an average gap under 35 ms. */
export function isBurst(timestamps: number[]): boolean {
  const n = timestamps.length;
  if (n < BURST_MIN_CHARS) {
    return false;
  }
  return (timestamps[n - 1] - timestamps[0]) / (n - 1) < BURST_MAX_AVG_GAP_MS;
}
