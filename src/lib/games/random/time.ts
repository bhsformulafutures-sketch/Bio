/** Milliseconds until `iso`, floored at zero. */
export function msUntil(iso: string): number {
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

/** A compact, friendly "time left" label, e.g. "23h 41m" or "8m 12s". */
export function formatTimeLeft(iso: string): string {
  const ms = msUntil(iso);
  if (ms === 0) return "time's up";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
