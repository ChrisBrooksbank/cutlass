import { describe, it, expect } from 'vitest'
import { computeCropRegion, CROP_MIN_SIZE } from './cropUtils'
import type { Effect } from '@/store/types'

function makeEffect(params: Record<string, unknown> = {}): Effect {
  return { id: 'e1', type: 'crop', params, keyframes: [] }
}

describe('computeCropRegion', () => {
  it('returns params as-is when all values are provided', () => {
    const region = computeCropRegion(makeEffect({ x: 10, y: 20, width: 1280, height: 720 }))
    expect(region).toEqual({ x: 10, y: 20, width: 1280, height: 720 })
  })

  it('falls back to default dimensions when params are absent', () => {
    const region = computeCropRegion(makeEffect(), 1920, 1080)
    expect(region).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
  })

  it('uses custom default dimensions', () => {
    const region = computeCropRegion(makeEffect(), 1280, 720)
    expect(region).toEqual({ x: 0, y: 0, width: 1280, height: 720 })
  })

  it('clamps width to CROP_MIN_SIZE when value is too small', () => {
    const region = computeCropRegion(makeEffect({ x: 0, y: 0, width: 0, height: 100 }))
    expect(region.width).toBe(CROP_MIN_SIZE)
    expect(region.height).toBe(100)
  })

  it('clamps height to CROP_MIN_SIZE when value is too small', () => {
    const region = computeCropRegion(makeEffect({ x: 0, y: 0, width: 100, height: -5 }))
    expect(region.height).toBe(CROP_MIN_SIZE)
    expect(region.width).toBe(100)
  })

  it('allows negative x and y (offset crop)', () => {
    const region = computeCropRegion(makeEffect({ x: -50, y: -20, width: 800, height: 600 }))
    expect(region.x).toBe(-50)
    expect(region.y).toBe(-20)
  })
})
