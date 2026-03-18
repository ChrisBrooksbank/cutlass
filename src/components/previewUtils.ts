import type { Clip, Track } from '@/store'

export function findActiveVideoClip(tracks: Track[], currentTime: number): Clip | null {
  for (const track of tracks) {
    if (track.type !== 'video' || track.muted) continue
    for (const clip of track.clips) {
      if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        return clip
      }
    }
  }
  return null
}

export function sourceTimeForClip(clip: Clip, currentTime: number): number {
  return clip.sourceIn + (currentTime - clip.startTime) * clip.speed
}

export function projectDuration(tracks: Track[]): number {
  return tracks
    .flatMap((t) => t.clips)
    .reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const f = Math.floor((seconds % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`
}
