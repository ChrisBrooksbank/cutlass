import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractAudioWaveform,
  computeWaveformPoints,
  clearWaveformCache,
  waveformCacheSize,
} from './waveformUtils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAudioBuffer(opts: { channels?: number; length?: number; sampleRate?: number } = {}) {
  const { channels = 1, length = 1000, sampleRate = 44100 } = opts
  const channelData = Array.from({ length: channels }, () => {
    const data = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin((i / length) * Math.PI * 2) * 0.5
    }
    return data
  })
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: (c: number) => channelData[c],
  }
}

function makeAudioContext(audioBuffer = makeAudioBuffer()) {
  return {
    decodeAudioData: vi.fn().mockResolvedValue(audioBuffer),
  }
}

function makeFetchResponse(data: ArrayBuffer = new ArrayBuffer(8)) {
  return {
    arrayBuffer: vi.fn().mockResolvedValue(data),
  }
}

// ---------------------------------------------------------------------------
// extractAudioWaveform
// ---------------------------------------------------------------------------

describe('extractAudioWaveform', () => {
  beforeEach(() => {
    clearWaveformCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a Float32Array with the requested number of samples', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeFetchResponse() as unknown as Response)
    const ctx = makeAudioContext()

    const result = await extractAudioWaveform(
      'blob:audio',
      50,
      () => ctx as unknown as AudioContext,
    )

    expect(result).toBeInstanceOf(Float32Array)
    expect(result.length).toBe(50)
  })

  it('all amplitude values are in the range [0, 1]', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeFetchResponse() as unknown as Response)
    const ctx = makeAudioContext()

    const result = await extractAudioWaveform(
      'blob:range',
      100,
      () => ctx as unknown as AudioContext,
    )

    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('caches results and does not call fetch or decodeAudioData a second time', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeFetchResponse() as unknown as Response)
    const ctx = makeAudioContext()
    const factory = () => ctx as unknown as AudioContext

    await extractAudioWaveform('blob:cached', 80, factory)
    expect(waveformCacheSize()).toBe(1)

    await extractAudioWaveform('blob:cached', 80, factory)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1)
  })

  it('uses separate cache entries for different sample counts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeFetchResponse() as unknown as Response)
    const ctx = makeAudioContext()
    const factory = () => ctx as unknown as AudioContext

    await extractAudioWaveform('blob:multi', 50, factory)
    await extractAudioWaveform('blob:multi', 100, factory)

    expect(waveformCacheSize()).toBe(2)
  })

  it('uses separate cache entries for different URLs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeFetchResponse() as unknown as Response)
    const ctx = makeAudioContext()
    const factory = () => ctx as unknown as AudioContext

    await extractAudioWaveform('blob:urlA', 50, factory)
    await extractAudioWaveform('blob:urlB', 50, factory)

    expect(waveformCacheSize()).toBe(2)
  })

  it('mixes multiple channels to mono', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeFetchResponse() as unknown as Response)
    // Two-channel audio: one silent, one at full amplitude
    const stereoBuffer = {
      numberOfChannels: 2,
      length: 100,
      sampleRate: 44100,
      getChannelData: (c: number) => {
        const data = new Float32Array(100)
        if (c === 1) data.fill(1.0)
        return data
      },
    }
    const ctx = makeAudioContext(stereoBuffer)

    const result = await extractAudioWaveform(
      'blob:stereo',
      10,
      () => ctx as unknown as AudioContext,
    )

    // Each sample should be RMS of 0.5 (average of 0 and 1 per sample)
    for (const v of result) {
      expect(v).toBeCloseTo(0.5, 5)
    }
  })

  it('rejects when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
    const ctx = makeAudioContext()

    await expect(
      extractAudioWaveform('blob:bad', 50, () => ctx as unknown as AudioContext),
    ).rejects.toThrow('network error')
  })

  it('rejects when decodeAudioData fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeFetchResponse() as unknown as Response)
    const ctx = {
      decodeAudioData: vi.fn().mockRejectedValue(new Error('decode error')),
    }

    await expect(
      extractAudioWaveform('blob:decode-fail', 50, () => ctx as unknown as AudioContext),
    ).rejects.toThrow('decode error')
  })
})

// ---------------------------------------------------------------------------
// computeWaveformPoints
// ---------------------------------------------------------------------------

describe('computeWaveformPoints', () => {
  it('returns empty array for empty data', () => {
    expect(computeWaveformPoints(new Float32Array(0), 100, 50)).toEqual([])
  })

  it('returns empty array when width is zero', () => {
    expect(computeWaveformPoints(new Float32Array([0.5]), 0, 50)).toEqual([])
  })

  it('returns empty array when height is zero', () => {
    expect(computeWaveformPoints(new Float32Array([0.5]), 100, 0)).toEqual([])
  })

  it('returns 2 * 2 * n points for n samples (top + bottom envelopes)', () => {
    const data = new Float32Array(10).fill(0.5)
    const points = computeWaveformPoints(data, 100, 50)
    // n top points + n bottom points = 2n, each with x,y = 4n values
    expect(points.length).toBe(4 * 10)
  })

  it('first point is at x=0, last bottom point is also at x=0', () => {
    const data = new Float32Array(5).fill(0.5)
    const points = computeWaveformPoints(data, 100, 50)
    // First point x
    expect(points[0]).toBe(0)
    // Last point x (bottom envelope ends at i=0 → x=0)
    expect(points[points.length - 2]).toBe(0)
  })

  it('midpoint x equals width / 2 for middle sample', () => {
    const n = 5
    const data = new Float32Array(n).fill(0.5)
    const width = 100
    const points = computeWaveformPoints(data, width, 50)
    const midIdx = Math.floor(n / 2)
    // Top envelope midpoint x
    expect(points[midIdx * 2]).toBeCloseTo(width / 2, 5)
  })

  it('y coordinates are symmetric around height / 2', () => {
    const data = new Float32Array([0.5])
    const height = 60
    const points = computeWaveformPoints(data, 100, height)
    const midY = height / 2
    const topY = points[1]
    const bottomY = points[3]
    expect(topY).toBeLessThan(midY)
    expect(bottomY).toBeGreaterThan(midY)
    expect(midY - topY).toBeCloseTo(bottomY - midY, 5)
  })
})

// ---------------------------------------------------------------------------
// clearWaveformCache
// ---------------------------------------------------------------------------

describe('clearWaveformCache', () => {
  beforeEach(() => {
    clearWaveformCache()
    vi.restoreAllMocks()
  })

  it('empties the cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeFetchResponse() as unknown as Response)
    const ctx = makeAudioContext()

    await extractAudioWaveform('blob:x', 50, () => ctx as unknown as AudioContext)
    expect(waveformCacheSize()).toBe(1)

    clearWaveformCache()
    expect(waveformCacheSize()).toBe(0)
  })
})
