import { describe, it, expect, vi } from 'vitest'
import {
  buildCursorKeyframes,
  computeCursorPosition,
  renderCursorHighlight,
} from './cursorHighlightUtils'
import type { Effect } from '@/store/types'
import type { CursorPoint } from './recordingUtils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEffect(keyframes: Effect['keyframes'] = []): Effect {
  return {
    id: 'e1',
    type: 'cursor',
    params: { radius: 30, color: 'rgba(255,255,0,0.4)' },
    keyframes,
  }
}

// ---------------------------------------------------------------------------
// buildCursorKeyframes
// ---------------------------------------------------------------------------

describe('buildCursorKeyframes', () => {
  const points: CursorPoint[] = [
    { t: 0, x: 100, y: 200 },
    { t: 1, x: 300, y: 400 },
    { t: 2, x: 500, y: 600 },
  ]

  it('returns empty array when points is empty', () => {
    expect(buildCursorKeyframes([], 1920, 1080, 1920, 1080)).toHaveLength(0)
  })

  it('returns empty array when viewport dimensions are zero', () => {
    expect(buildCursorKeyframes(points, 0, 1080, 1920, 1080)).toHaveLength(0)
    expect(buildCursorKeyframes(points, 1920, 0, 1920, 1080)).toHaveLength(0)
  })

  it('produces two keyframes per point (one x, one y)', () => {
    const kfs = buildCursorKeyframes(points, 1920, 1080, 1920, 1080)
    expect(kfs).toHaveLength(6) // 3 points × 2 channels
  })

  it('assigns correct channel labels', () => {
    const kfs = buildCursorKeyframes(points, 1920, 1080, 1920, 1080)
    const xKfs = kfs.filter((k) => k.channel === 'x')
    const yKfs = kfs.filter((k) => k.channel === 'y')
    expect(xKfs).toHaveLength(3)
    expect(yKfs).toHaveLength(3)
  })

  it('preserves timestamps from CursorPoints', () => {
    const kfs = buildCursorKeyframes(points, 1920, 1080, 1920, 1080)
    const times = kfs.map((k) => k.time)
    expect(times).toContain(0)
    expect(times).toContain(1)
    expect(times).toContain(2)
  })

  it('maps viewport coords to project pixels (1:1 viewport = project)', () => {
    const kfs = buildCursorKeyframes(points, 1920, 1080, 1920, 1080)
    const xAt0 = kfs.find((k) => k.channel === 'x' && k.time === 0)
    const yAt0 = kfs.find((k) => k.channel === 'y' && k.time === 0)
    expect(xAt0?.value).toBe(100)
    expect(yAt0?.value).toBe(200)
  })

  it('scales viewport coords when viewport differs from project dimensions', () => {
    // viewport 960x540, project 1920x1080 → scale = 2
    const kfs = buildCursorKeyframes(points, 960, 540, 1920, 1080)
    const xAt0 = kfs.find((k) => k.channel === 'x' && k.time === 0)
    const yAt0 = kfs.find((k) => k.channel === 'y' && k.time === 0)
    expect(xAt0?.value).toBeCloseTo(200)
    expect(yAt0?.value).toBeCloseTo(400)
  })

  it('uses linear easing for all keyframes', () => {
    const kfs = buildCursorKeyframes(points, 1920, 1080, 1920, 1080)
    expect(kfs.every((k) => k.easing === 'linear')).toBe(true)
  })

  it('assigns unique ids to all keyframes', () => {
    const kfs = buildCursorKeyframes(points, 1920, 1080, 1920, 1080)
    const ids = kfs.map((k) => k.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// computeCursorPosition
// ---------------------------------------------------------------------------

describe('computeCursorPosition', () => {
  it('returns null when no keyframes are present', () => {
    expect(computeCursorPosition(makeEffect(), 0)).toBeNull()
  })

  it('returns null when only x keyframes are present', () => {
    const kfs = [
      { id: 'kx0', time: 0, value: 100, easing: 'linear' as const, channel: 'x' as const },
    ]
    expect(computeCursorPosition(makeEffect(kfs), 0)).toBeNull()
  })

  it('returns null when only y keyframes are present', () => {
    const kfs = [
      { id: 'ky0', time: 0, value: 200, easing: 'linear' as const, channel: 'y' as const },
    ]
    expect(computeCursorPosition(makeEffect(kfs), 0)).toBeNull()
  })

  it('returns correct position at keyframe time', () => {
    const kfs = [
      { id: 'kx0', time: 0, value: 100, easing: 'linear' as const, channel: 'x' as const },
      { id: 'ky0', time: 0, value: 200, easing: 'linear' as const, channel: 'y' as const },
    ]
    const pos = computeCursorPosition(makeEffect(kfs), 0)
    expect(pos).not.toBeNull()
    expect(pos!.x).toBeCloseTo(100)
    expect(pos!.y).toBeCloseTo(200)
  })

  it('interpolates between two keyframes', () => {
    const kfs = [
      { id: 'kx0', time: 0, value: 0, easing: 'linear' as const, channel: 'x' as const },
      { id: 'kx1', time: 2, value: 200, easing: 'linear' as const, channel: 'x' as const },
      { id: 'ky0', time: 0, value: 100, easing: 'linear' as const, channel: 'y' as const },
      { id: 'ky1', time: 2, value: 300, easing: 'linear' as const, channel: 'y' as const },
    ]
    const pos = computeCursorPosition(makeEffect(kfs), 1)
    expect(pos).not.toBeNull()
    expect(pos!.x).toBeCloseTo(100)
    expect(pos!.y).toBeCloseTo(200)
  })
})

// ---------------------------------------------------------------------------
// renderCursorHighlight
// ---------------------------------------------------------------------------

describe('renderCursorHighlight', () => {
  function makeCtx() {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D
  }

  it('calls arc with correct parameters', () => {
    const ctx = makeCtx()
    renderCursorHighlight(ctx, 100, 200, 30, 'rgba(255,255,0,0.4)')
    expect(ctx.arc).toHaveBeenCalledWith(100, 200, 30, 0, Math.PI * 2)
  })

  it('sets fillStyle before calling fill', () => {
    const ctx = makeCtx()
    renderCursorHighlight(ctx, 0, 0, 20, '#ff0000')
    expect(ctx.fillStyle).toBe('#ff0000')
    expect(ctx.fill).toHaveBeenCalled()
  })

  it('wraps draw calls in save/restore', () => {
    const ctx = makeCtx()
    const callOrder: string[] = []
    ctx.save = vi.fn(() => callOrder.push('save'))
    ctx.restore = vi.fn(() => callOrder.push('restore'))
    ctx.arc = vi.fn(() => callOrder.push('arc'))
    renderCursorHighlight(ctx, 0, 0, 10, 'red')
    expect(callOrder[0]).toBe('save')
    expect(callOrder[callOrder.length - 1]).toBe('restore')
  })
})
