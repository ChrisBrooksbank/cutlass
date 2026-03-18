import { describe, it, expect } from 'vitest'
import {
  CLIP_COLOR,
  CLIP_COLOR_SELECTED,
  MIN_CLIP_DURATION,
  clipCanvasX,
  clipCanvasY,
  clipCanvasWidth,
  canvasXToStartTime,
  canvasYToTrackIndex,
  computeTrimLeft,
  computeTrimRight,
  getSnapTargetsExcluding,
} from './clipBlockUtils'
import { TRACK_HEIGHT, TRACK_HEADER_WIDTH } from './timelineUtils'
import type { Track } from '@/store/types'

function makeTrack(
  id: string,
  clips: { id: string; startTime: number; duration: number }[],
): Track {
  return {
    id,
    type: 'video',
    name: id,
    muted: false,
    locked: false,
    volume: 1,
    clips: clips.map((c) => ({
      id: c.id,
      trackId: id,
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

describe('CLIP_COLOR', () => {
  it('has entries for all track types', () => {
    expect(CLIP_COLOR['video']).toBeDefined()
    expect(CLIP_COLOR['audio']).toBeDefined()
    expect(CLIP_COLOR['annotation']).toBeDefined()
  })
})

describe('CLIP_COLOR_SELECTED', () => {
  it('has entries for all track types', () => {
    expect(CLIP_COLOR_SELECTED['video']).toBeDefined()
    expect(CLIP_COLOR_SELECTED['audio']).toBeDefined()
    expect(CLIP_COLOR_SELECTED['annotation']).toBeDefined()
  })

  it('is different from normal color for each track type', () => {
    expect(CLIP_COLOR_SELECTED['video']).not.toBe(CLIP_COLOR['video'])
    expect(CLIP_COLOR_SELECTED['audio']).not.toBe(CLIP_COLOR['audio'])
    expect(CLIP_COLOR_SELECTED['annotation']).not.toBe(CLIP_COLOR['annotation'])
  })
})

describe('clipCanvasX', () => {
  it('returns TRACK_HEADER_WIDTH when startTime=0, scrollLeft=0', () => {
    expect(clipCanvasX(0, 100, 0)).toBe(TRACK_HEADER_WIDTH)
  })

  it('offsets by startTime * pixelsPerSecond', () => {
    // 5s at 100pps = 500px + header
    expect(clipCanvasX(5, 100, 0)).toBe(TRACK_HEADER_WIDTH + 500)
  })

  it('subtracts scrollLeft from the result', () => {
    expect(clipCanvasX(0, 100, 200)).toBe(TRACK_HEADER_WIDTH - 200)
  })

  it('combines startTime and scrollLeft correctly', () => {
    // 3s at 100pps = 300px + header - 50 scroll
    expect(clipCanvasX(3, 100, 50)).toBe(TRACK_HEADER_WIDTH + 300 - 50)
  })
})

describe('clipCanvasY', () => {
  it('returns 0 for track index 0', () => {
    expect(clipCanvasY(0)).toBe(0)
  })

  it('returns TRACK_HEIGHT for track index 1', () => {
    expect(clipCanvasY(1)).toBe(TRACK_HEIGHT)
  })

  it('returns index * TRACK_HEIGHT', () => {
    expect(clipCanvasY(4)).toBe(4 * TRACK_HEIGHT)
  })
})

describe('clipCanvasWidth', () => {
  it('converts duration to pixels', () => {
    expect(clipCanvasWidth(2, 100)).toBe(200)
  })

  it('returns at least 1 pixel for very short clips', () => {
    expect(clipCanvasWidth(0.001, 100)).toBe(1)
  })

  it('returns at least 1 for zero duration', () => {
    expect(clipCanvasWidth(0, 100)).toBe(1)
  })
})

describe('canvasXToStartTime', () => {
  it('returns 0 when canvasX equals TRACK_HEADER_WIDTH and scrollLeft=0', () => {
    expect(canvasXToStartTime(TRACK_HEADER_WIDTH, 100, 0)).toBe(0)
  })

  it('is the inverse of clipCanvasX', () => {
    const pps = 100
    const scrollLeft = 50
    const startTime = 3
    const x = clipCanvasX(startTime, pps, scrollLeft)
    expect(canvasXToStartTime(x, pps, scrollLeft)).toBeCloseTo(startTime)
  })

  it('clamps to 0 when canvasX is before the header', () => {
    expect(canvasXToStartTime(0, 100, 0)).toBe(0)
  })

  it('accounts for scrollLeft when converting back', () => {
    // x = header + 500 - 200 = header + 300; with scroll=200 → time = (300+200)/100=5
    const pps = 100
    const scrollLeft = 200
    const x = TRACK_HEADER_WIDTH + 300
    expect(canvasXToStartTime(x, pps, scrollLeft)).toBeCloseTo(5)
  })
})

describe('canvasYToTrackIndex', () => {
  it('returns 0 for y=0', () => {
    expect(canvasYToTrackIndex(0, 3)).toBe(0)
  })

  it('returns 0 for y within first half of first track', () => {
    expect(canvasYToTrackIndex(TRACK_HEIGHT / 4, 3)).toBe(0)
  })

  it('returns 1 when y is just past the midpoint of the first track', () => {
    // floor((y + TRACK_HEIGHT/2) / TRACK_HEIGHT) with y = TRACK_HEIGHT/2 + 1
    // floor((TRACK_HEIGHT/2 + 1 + TRACK_HEIGHT/2) / TRACK_HEIGHT) = floor((TRACK_HEIGHT+1)/TRACK_HEIGHT) = 1
    expect(canvasYToTrackIndex(TRACK_HEIGHT / 2 + 1, 3)).toBe(1)
  })

  it('clamps to trackCount - 1 at the bottom', () => {
    expect(canvasYToTrackIndex(9999, 3)).toBe(2)
  })

  it('clamps to 0 for negative y', () => {
    expect(canvasYToTrackIndex(-100, 3)).toBe(0)
  })

  it('handles single track', () => {
    expect(canvasYToTrackIndex(0, 1)).toBe(0)
    expect(canvasYToTrackIndex(9999, 1)).toBe(0)
  })
})

describe('computeTrimLeft', () => {
  it('trims from the left, increasing startTime and decreasing duration', () => {
    const result = computeTrimLeft(2, 5, 0, 1)
    expect(result.startTime).toBeCloseTo(3)
    expect(result.duration).toBeCloseTo(4)
  })

  it('extends left (negative delta), decreasing startTime and increasing duration', () => {
    const result = computeTrimLeft(2, 5, 2, -1)
    expect(result.startTime).toBeCloseTo(1)
    expect(result.duration).toBeCloseTo(6)
  })

  it('clamps startTime to 0 when extending before timeline start', () => {
    const result = computeTrimLeft(1, 5, 5, -10)
    expect(result.startTime).toBe(0)
    expect(result.duration).toBeCloseTo(6)
  })

  it('clamps duration to MIN_CLIP_DURATION when trimming too far', () => {
    const result = computeTrimLeft(0, 3, 0, 100)
    expect(result.duration).toBeCloseTo(MIN_CLIP_DURATION)
  })

  it('clamps extension to not go before source start (sourceIn would go negative)', () => {
    // sourceIn=0.5, extending left by 2s would go to sourceIn=-1.5 — should clamp to -0.5s delta
    const result = computeTrimLeft(2, 5, 0.5, -2)
    // clamped delta = -0.5, so startTime = 2 - 0.5 = 1.5
    expect(result.startTime).toBeCloseTo(1.5)
    expect(result.duration).toBeCloseTo(5.5)
  })

  it('returns original values when delta is 0', () => {
    const result = computeTrimLeft(3, 4, 1, 0)
    expect(result.startTime).toBeCloseTo(3)
    expect(result.duration).toBeCloseTo(4)
  })
})

describe('computeTrimRight', () => {
  it('extends right (positive delta), increasing duration', () => {
    const result = computeTrimRight(5, 8, 2, 15)
    expect(result.duration).toBeCloseTo(7)
  })

  it('trims right (negative delta), decreasing duration', () => {
    const result = computeTrimRight(5, 8, -2, 15)
    expect(result.duration).toBeCloseTo(3)
  })

  it('clamps duration to MIN_CLIP_DURATION when trimming too far', () => {
    const result = computeTrimRight(3, 5, -100, 20)
    expect(result.duration).toBeCloseTo(MIN_CLIP_DURATION)
  })

  it('clamps extension to not exceed media duration', () => {
    // mediaDuration=10, sourceOut=8, can extend at most 2s
    const result = computeTrimRight(5, 8, 5, 10)
    expect(result.duration).toBeCloseTo(7) // 5 + 2
  })

  it('allows full extension when mediaDuration is Infinity', () => {
    const result = computeTrimRight(5, 8, 100, Infinity)
    expect(result.duration).toBeCloseTo(105)
  })

  it('returns original duration when delta is 0', () => {
    const result = computeTrimRight(4, 6, 0, 20)
    expect(result.duration).toBeCloseTo(4)
  })
})

describe('getSnapTargetsExcluding', () => {
  it('always includes the playhead time', () => {
    const targets = getSnapTargetsExcluding([], 'any', 3.5)
    expect(targets).toContain(3.5)
  })

  it('returns only playhead when no tracks', () => {
    expect(getSnapTargetsExcluding([], 'x', 2)).toEqual([2])
  })

  it('includes clip start and end times from other clips', () => {
    const track = makeTrack('t1', [{ id: 'c1', startTime: 1, duration: 3 }])
    const targets = getSnapTargetsExcluding([track], 'other', 0)
    expect(targets).toContain(1) // start
    expect(targets).toContain(4) // end (1+3)
  })

  it('excludes the specified clip boundaries', () => {
    const track = makeTrack('t1', [
      { id: 'c1', startTime: 1, duration: 3 },
      { id: 'c2', startTime: 5, duration: 2 },
    ])
    const targets = getSnapTargetsExcluding([track], 'c1', 0)
    expect(targets).not.toContain(1)
    expect(targets).not.toContain(4)
    expect(targets).toContain(5)
    expect(targets).toContain(7)
  })

  it('returns targets sorted ascending', () => {
    const track = makeTrack('t1', [
      { id: 'c1', startTime: 5, duration: 2 },
      { id: 'c2', startTime: 1, duration: 3 },
    ])
    const targets = getSnapTargetsExcluding([track], 'none', 0)
    expect(targets).toEqual([0, 1, 4, 5, 7])
  })

  it('deduplicates when playhead coincides with a clip boundary', () => {
    const track = makeTrack('t1', [{ id: 'c1', startTime: 2, duration: 3 }])
    const targets = getSnapTargetsExcluding([track], 'none', 2)
    // playhead=2 and clip start=2 → should appear once
    expect(targets.filter((t) => t === 2)).toHaveLength(1)
  })

  it('collects boundaries across multiple tracks', () => {
    const t1 = makeTrack('t1', [{ id: 'c1', startTime: 0, duration: 2 }])
    const t2 = makeTrack('t2', [{ id: 'c2', startTime: 4, duration: 1 }])
    const targets = getSnapTargetsExcluding([t1, t2], 'none', 10)
    expect(targets).toContain(0)
    expect(targets).toContain(2)
    expect(targets).toContain(4)
    expect(targets).toContain(5)
    expect(targets).toContain(10)
  })
})
