import type { Track } from '@/store/types'

/** Snap threshold in seconds: snap when within this distance of a boundary. */
export const SNAP_THRESHOLD_SEC = 0.1

/**
 * Collect all unique clip boundary times (start and end) from all tracks.
 * Returns times sorted ascending.
 */
export function getClipBoundaryTimes(tracks: Track[]): number[] {
  const times = new Set<number>()
  for (const track of tracks) {
    for (const clip of track.clips) {
      times.add(clip.startTime)
      times.add(clip.startTime + clip.duration)
    }
  }
  return Array.from(times).sort((a, b) => a - b)
}

/**
 * Snap `time` to the nearest value in `snapTimes` if within `thresholdSec`.
 * Returns the (possibly snapped) time, clamped to >= 0.
 */
export function snapTime(time: number, snapTimes: number[], thresholdSec: number): number {
  let best = time
  let bestDist = thresholdSec + 1e-9

  for (const t of snapTimes) {
    const dist = Math.abs(time - t)
    if (dist < bestDist) {
      bestDist = dist
      best = t
    }
  }

  return Math.max(0, best)
}
