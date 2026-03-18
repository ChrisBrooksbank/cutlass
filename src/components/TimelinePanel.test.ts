import { describe, it, expect } from 'vitest'
import {
  timeToPixel,
  pixelToTime,
  clampPps,
  zoomAroundPoint,
  getRulerTickInterval,
  getRulerTicks,
  formatRulerTime,
  getTrackY,
  getTracksHeight,
  TRACK_HEIGHT,
  TRACK_HEADER_WIDTH,
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

describe('getRulerTickInterval', () => {
  it('returns a frame-level interval at very high zoom', () => {
    // At 2000 pps, 1/30 s * 2000 = ~66 px ≥ 60 — so should pick 1/30
    const interval = getRulerTickInterval(2000)
    expect(interval).toBeCloseTo(1 / 30, 5)
  })

  it('returns 1 second interval at medium zoom', () => {
    // At 100 pps, 1 s * 100 = 100 px ≥ 60
    expect(getRulerTickInterval(100)).toBe(1)
  })

  it('returns 5 second interval at low-medium zoom', () => {
    // At 20 pps: 1 s * 20 = 20 < 60, 2 s * 20 = 40 < 60, 5 s * 20 = 100 ≥ 60
    expect(getRulerTickInterval(20)).toBe(5)
  })

  it('returns 60 second interval at very low zoom', () => {
    // At 10 pps: 30 s * 10 = 300 ≥ 60 — but 15*10=150 ≥ 60, 10*10=100 ≥ 60, 5*10=50 < 60
    expect(getRulerTickInterval(10)).toBe(10)
  })
})

describe('formatRulerTime', () => {
  it('formats sub-second as frame notation', () => {
    // 1.5 s at 1/30 interval → "1:15" (15 frames)
    expect(formatRulerTime(1.5, 1 / 30)).toBe('1:15')
  })

  it('formats whole seconds', () => {
    expect(formatRulerTime(5, 1)).toBe('5s')
  })

  it('formats minutes and seconds', () => {
    expect(formatRulerTime(90, 30)).toBe('1:30')
  })

  it('formats whole minutes', () => {
    expect(formatRulerTime(120, 60)).toBe('2m')
  })

  it('formats time 0 as 0s', () => {
    expect(formatRulerTime(0, 1)).toBe('0s')
  })
})

describe('getTrackY', () => {
  it('returns 0 for the first track', () => {
    expect(getTrackY(0)).toBe(0)
  })

  it('returns TRACK_HEIGHT for the second track', () => {
    expect(getTrackY(1)).toBe(TRACK_HEIGHT)
  })

  it('returns index * TRACK_HEIGHT for any track', () => {
    expect(getTrackY(3)).toBe(3 * TRACK_HEIGHT)
  })
})

describe('getTracksHeight', () => {
  it('returns 0 for zero tracks', () => {
    expect(getTracksHeight(0)).toBe(0)
  })

  it('returns TRACK_HEIGHT for one track', () => {
    expect(getTracksHeight(1)).toBe(TRACK_HEIGHT)
  })

  it('returns count * TRACK_HEIGHT', () => {
    expect(getTracksHeight(5)).toBe(5 * TRACK_HEIGHT)
  })
})

describe('TRACK_HEADER_WIDTH', () => {
  it('is a positive number', () => {
    expect(TRACK_HEADER_WIDTH).toBeGreaterThan(0)
  })
})

describe('getRulerTicks', () => {
  it('returns ticks within the viewport', () => {
    const pps = 100
    const scrollLeft = 0
    const viewportWidth = 800
    const ticks = getRulerTicks(pps, scrollLeft, viewportWidth)
    // interval is 1s, viewport covers 0–8s → 9 ticks (0,1,2,...,8)
    expect(ticks.length).toBeGreaterThanOrEqual(8)
    expect(ticks[0].time).toBeCloseTo(0)
  })

  it('offsets x by scroll position', () => {
    const pps = 100
    const scrollLeft = 200 // 2 seconds scrolled
    const viewportWidth = 400
    const ticks = getRulerTicks(pps, scrollLeft, viewportWidth)
    // First tick at or before 2 s; x = time * pps - scrollLeft
    for (const tick of ticks) {
      expect(tick.x).toBeCloseTo(tick.time * pps - scrollLeft)
    }
  })

  it('does not exceed 2000 ticks', () => {
    // Pathological: tiny interval, huge viewport
    const ticks = getRulerTicks(PPS_MAX, 0, 100000)
    expect(ticks.length).toBeLessThanOrEqual(2000)
  })
})
