import type { Track } from '@/store/types'

export const BACKGROUND_MUSIC_TRACK_NAME = 'Background Music'

/**
 * Compute the timeline insert time for a new background music clip.
 * Returns the end time of the last clip on background music audio tracks,
 * or 0 if no clips exist on those tracks.
 */
export function computeBackgroundMusicInsertTime(tracks: Track[]): number {
  let maxEnd = 0
  for (const track of tracks) {
    if (track.type !== 'audio' || track.name !== BACKGROUND_MUSIC_TRACK_NAME) continue
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration
      if (end > maxEnd) maxEnd = end
    }
  }
  return maxEnd
}
