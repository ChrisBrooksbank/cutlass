import { describe, it, expect } from 'vitest'
import {
  findTransitionAtTime,
  incomingSourceTime,
  outgoingOpacity,
  incomingOpacity,
  incomingClipPath,
  clampTransitionDuration,
  TRANSITION_DURATION_MIN,
  TRANSITION_DURATION_MAX,
} from './transitionUtils'
import type { ActiveTransition } from './transitionUtils'
import type { Clip, Track } from '@/store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    trackId: 'track-1',
    sourceId: 'asset-1',
    startTime: 0,
    duration: 5,
    sourceIn: 0,
    sourceOut: 5,
    speed: 1,
    effects: [],
    ...overrides,
  }
}

function makeTrack(clips: Clip[], overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    type: 'video',
    name: 'Video 1',
    muted: false,
    locked: false,
    volume: 1,
    noiseReduction: false,
    clips,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// findTransitionAtTime
// ---------------------------------------------------------------------------

describe('findTransitionAtTime', () => {
  it('returns null when no clips have transitionOut', () => {
    const clipA = makeClip({ id: 'a', startTime: 0, duration: 5 })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    const track = makeTrack([clipA, clipB])
    expect(findTransitionAtTime([track], 4)).toBeNull()
  })

  it('returns null when current time is before transition window', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'cross-dissolve', duration: 1 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    const track = makeTrack([clipA, clipB])
    // Transition window: [4, 5], current time 3 is before
    expect(findTransitionAtTime([track], 3)).toBeNull()
  })

  it('returns null when current time is at or after clip end', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'cross-dissolve', duration: 1 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    const track = makeTrack([clipA, clipB])
    // Transition window: [4, 5), time=5 is outside (clip ended)
    expect(findTransitionAtTime([track], 5)).toBeNull()
  })

  it('detects cross-dissolve transition at start of window (progress = 0)', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'cross-dissolve', duration: 1 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5, sourceIn: 0, speed: 1 })
    const track = makeTrack([clipA, clipB])
    const result = findTransitionAtTime([track], 4)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('cross-dissolve')
    expect(result!.progress).toBeCloseTo(0)
    expect(result!.outgoingClip.id).toBe('a')
    expect(result!.incomingClip.id).toBe('b')
  })

  it('detects cross-dissolve transition at midpoint (progress = 0.5)', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'cross-dissolve', duration: 2 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    const track = makeTrack([clipA, clipB])
    const result = findTransitionAtTime([track], 4) // midpoint of [3, 5]
    expect(result).not.toBeNull()
    expect(result!.progress).toBeCloseTo(0.5)
  })

  it('detects fade-to-black transition type', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'fade-to-black', duration: 1 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    const track = makeTrack([clipA, clipB])
    const result = findTransitionAtTime([track], 4.5)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('fade-to-black')
  })

  it('detects wipe-left transition type', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'wipe-left', duration: 0.5 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    const track = makeTrack([clipA, clipB])
    const result = findTransitionAtTime([track], 4.75)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('wipe-left')
  })

  it('returns null for muted tracks', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'cross-dissolve', duration: 1 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    const track = makeTrack([clipA, clipB], { muted: true })
    expect(findTransitionAtTime([track], 4.5)).toBeNull()
  })

  it('returns null for audio tracks', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'cross-dissolve', duration: 1 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    const track = makeTrack([clipA, clipB], { type: 'audio' })
    expect(findTransitionAtTime([track], 4.5)).toBeNull()
  })

  it('returns null when incoming clip does not immediately follow', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'cross-dissolve', duration: 1 },
    })
    // Gap between clips: clipB starts at 7, but clipA ends at 5
    const clipB = makeClip({ id: 'b', startTime: 7, duration: 5 })
    const track = makeTrack([clipA, clipB])
    expect(findTransitionAtTime([track], 4.5)).toBeNull()
  })

  it('handles clips provided out of order', () => {
    const clipA = makeClip({
      id: 'a',
      startTime: 0,
      duration: 5,
      transitionOut: { type: 'cross-dissolve', duration: 1 },
    })
    const clipB = makeClip({ id: 'b', startTime: 5, duration: 5 })
    // Provide clips in reverse order
    const track = makeTrack([clipB, clipA])
    const result = findTransitionAtTime([track], 4.5)
    expect(result).not.toBeNull()
    expect(result!.progress).toBeCloseTo(0.5)
  })
})

// ---------------------------------------------------------------------------
// incomingSourceTime
// ---------------------------------------------------------------------------

describe('incomingSourceTime', () => {
  it('returns sourceIn at the start of the transition (progress=0)', () => {
    const incomingClip = makeClip({ id: 'b', startTime: 5, duration: 5, sourceIn: 2, speed: 1 })
    const transition: ActiveTransition = {
      outgoingClip: makeClip({ id: 'a' }),
      incomingClip,
      type: 'cross-dissolve',
      duration: 1,
      progress: 0,
      transitionStart: 4,
    }
    expect(incomingSourceTime(transition, 4)).toBeCloseTo(2)
  })

  it('advances source time proportionally during transition', () => {
    const incomingClip = makeClip({ id: 'b', startTime: 5, duration: 5, sourceIn: 0, speed: 1 })
    const transition: ActiveTransition = {
      outgoingClip: makeClip({ id: 'a' }),
      incomingClip,
      type: 'cross-dissolve',
      duration: 2,
      progress: 0.5,
      transitionStart: 3,
    }
    // At time 4 (elapsed=1), speed=1: sourceIn + 1 = 1
    expect(incomingSourceTime(transition, 4)).toBeCloseTo(1)
  })

  it('respects clip speed', () => {
    const incomingClip = makeClip({ id: 'b', startTime: 5, duration: 5, sourceIn: 0, speed: 2 })
    const transition: ActiveTransition = {
      outgoingClip: makeClip({ id: 'a' }),
      incomingClip,
      type: 'cross-dissolve',
      duration: 2,
      progress: 0.5,
      transitionStart: 3,
    }
    // At time 4 (elapsed=1), speed=2: sourceIn + 1*2 = 2
    expect(incomingSourceTime(transition, 4)).toBeCloseTo(2)
  })
})

// ---------------------------------------------------------------------------
// outgoingOpacity
// ---------------------------------------------------------------------------

describe('outgoingOpacity', () => {
  describe('cross-dissolve', () => {
    it('is 1 at progress=0', () => {
      expect(outgoingOpacity('cross-dissolve', 0)).toBeCloseTo(1)
    })
    it('is 0.5 at progress=0.5', () => {
      expect(outgoingOpacity('cross-dissolve', 0.5)).toBeCloseTo(0.5)
    })
    it('is 0 at progress=1', () => {
      expect(outgoingOpacity('cross-dissolve', 1)).toBeCloseTo(0)
    })
  })

  describe('fade-to-black', () => {
    it('is 1 at progress=0', () => {
      expect(outgoingOpacity('fade-to-black', 0)).toBeCloseTo(1)
    })
    it('is 0 at progress=0.5', () => {
      expect(outgoingOpacity('fade-to-black', 0.5)).toBeCloseTo(0)
    })
    it('is 0 at progress=1', () => {
      expect(outgoingOpacity('fade-to-black', 1)).toBeCloseTo(0)
    })
  })

  describe('wipe-left', () => {
    it('is always 1', () => {
      expect(outgoingOpacity('wipe-left', 0)).toBe(1)
      expect(outgoingOpacity('wipe-left', 0.5)).toBe(1)
      expect(outgoingOpacity('wipe-left', 1)).toBe(1)
    })
  })
})

// ---------------------------------------------------------------------------
// incomingOpacity
// ---------------------------------------------------------------------------

describe('incomingOpacity', () => {
  describe('cross-dissolve', () => {
    it('is 0 at progress=0', () => {
      expect(incomingOpacity('cross-dissolve', 0)).toBeCloseTo(0)
    })
    it('is 0.5 at progress=0.5', () => {
      expect(incomingOpacity('cross-dissolve', 0.5)).toBeCloseTo(0.5)
    })
    it('is 1 at progress=1', () => {
      expect(incomingOpacity('cross-dissolve', 1)).toBeCloseTo(1)
    })
  })

  describe('fade-to-black', () => {
    it('is 0 in first half', () => {
      expect(incomingOpacity('fade-to-black', 0)).toBeCloseTo(0)
      expect(incomingOpacity('fade-to-black', 0.4)).toBeCloseTo(0)
    })
    it('is 0 at exactly progress=0.5', () => {
      expect(incomingOpacity('fade-to-black', 0.5)).toBeCloseTo(0)
    })
    it('is 1 at progress=1', () => {
      expect(incomingOpacity('fade-to-black', 1)).toBeCloseTo(1)
    })
  })

  describe('wipe-left', () => {
    it('is always 1', () => {
      expect(incomingOpacity('wipe-left', 0)).toBe(1)
      expect(incomingOpacity('wipe-left', 1)).toBe(1)
    })
  })
})

// ---------------------------------------------------------------------------
// incomingClipPath
// ---------------------------------------------------------------------------

describe('incomingClipPath', () => {
  it('returns null for cross-dissolve', () => {
    expect(incomingClipPath('cross-dissolve', 0.5)).toBeNull()
  })
  it('returns null for fade-to-black', () => {
    expect(incomingClipPath('fade-to-black', 0.5)).toBeNull()
  })
  it('returns inset at 0% when progress=1 (fully revealed)', () => {
    const result = incomingClipPath('wipe-left', 1)
    expect(result).toBe('inset(0 0.00% 0 0)')
  })
  it('returns inset at 100% when progress=0 (fully hidden)', () => {
    const result = incomingClipPath('wipe-left', 0)
    expect(result).toBe('inset(0 100.00% 0 0)')
  })
  it('returns inset at 50% when progress=0.5 (half revealed)', () => {
    const result = incomingClipPath('wipe-left', 0.5)
    expect(result).toBe('inset(0 50.00% 0 0)')
  })
})

// ---------------------------------------------------------------------------
// clampTransitionDuration
// ---------------------------------------------------------------------------

describe('clampTransitionDuration', () => {
  it('clamps below minimum', () => {
    expect(clampTransitionDuration(0)).toBe(TRANSITION_DURATION_MIN)
    expect(clampTransitionDuration(-1)).toBe(TRANSITION_DURATION_MIN)
  })
  it('clamps above maximum', () => {
    expect(clampTransitionDuration(10)).toBe(TRANSITION_DURATION_MAX)
  })
  it('passes through valid values', () => {
    expect(clampTransitionDuration(1.0)).toBeCloseTo(1.0)
    expect(clampTransitionDuration(2.5)).toBeCloseTo(2.5)
  })
})
