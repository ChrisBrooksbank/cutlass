import { describe, it, expect } from 'vitest'
import {
  formatSpeed,
  clampSpeed,
  durationAtSpeed,
  SPEED_PRESETS,
  SPEED_MIN,
  SPEED_MAX,
} from '@/components/speedUtils'

describe('formatSpeed', () => {
  it('formats 1x speed', () => {
    expect(formatSpeed(1)).toBe('1x')
  })

  it('formats 0.5x speed', () => {
    expect(formatSpeed(0.5)).toBe('0.5x')
  })

  it('formats 2x speed', () => {
    expect(formatSpeed(2)).toBe('2x')
  })

  it('formats 0.25x speed', () => {
    expect(formatSpeed(0.25)).toBe('0.25x')
  })

  it('formats 1.5x speed', () => {
    expect(formatSpeed(1.5)).toBe('1.5x')
  })
})

describe('clampSpeed', () => {
  it('returns value within range unchanged', () => {
    expect(clampSpeed(1)).toBe(1)
    expect(clampSpeed(2)).toBe(2)
  })

  it('clamps below minimum to SPEED_MIN', () => {
    expect(clampSpeed(0)).toBe(SPEED_MIN)
    expect(clampSpeed(-1)).toBe(SPEED_MIN)
  })

  it('clamps above maximum to SPEED_MAX', () => {
    expect(clampSpeed(5)).toBe(SPEED_MAX)
    expect(clampSpeed(100)).toBe(SPEED_MAX)
  })

  it('returns exact boundary values', () => {
    expect(clampSpeed(SPEED_MIN)).toBe(SPEED_MIN)
    expect(clampSpeed(SPEED_MAX)).toBe(SPEED_MAX)
  })
})

describe('durationAtSpeed', () => {
  it('computes duration for 1x speed', () => {
    expect(durationAtSpeed(0, 10, 1)).toBe(10)
  })

  it('halves duration at 2x speed', () => {
    expect(durationAtSpeed(0, 10, 2)).toBe(5)
  })

  it('doubles duration at 0.5x speed', () => {
    expect(durationAtSpeed(0, 10, 0.5)).toBe(20)
  })

  it('accounts for sourceIn offset', () => {
    expect(durationAtSpeed(2, 8, 1)).toBe(6)
  })

  it('clamps speed before computing', () => {
    // speed 0 is clamped to 0.25
    expect(durationAtSpeed(0, 10, 0)).toBe(durationAtSpeed(0, 10, 0.25))
  })
})

describe('SPEED_PRESETS', () => {
  it('contains standard speed values including 1x', () => {
    expect(SPEED_PRESETS).toContain(1)
  })

  it('contains minimum and maximum speeds', () => {
    expect(SPEED_PRESETS).toContain(SPEED_MIN)
    expect(SPEED_PRESETS).toContain(SPEED_MAX)
  })

  it('is sorted in ascending order', () => {
    for (let i = 1; i < SPEED_PRESETS.length; i++) {
      expect(SPEED_PRESETS[i]).toBeGreaterThan(SPEED_PRESETS[i - 1])
    }
  })
})
