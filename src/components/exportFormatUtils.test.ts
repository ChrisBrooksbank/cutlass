import { describe, it, expect } from 'vitest'
import {
  getFormatExtension,
  getFormatMimeType,
  getFormatCodecArgs,
  resolveResolution,
  buildExportOutputArgs,
  RESOLUTION_PRESETS,
  FORMAT_LABELS,
} from '@/components/exportFormatUtils'
import type { ExportSettings } from '@/components/exportFormatUtils'

describe('getFormatExtension', () => {
  it('returns mp4 for mp4 format', () => {
    expect(getFormatExtension('mp4')).toBe('mp4')
  })

  it('returns webm for webm format', () => {
    expect(getFormatExtension('webm')).toBe('webm')
  })
})

describe('getFormatMimeType', () => {
  it('returns video/mp4 for mp4', () => {
    expect(getFormatMimeType('mp4')).toBe('video/mp4')
  })

  it('returns video/webm for webm', () => {
    expect(getFormatMimeType('webm')).toBe('video/webm')
  })
})

describe('FORMAT_LABELS', () => {
  it('includes H.264 label for mp4', () => {
    expect(FORMAT_LABELS.mp4).toContain('H.264')
  })

  it('includes VP9 label for webm', () => {
    expect(FORMAT_LABELS.webm).toContain('VP9')
  })
})

describe('RESOLUTION_PRESETS', () => {
  it('defines 1080p as 1920x1080', () => {
    expect(RESOLUTION_PRESETS['1080p']).toEqual({ width: 1920, height: 1080 })
  })

  it('defines 720p as 1280x720', () => {
    expect(RESOLUTION_PRESETS['720p']).toEqual({ width: 1280, height: 720 })
  })

  it('defines 480p as 854x480', () => {
    expect(RESOLUTION_PRESETS['480p']).toEqual({ width: 854, height: 480 })
  })

  it('has three named presets', () => {
    expect(Object.keys(RESOLUTION_PRESETS)).toHaveLength(3)
  })
})

describe('getFormatCodecArgs', () => {
  it('uses libx264 for mp4', () => {
    const args = getFormatCodecArgs('mp4')
    expect(args).toContain('libx264')
  })

  it('uses a browser-friendly H.264 preset for mp4', () => {
    const args = getFormatCodecArgs('mp4')
    expect(args).toContain('veryfast')
  })

  it('includes aac audio codec for mp4', () => {
    const args = getFormatCodecArgs('mp4')
    expect(args).toContain('aac')
  })

  it('uses libvpx-vp9 for webm', () => {
    const args = getFormatCodecArgs('webm')
    expect(args).toContain('libvpx-vp9')
  })

  it('uses realtime VP9 settings for webm', () => {
    const args = getFormatCodecArgs('webm')
    expect(args).toContain('-deadline')
    expect(args).toContain('realtime')
    expect(args).toContain('-cpu-used')
    expect(args).toContain('8')
  })

  it('includes libopus audio codec for webm', () => {
    const args = getFormatCodecArgs('webm')
    expect(args).toContain('libopus')
  })
})

describe('resolveResolution', () => {
  it('resolves 1080p preset', () => {
    const settings: ExportSettings = { format: 'mp4', preset: '1080p' }
    expect(resolveResolution(settings)).toEqual({ width: 1920, height: 1080 })
  })

  it('resolves 720p preset', () => {
    const settings: ExportSettings = { format: 'webm', preset: '720p' }
    expect(resolveResolution(settings)).toEqual({ width: 1280, height: 720 })
  })

  it('resolves 480p preset', () => {
    const settings: ExportSettings = { format: 'mp4', preset: '480p' }
    expect(resolveResolution(settings)).toEqual({ width: 854, height: 480 })
  })

  it('resolves custom preset using customResolution', () => {
    const settings: ExportSettings = {
      format: 'mp4',
      preset: 'custom',
      customResolution: { width: 2560, height: 1440 },
    }
    expect(resolveResolution(settings)).toEqual({ width: 2560, height: 1440 })
  })

  it('throws when custom preset has no customResolution', () => {
    const settings: ExportSettings = { format: 'mp4', preset: 'custom' }
    expect(() => resolveResolution(settings)).toThrow()
  })
})

describe('buildExportOutputArgs', () => {
  it('includes scale filter for 1080p', () => {
    const settings: ExportSettings = { format: 'mp4', preset: '1080p' }
    const args = buildExportOutputArgs(settings)
    expect(args).toContain('-vf')
    const scaleIdx = args.indexOf('-vf')
    expect(args[scaleIdx + 1]).toBe('scale=1920:1080')
  })

  it('includes scale filter for 720p', () => {
    const settings: ExportSettings = { format: 'webm', preset: '720p' }
    const args = buildExportOutputArgs(settings)
    const scaleIdx = args.indexOf('-vf')
    expect(args[scaleIdx + 1]).toBe('scale=1280:720')
  })

  it('includes mp4 codec args for mp4 format', () => {
    const settings: ExportSettings = { format: 'mp4', preset: '720p' }
    const args = buildExportOutputArgs(settings)
    expect(args).toContain('libx264')
    expect(args).toContain('aac')
  })

  it('includes webm codec args for webm format', () => {
    const settings: ExportSettings = { format: 'webm', preset: '720p' }
    const args = buildExportOutputArgs(settings)
    expect(args).toContain('libvpx-vp9')
    expect(args).toContain('libopus')
  })

  it('uses custom resolution when preset is custom', () => {
    const settings: ExportSettings = {
      format: 'mp4',
      preset: 'custom',
      customResolution: { width: 3840, height: 2160 },
    }
    const args = buildExportOutputArgs(settings)
    const scaleIdx = args.indexOf('-vf')
    expect(args[scaleIdx + 1]).toBe('scale=3840:2160')
  })
})
