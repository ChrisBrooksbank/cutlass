import { describe, it, expect } from 'vitest'
import {
  formatKeyframeTime,
  sortKeyframesByTime,
  clampTime,
  getEffectDisplayName,
  EASING_OPTIONS,
} from './keyframeEditorUtils'
import type { Keyframe } from '@/store/types'

function kf(id: string, time: number, value = 0): Keyframe {
  return { id, time, value, easing: 'linear' }
}

describe('formatKeyframeTime', () => {
  it('formats zero', () => {
    expect(formatKeyframeTime(0)).toBe('0.00s')
  })

  it('formats a whole number', () => {
    expect(formatKeyframeTime(3)).toBe('3.00s')
  })

  it('formats fractional seconds to 2 decimal places', () => {
    expect(formatKeyframeTime(1.5)).toBe('1.50s')
    expect(formatKeyframeTime(2.123)).toBe('2.12s')
  })
})

describe('sortKeyframesByTime', () => {
  it('returns empty array unchanged', () => {
    expect(sortKeyframesByTime([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const frames = [kf('b', 3), kf('a', 1)]
    const original = [...frames]
    sortKeyframesByTime(frames)
    expect(frames).toEqual(original)
  })

  it('sorts keyframes ascending by time', () => {
    const frames = [kf('c', 5), kf('a', 1), kf('b', 3)]
    const sorted = sortKeyframesByTime(frames)
    expect(sorted.map((k) => k.time)).toEqual([1, 3, 5])
  })

  it('preserves order for equal times', () => {
    const frames = [kf('a', 2), kf('b', 2)]
    const sorted = sortKeyframesByTime(frames)
    expect(sorted).toHaveLength(2)
  })
})

describe('clampTime', () => {
  it('returns value unchanged when within range', () => {
    expect(clampTime(5, 0, 10)).toBe(5)
  })

  it('clamps to min when below range', () => {
    expect(clampTime(-1, 0, 10)).toBe(0)
  })

  it('clamps to max when above range', () => {
    expect(clampTime(15, 0, 10)).toBe(10)
  })

  it('handles exact boundary values', () => {
    expect(clampTime(0, 0, 10)).toBe(0)
    expect(clampTime(10, 0, 10)).toBe(10)
  })
})

describe('getEffectDisplayName', () => {
  it('returns known effect labels', () => {
    expect(getEffectDisplayName('zoom')).toBe('Zoom / Pan')
    expect(getEffectDisplayName('blur')).toBe('Blur / Redact')
    expect(getEffectDisplayName('cursor')).toBe('Cursor Highlight')
    expect(getEffectDisplayName('text')).toBe('Text Overlay')
    expect(getEffectDisplayName('crop')).toBe('Crop')
  })

  it('title-cases unknown effect types', () => {
    expect(getEffectDisplayName('custom-effect')).toBe('Custom Effect')
    expect(getEffectDisplayName('brightness')).toBe('Brightness')
  })
})

describe('EASING_OPTIONS', () => {
  it('contains all four easing types', () => {
    const values = EASING_OPTIONS.map((o) => o.value)
    expect(values).toContain('linear')
    expect(values).toContain('ease-in')
    expect(values).toContain('ease-out')
    expect(values).toContain('ease-in-out')
  })

  it('every option has a non-empty label', () => {
    for (const option of EASING_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0)
    }
  })
})
