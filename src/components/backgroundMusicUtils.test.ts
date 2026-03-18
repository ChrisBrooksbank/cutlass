import { describe, it, expect } from 'vitest'
import {
  BACKGROUND_MUSIC_TRACK_NAME,
  computeBackgroundMusicInsertTime,
} from './backgroundMusicUtils'
import type { Track } from '@/store/types'

function makeTrack(
  type: Track['type'],
  name: string,
  clips: Array<{ startTime: number; duration: number }> = [],
): Track {
  return {
    id: crypto.randomUUID(),
    type,
    name,
    muted: false,
    locked: false,
    volume: 1,
    noiseReduction: false,
    clips: clips.map((c) => ({
      id: crypto.randomUUID(),
      trackId: 'track-1',
      sourceId: 'src-1',
      startTime: c.startTime,
      duration: c.duration,
      sourceIn: 0,
      sourceOut: c.duration,
      speed: 1,
      effects: [],
    })),
  }
}

describe('BACKGROUND_MUSIC_TRACK_NAME', () => {
  it('is "Background Music"', () => {
    expect(BACKGROUND_MUSIC_TRACK_NAME).toBe('Background Music')
  })
})

describe('computeBackgroundMusicInsertTime', () => {
  it('returns 0 when there are no tracks', () => {
    expect(computeBackgroundMusicInsertTime([])).toBe(0)
  })

  it('returns 0 when there are no background music tracks', () => {
    const tracks = [
      makeTrack('audio', 'Voiceover 1', [{ startTime: 0, duration: 10 }]),
      makeTrack('video', 'Video 1', [{ startTime: 0, duration: 20 }]),
    ]
    expect(computeBackgroundMusicInsertTime(tracks)).toBe(0)
  })

  it('returns 0 when background music track has no clips', () => {
    const tracks = [makeTrack('audio', BACKGROUND_MUSIC_TRACK_NAME)]
    expect(computeBackgroundMusicInsertTime(tracks)).toBe(0)
  })

  it('returns end time of single clip on background music track', () => {
    const tracks = [
      makeTrack('audio', BACKGROUND_MUSIC_TRACK_NAME, [{ startTime: 5, duration: 30 }]),
    ]
    expect(computeBackgroundMusicInsertTime(tracks)).toBe(35)
  })

  it('returns max end time across multiple clips on background music track', () => {
    const tracks = [
      makeTrack('audio', BACKGROUND_MUSIC_TRACK_NAME, [
        { startTime: 0, duration: 60 },
        { startTime: 70, duration: 30 },
      ]),
    ]
    expect(computeBackgroundMusicInsertTime(tracks)).toBe(100)
  })

  it('ignores non-background-music audio tracks', () => {
    const tracks = [
      makeTrack('audio', 'Voiceover 1', [{ startTime: 0, duration: 120 }]),
      makeTrack('audio', BACKGROUND_MUSIC_TRACK_NAME, [{ startTime: 0, duration: 30 }]),
    ]
    expect(computeBackgroundMusicInsertTime(tracks)).toBe(30)
  })

  it('ignores video tracks named "Background Music"', () => {
    const tracks = [
      makeTrack('video', BACKGROUND_MUSIC_TRACK_NAME, [{ startTime: 0, duration: 50 }]),
    ]
    expect(computeBackgroundMusicInsertTime(tracks)).toBe(0)
  })
})
