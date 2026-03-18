import { describe, it, expect, vi } from 'vitest'
import { computeBlurRegion, renderBlurRegion } from './blurUtils'
import type { Effect, Keyframe } from '@/store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEffect(params: Record<string, unknown> = {}, keyframes: Keyframe[] = []): Effect {
  return { id: 'e1', type: 'blur', params, keyframes }
}

function kf(
  id: string,
  channel: string,
  time: number,
  value: number,
  easing: Keyframe['easing'] = 'linear',
): Keyframe {
  return { id, time, value, easing, channel } as Keyframe & { channel: string }
}

function makeCtx(canvas?: HTMLCanvasElement | null): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    filter: '',
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    canvas: canvas ?? undefined,
  } as unknown as CanvasRenderingContext2D
}

// ---------------------------------------------------------------------------
// computeBlurRegion
// ---------------------------------------------------------------------------

describe('computeBlurRegion', () => {
  it('returns defaults when no params and no keyframes', () => {
    const r = computeBlurRegion(makeEffect(), 0)
    expect(r).toEqual({ x: 0, y: 0, width: 100, height: 60, strength: 10 })
  })

  it('reads static values from effect.params when no keyframes', () => {
    const r = computeBlurRegion(
      makeEffect({ x: 50, y: 100, width: 200, height: 80, strength: 20 }),
      0,
    )
    expect(r).toEqual({ x: 50, y: 100, width: 200, height: 80, strength: 20 })
  })

  it('interpolates x from keyframes', () => {
    const effect = makeEffect({ x: 0 }, [kf('k1', 'x', 0, 0), kf('k2', 'x', 2, 200)])
    const r = computeBlurRegion(effect, 1)
    expect(r.x).toBeCloseTo(100)
  })

  it('interpolates y from keyframes', () => {
    const effect = makeEffect({ y: 0 }, [kf('k1', 'y', 0, 0), kf('k2', 'y', 4, 400)])
    const r = computeBlurRegion(effect, 2)
    expect(r.y).toBeCloseTo(200)
  })

  it('interpolates width from keyframes', () => {
    const effect = makeEffect({}, [kf('k1', 'width', 0, 100), kf('k2', 'width', 2, 300)])
    const r = computeBlurRegion(effect, 1)
    expect(r.width).toBeCloseTo(200)
  })

  it('interpolates height from keyframes', () => {
    const effect = makeEffect({}, [kf('k1', 'height', 0, 60), kf('k2', 'height', 2, 120)])
    const r = computeBlurRegion(effect, 1)
    expect(r.height).toBeCloseTo(90)
  })

  it('strength is always read from params (not keyframed)', () => {
    const effect = makeEffect({ strength: 25 }, [])
    const r = computeBlurRegion(effect, 5)
    expect(r.strength).toBe(25)
  })

  it('falls back to default strength when not in params', () => {
    const r = computeBlurRegion(makeEffect(), 0)
    expect(r.strength).toBe(10)
  })

  it('clamps to first keyframe value before start time', () => {
    const effect = makeEffect({}, [kf('k1', 'x', 1, 50), kf('k2', 'x', 3, 100)])
    const r = computeBlurRegion(effect, 0)
    expect(r.x).toBe(50)
  })

  it('clamps to last keyframe value after end time', () => {
    const effect = makeEffect({}, [kf('k1', 'x', 0, 0), kf('k2', 'x', 2, 100)])
    const r = computeBlurRegion(effect, 10)
    expect(r.x).toBe(100)
  })

  it('mixes keyframed and static channels independently', () => {
    const effect = makeEffect({ width: 200, height: 80, strength: 15 }, [
      kf('k1', 'x', 0, 0),
      kf('k2', 'x', 2, 100),
    ])
    const r = computeBlurRegion(effect, 1)
    expect(r.x).toBeCloseTo(50)
    expect(r.y).toBe(0) // default
    expect(r.width).toBe(200) // from params
    expect(r.height).toBe(80) // from params
    expect(r.strength).toBe(15) // from params
  })

  it('all four position/size channels keyframed independently', () => {
    const effect = makeEffect({ strength: 5 }, [
      kf('a', 'x', 0, 0),
      kf('b', 'x', 2, 100),
      kf('c', 'y', 0, 0),
      kf('d', 'y', 2, 50),
      kf('e', 'width', 0, 100),
      kf('f', 'width', 2, 200),
      kf('g', 'height', 0, 60),
      kf('h', 'height', 2, 120),
    ])
    const r = computeBlurRegion(effect, 1)
    expect(r.x).toBeCloseTo(50)
    expect(r.y).toBeCloseTo(25)
    expect(r.width).toBeCloseTo(150)
    expect(r.height).toBeCloseTo(90)
    expect(r.strength).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// renderBlurRegion
// ---------------------------------------------------------------------------

describe('renderBlurRegion', () => {
  it('does not throw when called with a stub context (no canvas)', () => {
    const ctx = makeCtx(null)
    expect(() =>
      renderBlurRegion(ctx, { x: 10, y: 20, width: 100, height: 60, strength: 10 }),
    ).not.toThrow()
  })

  it('falls back to fillRect overlay when canvas is unavailable', () => {
    const ctx = makeCtx(null)
    renderBlurRegion(ctx, { x: 10, y: 20, width: 100, height: 60, strength: 10 })
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 100, 60)
    expect(ctx.restore).toHaveBeenCalled()
  })

  it('skips rendering when width is 0', () => {
    const ctx = makeCtx(null)
    renderBlurRegion(ctx, { x: 0, y: 0, width: 0, height: 60, strength: 10 })
    expect(ctx.save).not.toHaveBeenCalled()
    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  it('skips rendering when height is 0', () => {
    const ctx = makeCtx(null)
    renderBlurRegion(ctx, { x: 0, y: 0, width: 100, height: 0, strength: 10 })
    expect(ctx.save).not.toHaveBeenCalled()
    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  it('skips rendering when width is negative', () => {
    const ctx = makeCtx(null)
    renderBlurRegion(ctx, { x: 0, y: 0, width: -10, height: 60, strength: 10 })
    expect(ctx.fillRect).not.toHaveBeenCalled()
  })
})
