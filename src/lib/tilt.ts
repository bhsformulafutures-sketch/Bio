/**
 * Deterministic per-item rotation jitter — the core anti-uniformity tool of
 * the scrapbook language. Collage elements (polaroids, tickets, stickers)
 * take a small stable tilt so grids read like a scrapbook, not a table.
 * Never tilt functional controls or running text.
 */
const TILTS = [-1.6, 1.4, -0.8, 1.9, -1.2, 0.9];

export function tiltFor(index: number): number {
  return TILTS[index % TILTS.length];
}
