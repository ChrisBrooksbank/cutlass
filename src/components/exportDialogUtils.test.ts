import { describe, it, expect } from 'vitest'
import {
  QUALITY_PRESETS,
  estimateVideoFileSizeBytes,
  estimateGifFileSizeBytes,
  formatFileSize,
  getResolutionLabel,
  buildExportFilename,
} from '@/components/exportDialogUtils'

describe('QUALITY_PRESETS', () => {
  it('defines high, medium, and low presets', () => {
    expect(Object.keys(QUALITY_PRESETS)).toEqual(['high', 'medium', 'low'])
  })

  it('high preset has lower CRF than medium for H.264', () => {
    expect(QUALITY_PRESETS.high.crfH264).toBeLessThan(QUALITY_PRESETS.medium.crfH264)
  })

  it('medium preset has lower CRF than low for H.264', () => {
    expect(QUALITY_PRESETS.medium.crfH264).toBeLessThan(QUALITY_PRESETS.low.crfH264)
  })

  it('high preset has higher estimated bitrate than low', () => {
    expect(QUALITY_PRESETS.high.estimatedBitrateMbps).toBeGreaterThan(
      QUALITY_PRESETS.low.estimatedBitrateMbps,
    )
  })
})

describe('estimateVideoFileSizeBytes', () => {
  it('returns a positive number for a 60-second clip at medium quality', () => {
    const size = estimateVideoFileSizeBytes(60, 'medium')
    expect(size).toBeGreaterThan(0)
  })

  it('returns larger size for high quality than low quality', () => {
    const high = estimateVideoFileSizeBytes(60, 'high')
    const low = estimateVideoFileSizeBytes(60, 'low')
    expect(high).toBeGreaterThan(low)
  })

  it('scales linearly with duration', () => {
    const size30 = estimateVideoFileSizeBytes(30, 'medium')
    const size60 = estimateVideoFileSizeBytes(60, 'medium')
    expect(size60).toBeCloseTo(size30 * 2, 0)
  })

  it('returns 0 for 0-second duration', () => {
    expect(estimateVideoFileSizeBytes(0, 'medium')).toBe(0)
  })
})

describe('estimateGifFileSizeBytes', () => {
  it('returns a positive number for a 10-second GIF', () => {
    const size = estimateGifFileSizeBytes(10, { fps: 10, width: 480 })
    expect(size).toBeGreaterThan(0)
  })

  it('returns larger size for higher fps', () => {
    const size10fps = estimateGifFileSizeBytes(10, { fps: 10, width: 480 })
    const size24fps = estimateGifFileSizeBytes(10, { fps: 24, width: 480 })
    expect(size24fps).toBeGreaterThan(size10fps)
  })

  it('returns larger size for wider GIF', () => {
    const size480 = estimateGifFileSizeBytes(10, { fps: 10, width: 480 })
    const size960 = estimateGifFileSizeBytes(10, { fps: 10, width: 960 })
    expect(size960).toBeGreaterThan(size480)
  })

  it('returns 0 for 0-second duration', () => {
    expect(estimateGifFileSizeBytes(0, { fps: 10, width: 480 })).toBe(0)
  })
})

describe('formatFileSize', () => {
  it('formats bytes below 1 MB as KB', () => {
    expect(formatFileSize(500_000)).toMatch(/KB/)
  })

  it('formats bytes in the MB range', () => {
    expect(formatFileSize(5_000_000)).toMatch(/MB/)
  })

  it('formats bytes in the GB range', () => {
    expect(formatFileSize(2_000_000_000)).toMatch(/GB/)
  })

  it('formats 1.5 MB correctly', () => {
    expect(formatFileSize(1_500_000)).toBe('1.5 MB')
  })
})

describe('getResolutionLabel', () => {
  it('returns pixel dimensions for 1080p', () => {
    expect(getResolutionLabel('1080p')).toBe('1920 × 1080')
  })

  it('returns pixel dimensions for 720p', () => {
    expect(getResolutionLabel('720p')).toBe('1280 × 720')
  })

  it('returns pixel dimensions for 480p', () => {
    expect(getResolutionLabel('480p')).toBe('854 × 480')
  })

  it('returns "Custom" for custom preset', () => {
    expect(getResolutionLabel('custom')).toBe('Custom')
  })
})

describe('buildExportFilename', () => {
  it('includes resolution preset in the filename for mp4', () => {
    expect(buildExportFilename('mp4', '720p')).toBe('export-720p.mp4')
  })

  it('includes webm extension for webm format', () => {
    expect(buildExportFilename('webm', '1080p')).toBe('export-1080p.webm')
  })

  it('uses "custom" suffix for custom preset', () => {
    expect(buildExportFilename('mp4', 'custom')).toBe('export-custom.mp4')
  })
})
