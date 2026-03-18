import type { Track } from '@/store/types'

/**
 * Returns clip IDs from all tracks whose time range strictly contains `time`
 * (i.e. time > clip.startTime && time < clip.startTime + clip.duration).
 *
 * Used to find split candidates when the user invokes the split tool.
 */
export function findClipIdsAtTime(tracks: Track[], time: number): string[] {
  const result: string[] = []
  for (const track of tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.startTime + clip.duration
      if (time > clip.startTime && time < clipEnd) {
        result.push(clip.id)
      }
    }
  }
  return result
}

/**
 * Given the current selection and all tracks, return the clip IDs that should
 * be split at `time`.
 *
 * - If clips are selected, split only those that span `time`.
 * - Otherwise fall back to any clip that spans `time`.
 */
export function getSplitCandidates(
  tracks: Track[],
  selectedClipIds: string[],
  time: number,
): string[] {
  const atTime = new Set(findClipIdsAtTime(tracks, time))
  if (selectedClipIds.length > 0) {
    return selectedClipIds.filter((id) => atTime.has(id))
  }
  return [...atTime]
}
