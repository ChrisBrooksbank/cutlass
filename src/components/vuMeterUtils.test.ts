import { describe, it, expect } from 'vitest'
import { computeRms, rmsToDb, clampDb, dbToFraction } from './vuMeterUtils'

describe('computeRms', () => {
  it('returns 0 for an empty array', () => {
    expect(computeRms(new Uint8Array(0))).toBe(0)
  })

  it('returns 0 for a silent buffer (all 128)', () => {
    const data = new Uint8Array(256).fill(128)
    expect(computeRms(data)).toBe(0)
  })

  it('returns 1 for a maximum positive signal (all 255)', () => {
    // (255 - 128) / 128 = 127/128 ≈ 0.9921875, rms of constant = that value
    const data = new Uint8Array(256).fill(255)
    const expected = 127 / 128
    expect(computeRms(data)).toBeCloseTo(expected, 5)
  })

  it('returns 1 for a maximum negative signal (all 0)', () => {
    // (0 - 128) / 128 = -1, rms = 1
    const data = new Uint8Array(256).fill(0)
    expect(computeRms(data)).toBeCloseTo(1, 5)
  })

  it('computes RMS for a mixed signal', () => {
    // Two samples: 0 (-> -1) and 255 (-> 127/128 ≈ 0.992)
    // RMS = sqrt((-1)^2 + (0.992)^2) / 2) = sqrt((1 + 0.984) / 2) ≈ 0.996
    const data = new Uint8Array([0, 255])
    const s0 = (0 - 128) / 128 // -1
    const s1 = (255 - 128) / 128 // 127/128
    const expected = Math.sqrt((s0 * s0 + s1 * s1) / 2)
    expect(computeRms(data)).toBeCloseTo(expected, 5)
  })
})

describe('rmsToDb', () => {
  it('returns -Infinity for 0', () => {
    expect(rmsToDb(0)).toBe(-Infinity)
  })

  it('returns 0 dB for rms = 1', () => {
    expect(rmsToDb(1)).toBeCloseTo(0, 5)
  })

  it('returns approximately -6 dB for rms = 0.5', () => {
    expect(rmsToDb(0.5)).toBeCloseTo(-6.02, 1)
  })

  it('returns negative value for rms < 1', () => {
    expect(rmsToDb(0.1)).toBeLessThan(0)
  })
})

describe('clampDb', () => {
  it('returns minDb for -Infinity', () => {
    expect(clampDb(-Infinity, -60, 0)).toBe(-60)
  })

  it('clamps values below minDb', () => {
    expect(clampDb(-80, -60, 0)).toBe(-60)
  })

  it('clamps values above maxDb', () => {
    expect(clampDb(10, -60, 0)).toBe(0)
  })

  it('passes through values within range', () => {
    expect(clampDb(-30, -60, 0)).toBe(-30)
  })

  it('handles edge values', () => {
    expect(clampDb(-60, -60, 0)).toBe(-60)
    expect(clampDb(0, -60, 0)).toBe(0)
  })
})

describe('dbToFraction', () => {
  it('returns 0 for minDb', () => {
    expect(dbToFraction(-60, -60, 0)).toBe(0)
  })

  it('returns 1 for maxDb', () => {
    expect(dbToFraction(0, -60, 0)).toBe(1)
  })

  it('returns 0.5 for midpoint', () => {
    expect(dbToFraction(-30, -60, 0)).toBeCloseTo(0.5, 5)
  })

  it('returns 0 when maxDb <= minDb', () => {
    expect(dbToFraction(-30, 0, 0)).toBe(0)
  })
})
