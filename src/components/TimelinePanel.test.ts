import { describe, it, expect } from 'vitest'
import {
  timeToPixel,
  pixelToTime,
  clampPps,
  zoomAroundPoint,
  PPS_MIN,
  PPS_MAX,
} from './timelineUtils'

describe('timeToPixel', () => {
  it('converts time to pixels', () => {
    expect(timeToPixel(10, 100)).toBe(1000)
  })

  it('returns 0 for time 0', () => {
    expect(timeToPixel(0, 100)).toBe(0)
  })

  it('handles fractional seconds', () => {
    expect(timeToPixel(1.5, 200)).toBe(300)
  })
})

describe('pixelToTime', () => {
  it('converts pixels to time', () => {
    expect(pixelToTime(1000, 100)).toBe(10)
  })

  it('is the inverse of timeToPixel', () => {
    const pps = 150
    const time = 7.5
    expect(pixelToTime(timeToPixel(time, pps), pps)).toBeCloseTo(time)
  })
})

describe('clampPps', () => {
  it('clamps below minimum', () => {
    expect(clampPps(1)).toBe(PPS_MIN)
  })

  it('clamps above maximum', () => {
    expect(clampPps(99999)).toBe(PPS_MAX)
  })

  it('passes through values within range', () => {
    expect(clampPps(100)).toBe(100)
    expect(clampPps(PPS_MIN)).toBe(PPS_MIN)
    expect(clampPps(PPS_MAX)).toBe(PPS_MAX)
  })
})

describe('zoomAroundPoint', () => {
  it('scales pps by the given factor', () => {
    const result = zoomAroundPoint(100, 0, 0, 2)
    expect(result.pps).toBe(200)
  })

  it('clamps pps to PPS_MAX', () => {
    const result = zoomAroundPoint(PPS_MAX, 0, 0, 2)
    expect(result.pps).toBe(PPS_MAX)
  })

  it('clamps pps to PPS_MIN', () => {
    const result = zoomAroundPoint(PPS_MIN, 0, 0, 0.1)
    expect(result.pps).toBe(PPS_MIN)
  })

  it('keeps the focal pixel pointing at the same timeline time', () => {
    const pps = 100
    const scrollLeft = 200
    const focalPx = 300
    const scaleFactor = 2

    const result = zoomAroundPoint(pps, scrollLeft, focalPx, scaleFactor)

    // Time at focal pixel before zoom
    const timeBefore = (focalPx + scrollLeft) / pps
    // Pixel that time maps to after zoom (subtract new scroll to get canvas-relative px)
    const pxAfter = timeBefore * result.pps - result.scrollLeft
    expect(pxAfter).toBeCloseTo(focalPx)
  })

  it('does not produce negative scrollLeft', () => {
    const result = zoomAroundPoint(100, 0, 0, 0.5)
    expect(result.scrollLeft).toBeGreaterThanOrEqual(0)
  })

  it('zooming out from scrolled position adjusts scrollLeft', () => {
    const pps = 100
    const scrollLeft = 500
    const focalPx = 200
    const scaleFactor = 0.5

    const result = zoomAroundPoint(pps, scrollLeft, focalPx, scaleFactor)
    expect(result.pps).toBe(50)
    // After zoom-out the scroll should decrease
    expect(result.scrollLeft).toBeLessThan(scrollLeft)
  })
})
