import { describe, it, expect } from 'vitest'
import {
  findActiveVideoClip,
  sourceTimeForClip,
  projectDuration,
  formatTime,
} from '@/components/previewUtils'
import type { Track } from '@/store'

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    type: 'video',
    name: 'Video 1',
    muted: false,
    locked: false,
    volume: 1,
    clips: [],
    ...overrides,
  }
}

function makeClip(overrides = {}) {
  return {
    id: 'clip-1',
    trackId: 'track-1',
    sourceId: 'asset-1',
    startTime: 0,
    duration: 10,
    sourceIn: 0,
    sourceOut: 10,
    speed: 1,
    effects: [],
    ...overrides,
  }
}

describe('findActiveVideoClip', () => {
  it('returns null with no tracks', () => {
    expect(findActiveVideoClip([], 5)).toBeNull()
  })

  it('returns null when time is before any clip', () => {
    const clip = makeClip({ startTime: 5, duration: 5 })
    const track = makeTrack({ clips: [clip] })
    expect(findActiveVideoClip([track], 2)).toBeNull()
  })

  it('returns null when time is exactly at clip end (exclusive)', () => {
    const clip = makeClip({ startTime: 0, duration: 10 })
    const track = makeTrack({ clips: [clip] })
    expect(findActiveVideoClip([track], 10)).toBeNull()
  })

  it('returns clip when time is within clip range', () => {
    const clip = makeClip({ startTime: 0, duration: 10 })
    const track = makeTrack({ clips: [clip] })
    expect(findActiveVideoClip([track], 5)).toEqual(clip)
  })

  it('returns clip at startTime boundary (inclusive)', () => {
    const clip = makeClip({ startTime: 5, duration: 10 })
    const track = makeTrack({ clips: [clip] })
    expect(findActiveVideoClip([track], 5)).toEqual(clip)
  })

  it('skips muted tracks', () => {
    const clip = makeClip({ startTime: 0, duration: 10 })
    const track = makeTrack({ muted: true, clips: [clip] })
    expect(findActiveVideoClip([track], 5)).toBeNull()
  })

  it('skips non-video tracks', () => {
    const clip = makeClip({ startTime: 0, duration: 10 })
    const track = makeTrack({ type: 'audio', clips: [clip] })
    expect(findActiveVideoClip([track], 5)).toBeNull()
  })

  it('returns first matching video clip across tracks', () => {
    const clip1 = makeClip({ id: 'c1', startTime: 0, duration: 10 })
    const clip2 = makeClip({ id: 'c2', startTime: 0, duration: 10 })
    const track1 = makeTrack({ id: 'track-1', clips: [clip1] })
    const track2 = makeTrack({ id: 'track-2', clips: [clip2] })
    const result = findActiveVideoClip([track1, track2], 5)
    expect(result?.id).toBe('c1')
  })
})

describe('sourceTimeForClip', () => {
  it('returns sourceIn when at clip start', () => {
    const clip = makeClip({ startTime: 0, sourceIn: 2, speed: 1 })
    expect(sourceTimeForClip(clip, 0)).toBe(2)
  })

  it('adds timeline offset to sourceIn', () => {
    const clip = makeClip({ startTime: 5, sourceIn: 0, speed: 1 })
    expect(sourceTimeForClip(clip, 8)).toBe(3)
  })

  it('scales by speed', () => {
    const clip = makeClip({ startTime: 0, sourceIn: 0, speed: 2 })
    expect(sourceTimeForClip(clip, 3)).toBe(6)
  })

  it('handles sub-1x speed', () => {
    const clip = makeClip({ startTime: 0, sourceIn: 0, speed: 0.5 })
    expect(sourceTimeForClip(clip, 4)).toBe(2)
  })
})

describe('projectDuration', () => {
  it('returns 0 with no tracks', () => {
    expect(projectDuration([])).toBe(0)
  })

  it('returns 0 with tracks but no clips', () => {
    expect(projectDuration([makeTrack()])).toBe(0)
  })

  it('returns end time of last clip', () => {
    const clip = makeClip({ startTime: 5, duration: 10 })
    const track = makeTrack({ clips: [clip] })
    expect(projectDuration([track])).toBe(15)
  })

  it('returns max end time across multiple clips', () => {
    const clip1 = makeClip({ id: 'c1', startTime: 0, duration: 10 })
    const clip2 = makeClip({ id: 'c2', startTime: 20, duration: 5 })
    const track = makeTrack({ clips: [clip1, clip2] })
    expect(projectDuration([track])).toBe(25)
  })
})

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('00:00.00')
  })

  it('formats seconds', () => {
    expect(formatTime(30)).toBe('00:30.00')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(65)).toBe('01:05.00')
  })

  it('formats fractional seconds as hundredths', () => {
    expect(formatTime(1.5)).toBe('00:01.50')
  })

  it('pads single-digit values', () => {
    expect(formatTime(9.25)).toBe('00:09.25')
  })
})

describe('PreviewPanel exports', () => {
  it('exports a default component', async () => {
    const mod = await import('@/components/PreviewPanel')
    expect(typeof mod.default).toBe('function')
  })
})
