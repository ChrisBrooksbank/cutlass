import { describe, it, expect } from 'vitest'
import { applyEasing, interpolateKeyframes } from './keyframeUtils'
import type { Keyframe } from '@/store/types'

// ---------------------------------------------------------------------------
// applyEasing
// ---------------------------------------------------------------------------

describe('applyEasing', () => {
  it('linear returns t unchanged', () => {
    expect(applyEasing(0, 'linear')).toBe(0)
    expect(applyEasing(0.5, 'linear')).toBe(0.5)
    expect(applyEasing(1, 'linear')).toBe(1)
  })

  it('ease-in accelerates (output < t for t ∈ (0,1))', () => {
    expect(applyEasing(0, 'ease-in')).toBe(0)
    expect(applyEasing(1, 'ease-in')).toBe(1)
    expect(applyEasing(0.5, 'ease-in')).toBe(0.25) // t²
  })

  it('ease-out decelerates (output > t for t ∈ (0,1))', () => {
    expect(applyEasing(0, 'ease-out')).toBe(0)
    expect(applyEasing(1, 'ease-out')).toBe(1)
    expect(applyEasing(0.5, 'ease-out')).toBe(0.75) // t*(2-t)
  })

  it('ease-in-out is symmetric around 0.5', () => {
    expect(applyEasing(0, 'ease-in-out')).toBe(0)
    expect(applyEasing(1, 'ease-in-out')).toBe(1)
    expect(applyEasing(0.5, 'ease-in-out')).toBeCloseTo(0.5)
    // For t<0.5: output should be < 0.5 (ease-in portion)
    expect(applyEasing(0.25, 'ease-in-out')).toBeLessThan(0.25)
    // For t>0.5: output should be > 0.5 (ease-out portion)
    expect(applyEasing(0.75, 'ease-in-out')).toBeGreaterThan(0.75)
  })
})

// ---------------------------------------------------------------------------
// interpolateKeyframes
// ---------------------------------------------------------------------------

function kf(time: number, value: number, easing: Keyframe['easing'] = 'linear'): Keyframe {
  return { id: crypto.randomUUID(), time, value, easing }
}

describe('interpolateKeyframes', () => {
  it('returns null for empty keyframes', () => {
    expect(interpolateKeyframes([], 1)).toBeNull()
  })

  it('returns the single keyframe value at any time', () => {
    const frames = [kf(2, 10)]
    expect(interpolateKeyframes(frames, 0)).toBe(10)
    expect(interpolateKeyframes(frames, 2)).toBe(10)
    expect(interpolateKeyframes(frames, 5)).toBe(10)
  })

  it('clamps to first value before first keyframe', () => {
    const frames = [kf(1, 5), kf(3, 15)]
    expect(interpolateKeyframes(frames, 0)).toBe(5)
    expect(interpolateKeyframes(frames, 1)).toBe(5)
  })

  it('clamps to last value after last keyframe', () => {
    const frames = [kf(1, 5), kf(3, 15)]
    expect(interpolateKeyframes(frames, 3)).toBe(15)
    expect(interpolateKeyframes(frames, 5)).toBe(15)
  })

  it('linearly interpolates between two keyframes', () => {
    const frames = [kf(0, 0, 'linear'), kf(10, 100, 'linear')]
    expect(interpolateKeyframes(frames, 5)).toBeCloseTo(50)
    expect(interpolateKeyframes(frames, 2)).toBeCloseTo(20)
    expect(interpolateKeyframes(frames, 8)).toBeCloseTo(80)
  })

  it('applies ease-in between keyframes', () => {
    const frames = [kf(0, 0, 'ease-in'), kf(10, 100, 'linear')]
    // t = 0.5 → easedT = 0.25 → value = 25
    expect(interpolateKeyframes(frames, 5)).toBeCloseTo(25)
  })

  it('applies ease-out between keyframes', () => {
    const frames = [kf(0, 0, 'ease-out'), kf(10, 100, 'linear')]
    // t = 0.5 → easedT = 0.75 → value = 75
    expect(interpolateKeyframes(frames, 5)).toBeCloseTo(75)
  })

  it('applies ease-in-out between keyframes', () => {
    const frames = [kf(0, 0, 'ease-in-out'), kf(10, 100, 'linear')]
    // midpoint should be exactly 50
    expect(interpolateKeyframes(frames, 5)).toBeCloseTo(50)
  })

  it('handles unsorted keyframe input', () => {
    const frames = [kf(10, 100, 'linear'), kf(0, 0, 'linear')]
    expect(interpolateKeyframes(frames, 5)).toBeCloseTo(50)
  })

  it('uses from-keyframe easing for each segment', () => {
    // segment 0→5 uses ease-in, segment 5→10 uses linear
    const frames = [kf(0, 0, 'ease-in'), kf(5, 50, 'linear'), kf(10, 100, 'linear')]
    // In second segment t=0.5: linear → value = 75
    expect(interpolateKeyframes(frames, 7.5)).toBeCloseTo(75)
  })
})
