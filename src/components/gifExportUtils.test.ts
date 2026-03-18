import { describe, it, expect } from 'vitest'
import {
  buildGifPalettegenFilter,
  buildGifPalettegenArgs,
  buildGifPaletteUseFilter,
  buildGifPaletteUseArgs,
  defaultGifExportSettings,
  GIF_DEFAULT_FPS,
  GIF_DEFAULT_WIDTH,
} from '@/components/gifExportUtils'
import type { GifExportSettings } from '@/components/gifExportUtils'

const settings480: GifExportSettings = { fps: 10, width: 480 }
const settings720: GifExportSettings = { fps: 15, width: 720 }

describe('GIF_DEFAULT_FPS / GIF_DEFAULT_WIDTH', () => {
  it('exports sensible defaults', () => {
    expect(GIF_DEFAULT_FPS).toBeGreaterThan(0)
    expect(GIF_DEFAULT_WIDTH).toBeGreaterThan(0)
  })
})

describe('defaultGifExportSettings', () => {
  it('returns object with fps and width matching defaults', () => {
    const s = defaultGifExportSettings()
    expect(s.fps).toBe(GIF_DEFAULT_FPS)
    expect(s.width).toBe(GIF_DEFAULT_WIDTH)
  })
})

describe('buildGifPalettegenFilter', () => {
  it('contains fps segment with configured value', () => {
    expect(buildGifPalettegenFilter(settings480)).toContain('fps=10')
  })

  it('contains scale segment with configured width', () => {
    expect(buildGifPalettegenFilter(settings480)).toContain('scale=480:-1')
  })

  it('uses lanczos resampling', () => {
    expect(buildGifPalettegenFilter(settings480)).toContain('lanczos')
  })

  it('ends with palettegen', () => {
    expect(buildGifPalettegenFilter(settings480)).toContain('palettegen')
  })

  it('reflects different fps value', () => {
    expect(buildGifPalettegenFilter(settings720)).toContain('fps=15')
  })

  it('reflects different width value', () => {
    expect(buildGifPalettegenFilter(settings720)).toContain('scale=720:-1')
  })
})

describe('buildGifPalettegenArgs', () => {
  it('includes -vf flag', () => {
    const args = buildGifPalettegenArgs(settings480)
    expect(args).toContain('-vf')
  })

  it('places filter string after -vf', () => {
    const args = buildGifPalettegenArgs(settings480)
    const idx = args.indexOf('-vf')
    expect(args[idx + 1]).toContain('palettegen')
  })

  it('includes -y to overwrite output', () => {
    const args = buildGifPalettegenArgs(settings480)
    expect(args).toContain('-y')
  })

  it('does not include -lavfi (that is for pass 2)', () => {
    const args = buildGifPalettegenArgs(settings480)
    expect(args).not.toContain('-lavfi')
  })
})

describe('buildGifPaletteUseFilter', () => {
  it('contains fps segment', () => {
    expect(buildGifPaletteUseFilter(settings480)).toContain('fps=10')
  })

  it('contains scale segment with width', () => {
    expect(buildGifPaletteUseFilter(settings480)).toContain('scale=480:-1')
  })

  it('references paletteuse', () => {
    expect(buildGifPaletteUseFilter(settings480)).toContain('paletteuse')
  })

  it('wires palette input as second stream [1:v]', () => {
    expect(buildGifPaletteUseFilter(settings480)).toContain('[1:v]')
  })

  it('reflects different fps and width', () => {
    const filter = buildGifPaletteUseFilter(settings720)
    expect(filter).toContain('fps=15')
    expect(filter).toContain('scale=720:-1')
  })
})

describe('buildGifPaletteUseArgs', () => {
  it('includes -lavfi flag', () => {
    const args = buildGifPaletteUseArgs(settings480)
    expect(args).toContain('-lavfi')
  })

  it('places filter graph after -lavfi', () => {
    const args = buildGifPaletteUseArgs(settings480)
    const idx = args.indexOf('-lavfi')
    expect(args[idx + 1]).toContain('paletteuse')
  })

  it('includes -y to overwrite output', () => {
    const args = buildGifPaletteUseArgs(settings480)
    expect(args).toContain('-y')
  })

  it('does not include -vf (that is for pass 1)', () => {
    const args = buildGifPaletteUseArgs(settings480)
    expect(args).not.toContain('-vf')
  })
})
