import { describe, it, expect } from 'vitest'
import { getClipBoundaryTimes, snapTime, SNAP_THRESHOLD_SEC } from './playheadUtils'
import type { Track } from '@/store/types'

function makeTrack(clips: { startTime: number; duration: number }[]): Track {
  return {
    id: 'track-1',
    type: 'video',
    name: 'Video 1',
    muted: false,
    locked: false,
    volume: 1,
    noiseReduction: false,
    clips: clips.map((c, i) => ({
      id: `clip-${i}`,
      trackId: 'track-1',
      sourceId: 'asset-1',
      startTime: c.startTime,
      duration: c.duration,
      sourceIn: 0,
      sourceOut: c.duration,
      speed: 1,
      effects: [],
    })),
  }
}

describe('getClipBoundaryTimes', () => {
  it('returns empty array for no tracks', () => {
    expect(getClipBoundaryTimes([])).toEqual([])
  })

  it('returns empty array for tracks with no clips', () => {
    const track = makeTrack([])
    expect(getClipBoundaryTimes([track])).toEqual([])
  })

  it('returns start and end times for a single clip', () => {
    const track = makeTrack([{ startTime: 2, duration: 3 }])
    expect(getClipBoundaryTimes([track])).toEqual([2, 5])
  })

  it('returns sorted unique boundary times across multiple clips', () => {
    const track = makeTrack([
      { startTime: 5, duration: 2 }, // boundaries: 5, 7
      { startTime: 0, duration: 3 }, // boundaries: 0, 3
    ])
    expect(getClipBoundaryTimes([track])).toEqual([0, 3, 5, 7])
  })

  it('deduplicates when clip end matches next clip start', () => {
    const track = makeTrack([
      { startTime: 0, duration: 3 }, // 0, 3
      { startTime: 3, duration: 2 }, // 3, 5 — 3 is a duplicate
    ])
    const times = getClipBoundaryTimes([track])
    expect(times).toEqual([0, 3, 5])
  })

  it('collects boundaries across multiple tracks', () => {
    const track1 = makeTrack([{ startTime: 0, duration: 1 }])
    const track2 = { ...makeTrack([{ startTime: 4, duration: 2 }]), id: 'track-2' }
    expect(getClipBoundaryTimes([track1, track2])).toEqual([0, 1, 4, 6])
  })
})

describe('snapTime', () => {
  it('returns original time when no snap times', () => {
    expect(snapTime(3.5, [], 0.1)).toBe(3.5)
  })

  it('returns original time when nothing is within threshold', () => {
    expect(snapTime(3.5, [1, 2, 5], 0.1)).toBe(3.5)
  })

  it('snaps to nearest time within threshold', () => {
    expect(snapTime(2.95, [3], 0.1)).toBe(3)
  })

  it('does not snap when exactly at threshold distance', () => {
    // dist === thresholdSec uses strict <, so exactly equal is NOT snapped
    expect(snapTime(2.9, [3], 0.1)).toBe(2.9)
  })

  it('snaps to the closest of multiple candidates', () => {
    expect(snapTime(4.96, [4, 5], 0.1)).toBe(5)
    expect(snapTime(4.04, [4, 5], 0.1)).toBe(4)
  })

  it('clamps result to >= 0', () => {
    expect(snapTime(-0.05, [0], SNAP_THRESHOLD_SEC)).toBe(0)
  })

  it('clamps raw time to >= 0 when no snap', () => {
    expect(snapTime(-1, [], 0.1)).toBe(0)
  })
})
