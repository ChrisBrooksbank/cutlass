import { describe, it, expect } from 'vitest'
import {
  CLIP_COLOR,
  CLIP_COLOR_SELECTED,
  clipCanvasX,
  clipCanvasY,
  clipCanvasWidth,
  canvasXToStartTime,
  canvasYToTrackIndex,
} from './clipBlockUtils'
import { TRACK_HEIGHT, TRACK_HEADER_WIDTH } from './timelineUtils'

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
