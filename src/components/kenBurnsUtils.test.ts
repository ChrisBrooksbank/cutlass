import { describe, it, expect, vi } from 'vitest'
import { computeKenBurnsTransform, applyKenBurnsTransform } from './kenBurnsUtils'
import type { Effect, Keyframe } from '@/store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEffect(params: Record<string, unknown> = {}, keyframes: Keyframe[] = []): Effect {
  return { id: 'e1', type: 'zoom', params, keyframes }
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

// ---------------------------------------------------------------------------
// computeKenBurnsTransform
// ---------------------------------------------------------------------------

describe('computeKenBurnsTransform', () => {
  it('returns identity transform when no params and no keyframes', () => {
    const t = computeKenBurnsTransform(makeEffect(), 0)
    expect(t).toEqual({ scaleX: 1, scaleY: 1, x: 0, y: 0 })
  })

  it('reads static values from effect.params when no keyframes', () => {
    const t = computeKenBurnsTransform(makeEffect({ scaleX: 2, scaleY: 1.5, x: 10, y: -5 }), 0)
    expect(t).toEqual({ scaleX: 2, scaleY: 1.5, x: 10, y: -5 })
  })

  it('uses scaleX keyframes and falls back to params for other channels', () => {
    const effect = makeEffect({ scaleX: 1, scaleY: 2, x: 0, y: 0 }, [
      kf('k1', 'scaleX', 0, 1),
      kf('k2', 'scaleX', 2, 3),
    ])
    const t = computeKenBurnsTransform(effect, 1)
    expect(t.scaleX).toBeCloseTo(2)
    expect(t.scaleY).toBe(2) // from params
    expect(t.x).toBe(0)
    expect(t.y).toBe(0)
  })

  it('uses scaleY keyframes independently of scaleX', () => {
    const effect = makeEffect({}, [kf('k1', 'scaleY', 0, 1), kf('k2', 'scaleY', 4, 2)])
    const t = computeKenBurnsTransform(effect, 2)
    expect(t.scaleX).toBe(1) // default
    expect(t.scaleY).toBeCloseTo(1.5)
  })

  it('interpolates x and y pan channels', () => {
    const effect = makeEffect({}, [
      kf('k1', 'x', 0, 0),
      kf('k2', 'x', 2, 100),
      kf('k3', 'y', 0, 0),
      kf('k4', 'y', 2, -50),
    ])
    const t = computeKenBurnsTransform(effect, 1)
    expect(t.x).toBeCloseTo(50)
    expect(t.y).toBeCloseTo(-25)
  })

  it('clamps to first keyframe value before start time', () => {
    const effect = makeEffect({}, [kf('k1', 'scaleX', 1, 2), kf('k2', 'scaleX', 3, 4)])
    const t = computeKenBurnsTransform(effect, 0)
    expect(t.scaleX).toBe(2)
  })

  it('clamps to last keyframe value after end time', () => {
    const effect = makeEffect({}, [kf('k1', 'scaleX', 0, 1), kf('k2', 'scaleX', 2, 3)])
    const t = computeKenBurnsTransform(effect, 10)
    expect(t.scaleX).toBe(3)
  })

  it('respects ease-in easing on scaleX channel', () => {
    const effect = makeEffect({}, [
      kf('k1', 'scaleX', 0, 1, 'ease-in'),
      kf('k2', 'scaleX', 2, 3, 'linear'),
    ])
    // At midpoint (t=0.5), ease-in gives t² = 0.25, so value ≈ 1 + 0.25*2 = 1.5
    const t = computeKenBurnsTransform(effect, 1)
    expect(t.scaleX).toBeCloseTo(1.5)
  })

  it('all four channels keyframed independently', () => {
    const effect = makeEffect({}, [
      kf('a', 'scaleX', 0, 1),
      kf('b', 'scaleX', 2, 2),
      kf('c', 'scaleY', 0, 1),
      kf('d', 'scaleY', 2, 3),
      kf('e', 'x', 0, 0),
      kf('f', 'x', 2, 20),
      kf('g', 'y', 0, 0),
      kf('h', 'y', 2, 40),
    ])
    const t = computeKenBurnsTransform(effect, 1)
    expect(t.scaleX).toBeCloseTo(1.5)
    expect(t.scaleY).toBeCloseTo(2)
    expect(t.x).toBeCloseTo(10)
    expect(t.y).toBeCloseTo(20)
  })
})

// ---------------------------------------------------------------------------
// applyKenBurnsTransform
// ---------------------------------------------------------------------------

describe('applyKenBurnsTransform', () => {
  function makeCtxSpy() {
    return {
      translate: vi.fn(),
      scale: vi.fn(),
    } as unknown as CanvasRenderingContext2D
  }

  it('calls translate and scale on the canvas context', () => {
    const ctx = makeCtxSpy()
    applyKenBurnsTransform(ctx, { scaleX: 2, scaleY: 2, x: 0, y: 0 }, 1920, 1080)
    expect(ctx.translate).toHaveBeenCalled()
    expect(ctx.scale).toHaveBeenCalledWith(2, 2)
  })

  it('first translate centres on canvas', () => {
    const ctx = makeCtxSpy()
    applyKenBurnsTransform(ctx, { scaleX: 1, scaleY: 1, x: 0, y: 0 }, 1920, 1080)
    // First translate call should move to canvas centre
    expect((ctx.translate as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([960, 540])
  })

  it('second translate applies pan offset correctly', () => {
    const ctx = makeCtxSpy()
    applyKenBurnsTransform(ctx, { scaleX: 1, scaleY: 1, x: 30, y: -10 }, 200, 100)
    // Second translate: -width/2 + x, -height/2 + y = -100+30, -50-10
    expect((ctx.translate as ReturnType<typeof vi.fn>).mock.calls[1]).toEqual([-70, -60])
  })

  it('uses separate scaleX and scaleY values', () => {
    const ctx = makeCtxSpy()
    applyKenBurnsTransform(ctx, { scaleX: 1.5, scaleY: 2.5, x: 0, y: 0 }, 100, 100)
    expect(ctx.scale).toHaveBeenCalledWith(1.5, 2.5)
  })

  it('identity transform: scale(1,1) and net translate cancels', () => {
    const ctx = makeCtxSpy()
    applyKenBurnsTransform(ctx, { scaleX: 1, scaleY: 1, x: 0, y: 0 }, 400, 300)
    expect(ctx.scale).toHaveBeenCalledWith(1, 1)
    // translate(200, 150) then translate(-200, -150)
    const calls = (ctx.translate as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]).toEqual([200, 150])
    expect(calls[1]).toEqual([-200, -150])
  })
})
