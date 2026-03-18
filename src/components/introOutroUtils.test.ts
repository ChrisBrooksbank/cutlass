import { describe, it, expect } from 'vitest'
import {
  computeIntroOutroScene,
  renderIntroOutroScene,
  introOutroToFFmpegFilter,
  INTRO_OUTRO_STYLES,
  INTRO_OUTRO_DEFAULT_PARAMS,
  type IntroOutroStyle,
} from './introOutroUtils'
import type { Effect } from '@/store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEffect(params: Record<string, unknown> = {}): Effect {
  return { id: 'e1', type: 'intro-outro', params, keyframes: [] }
}

function makeCanvasCtx(): CanvasRenderingContext2D {
  let savedGlobalAlpha = 1
  return {
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    get globalAlpha() {
      return savedGlobalAlpha
    },
    set globalAlpha(v: number) {
      savedGlobalAlpha = v
    },
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D
}

// ---------------------------------------------------------------------------
// INTRO_OUTRO_STYLES
// ---------------------------------------------------------------------------

describe('INTRO_OUTRO_STYLES', () => {
  it('contains simple, gradient, and minimal', () => {
    const values = INTRO_OUTRO_STYLES.map((s) => s.value)
    expect(values).toContain('simple')
    expect(values).toContain('gradient')
    expect(values).toContain('minimal')
  })

  it('every entry has a non-empty label', () => {
    for (const style of INTRO_OUTRO_STYLES) {
      expect(style.label.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// INTRO_OUTRO_DEFAULT_PARAMS
// ---------------------------------------------------------------------------

describe('INTRO_OUTRO_DEFAULT_PARAMS', () => {
  it('has expected fields', () => {
    expect(INTRO_OUTRO_DEFAULT_PARAMS).toMatchObject({
      style: 'simple',
      title: expect.any(String),
      subtitle: expect.any(String),
      bgColor: expect.stringMatching(/^#/),
      textColor: expect.stringMatching(/^#/),
      accentColor: expect.stringMatching(/^#/),
    })
  })
})

// ---------------------------------------------------------------------------
// computeIntroOutroScene
// ---------------------------------------------------------------------------

describe('computeIntroOutroScene', () => {
  it('returns defaults when params are empty', () => {
    const scene = computeIntroOutroScene(makeEffect())
    expect(scene.style).toBe('simple')
    expect(scene.title).toBe('Your Title')
    expect(scene.subtitle).toBe('Your subtitle here')
    expect(scene.bgColor).toMatch(/^#/)
    expect(scene.textColor).toMatch(/^#/)
    expect(scene.accentColor).toMatch(/^#/)
  })

  it('reads custom params correctly', () => {
    const scene = computeIntroOutroScene(
      makeEffect({
        style: 'gradient',
        title: 'Hello',
        subtitle: 'World',
        bgColor: '#000000',
        textColor: '#ff0000',
        accentColor: '#00ff00',
      }),
    )
    expect(scene.style).toBe('gradient')
    expect(scene.title).toBe('Hello')
    expect(scene.subtitle).toBe('World')
    expect(scene.bgColor).toBe('#000000')
    expect(scene.textColor).toBe('#ff0000')
    expect(scene.accentColor).toBe('#00ff00')
  })

  it('handles all valid style values', () => {
    const styles: IntroOutroStyle[] = ['simple', 'gradient', 'minimal']
    for (const style of styles) {
      const scene = computeIntroOutroScene(makeEffect({ style }))
      expect(scene.style).toBe(style)
    }
  })
})

// ---------------------------------------------------------------------------
// renderIntroOutroScene
// ---------------------------------------------------------------------------

describe('renderIntroOutroScene', () => {
  const width = 1920
  const height = 1080

  it('renders simple style without throwing', () => {
    const ctx = makeCanvasCtx()
    const scene = computeIntroOutroScene(makeEffect({ style: 'simple' }))
    expect(() => renderIntroOutroScene(ctx, scene, width, height)).not.toThrow()
  })

  it('renders gradient style without throwing', () => {
    const ctx = makeCanvasCtx()
    const scene = computeIntroOutroScene(makeEffect({ style: 'gradient' }))
    expect(() => renderIntroOutroScene(ctx, scene, width, height)).not.toThrow()
  })

  it('renders minimal style without throwing', () => {
    const ctx = makeCanvasCtx()
    const scene = computeIntroOutroScene(makeEffect({ style: 'minimal' }))
    expect(() => renderIntroOutroScene(ctx, scene, width, height)).not.toThrow()
  })

  it('renders unknown style without throwing (falls back to simple)', () => {
    const ctx = makeCanvasCtx()
    const scene = computeIntroOutroScene(makeEffect({ style: 'unknown-style' }))
    expect(() => renderIntroOutroScene(ctx, scene, width, height)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// introOutroToFFmpegFilter
// ---------------------------------------------------------------------------

describe('introOutroToFFmpegFilter', () => {
  it('returns a non-empty string', () => {
    const scene = computeIntroOutroScene(makeEffect())
    const filter = introOutroToFFmpegFilter(scene, 1920, 1080)
    expect(typeof filter).toBe('string')
    expect(filter.length).toBeGreaterThan(0)
  })

  it('includes color source with correct dimensions', () => {
    const scene = computeIntroOutroScene(makeEffect({ bgColor: '#1a1a2e' }))
    const filter = introOutroToFFmpegFilter(scene, 1920, 1080)
    expect(filter).toContain('1920x1080')
  })

  it('includes drawtext for title', () => {
    const scene = computeIntroOutroScene(makeEffect({ title: 'My Title' }))
    const filter = introOutroToFFmpegFilter(scene, 1920, 1080)
    expect(filter).toContain('drawtext')
    expect(filter).toContain('My Title')
  })

  it('includes drawtext for subtitle', () => {
    const scene = computeIntroOutroScene(makeEffect({ subtitle: 'My Sub' }))
    const filter = introOutroToFFmpegFilter(scene, 1920, 1080)
    expect(filter).toContain('My Sub')
  })

  it('escapes single quotes in title', () => {
    const scene = computeIntroOutroScene(makeEffect({ title: "it's live" }))
    const filter = introOutroToFFmpegFilter(scene, 1920, 1080)
    expect(filter).toContain("\\'")
    expect(filter).not.toContain("it's live")
  })

  it('strips # from bgColor for FFmpeg', () => {
    const scene = computeIntroOutroScene(makeEffect({ bgColor: '#abcdef' }))
    const filter = introOutroToFFmpegFilter(scene, 1920, 1080)
    expect(filter).toContain('abcdef')
    expect(filter).not.toContain('#abcdef')
  })
})

// ---------------------------------------------------------------------------
// Effect registry integration
// ---------------------------------------------------------------------------

describe('intro-outro effect in registry', () => {
  it('is registered in the effect registry', async () => {
    const { getEffectHandler } = await import('./effectRegistry')
    const handler = getEffectHandler('intro-outro')
    expect(handler).not.toBeNull()
    expect(handler?.displayName).toBe('Intro / Outro')
  })

  it('defaultParams match INTRO_OUTRO_DEFAULT_PARAMS', async () => {
    const { getEffectHandler } = await import('./effectRegistry')
    const handler = getEffectHandler('intro-outro')!
    expect(handler.defaultParams).toMatchObject({
      style: 'simple',
      title: expect.any(String),
    })
  })

  it('render does not throw with minimal canvas stub', async () => {
    const { getEffectHandler } = await import('./effectRegistry')
    const handler = getEffectHandler('intro-outro')!
    const ctx = makeCanvasCtx()
    expect(() =>
      handler.render({ ctx, width: 1920, height: 1080, clipTime: 0 }, makeEffect()),
    ).not.toThrow()
  })

  it('toFFmpegFilter returns a non-null filter string', async () => {
    const { getEffectHandler } = await import('./effectRegistry')
    const handler = getEffectHandler('intro-outro')!
    const result = handler.toFFmpegFilter(makeEffect(), {
      clipIndex: 0,
      width: 1920,
      height: 1080,
      fps: 30,
    })
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })
})
