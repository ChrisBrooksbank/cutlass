import { describe, it, expect } from 'vitest'
import {
  registerEffect,
  getEffectHandler,
  getAllEffectTypes,
  type EffectHandler,
  type RenderContext,
  type ExportContext,
} from './effectRegistry'
import type { Effect, Keyframe } from '@/store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEffect(
  type: string,
  params: Record<string, unknown> = {},
  keyframes: Keyframe[] = [],
): Effect {
  return { id: 'e1', type, params, keyframes }
}

const baseExportCtx: ExportContext = { clipIndex: 0, width: 1920, height: 1080, fps: 30 }

function makeCanvas(): RenderContext {
  // jsdom does not implement canvas — use a minimal stub
  const ctx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    arc: () => {},
    rect: () => {},
    clip: () => {},
    fill: () => {},
    fillRect: () => {},
    fillText: () => {},
    fillStyle: '',
    font: '',
    filter: '',
  } as unknown as CanvasRenderingContext2D
  return { ctx, width: 1920, height: 1080, clipTime: 0 }
}

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------

describe('registerEffect / getEffectHandler / getAllEffectTypes', () => {
  it('returns null for unknown type', () => {
    expect(getEffectHandler('__unknown_type__')).toBeNull()
  })

  it('registers and retrieves a custom handler', () => {
    const handler: EffectHandler = {
      type: '__test__',
      displayName: 'Test',
      defaultParams: {},
      render: () => {},
      toFFmpegFilter: () => null,
    }
    registerEffect(handler)
    expect(getEffectHandler('__test__')).toBe(handler)
    expect(getAllEffectTypes()).toContain('__test__')
  })

  it('overwrites existing handler when re-registered', () => {
    const h1: EffectHandler = {
      type: '__overwrite__',
      displayName: 'V1',
      defaultParams: {},
      render: () => {},
      toFFmpegFilter: () => null,
    }
    const h2: EffectHandler = { ...h1, displayName: 'V2' }
    registerEffect(h1)
    registerEffect(h2)
    expect(getEffectHandler('__overwrite__')?.displayName).toBe('V2')
  })

  it('getAllEffectTypes includes all built-in types', () => {
    const types = getAllEffectTypes()
    expect(types).toContain('zoom')
    expect(types).toContain('blur')
    expect(types).toContain('cursor')
    expect(types).toContain('text')
    expect(types).toContain('crop')
  })
})

// ---------------------------------------------------------------------------
// zoom handler
// ---------------------------------------------------------------------------

describe('zoom handler', () => {
  it('has correct displayName and defaultParams', () => {
    const h = getEffectHandler('zoom')!
    expect(h.displayName).toBe('Zoom / Pan')
    expect(h.defaultParams).toMatchObject({ scaleX: 1, scaleY: 1, x: 0, y: 0 })
  })

  it('render does not throw', () => {
    const h = getEffectHandler('zoom')!
    const rctx = makeCanvas()
    expect(() => h.render(rctx, makeEffect('zoom', { scaleX: 1.5, x: 10, y: 0 }))).not.toThrow()
  })

  it('toFFmpegFilter returns a zoompan filter string', () => {
    const h = getEffectHandler('zoom')!
    const filter = h.toFFmpegFilter(makeEffect('zoom', { scaleX: 2, x: 50, y: 20 }), baseExportCtx)
    expect(filter).not.toBeNull()
    expect(filter).toContain('zoompan')
    expect(filter).toContain('1920x1080')
    expect(filter).toContain('fps=30')
  })
})

// ---------------------------------------------------------------------------
// blur handler
// ---------------------------------------------------------------------------

describe('blur handler', () => {
  it('has correct displayName and defaultParams', () => {
    const h = getEffectHandler('blur')!
    expect(h.displayName).toBe('Blur / Redact')
    expect(h.defaultParams).toMatchObject({ strength: 10 })
  })

  it('render does not throw', () => {
    const h = getEffectHandler('blur')!
    const rctx = makeCanvas()
    expect(() =>
      h.render(rctx, makeEffect('blur', { x: 10, y: 10, width: 200, height: 100, strength: 15 })),
    ).not.toThrow()
  })

  it('toFFmpegFilter returns a boxblur filter string', () => {
    const h = getEffectHandler('blur')!
    const filter = h.toFFmpegFilter(
      makeEffect('blur', { x: 0, y: 0, width: 100, height: 60, strength: 10 }),
      baseExportCtx,
    )
    expect(filter).not.toBeNull()
    expect(filter).toContain('boxblur')
  })
})

// ---------------------------------------------------------------------------
// cursor handler
// ---------------------------------------------------------------------------

describe('cursor handler', () => {
  it('has correct displayName', () => {
    expect(getEffectHandler('cursor')?.displayName).toBe('Cursor Highlight')
  })

  it('render does nothing when keyframes are missing', () => {
    const h = getEffectHandler('cursor')!
    const rctx = makeCanvas()
    // No keyframes → should return early without drawing
    expect(() => h.render(rctx, makeEffect('cursor'))).not.toThrow()
  })

  it('render draws a circle when x/y keyframes are present', () => {
    const h = getEffectHandler('cursor')!
    const rctx = makeCanvas()
    const kfX: Keyframe = {
      id: 'kx',
      time: 0,
      value: 100,
      easing: 'linear',
      channel: 'x',
    } as Keyframe & { channel: string }
    const kfY: Keyframe = {
      id: 'ky',
      time: 0,
      value: 200,
      easing: 'linear',
      channel: 'y',
    } as Keyframe & { channel: string }
    const effect = makeEffect('cursor', { radius: 30, color: 'rgba(255,255,0,0.4)' }, [kfX, kfY])
    expect(() => h.render(rctx, effect)).not.toThrow()
  })

  it('toFFmpegFilter returns null (canvas-only effect)', () => {
    const h = getEffectHandler('cursor')!
    expect(h.toFFmpegFilter(makeEffect('cursor'), baseExportCtx)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// text handler
// ---------------------------------------------------------------------------

describe('text handler', () => {
  it('has correct displayName and defaultParams', () => {
    const h = getEffectHandler('text')!
    expect(h.displayName).toBe('Text Overlay')
    expect(h.defaultParams).toMatchObject({ text: 'Label', fontSize: 32 })
  })

  it('render draws text without throwing', () => {
    const h = getEffectHandler('text')!
    const rctx = makeCanvas()
    expect(() =>
      h.render(
        rctx,
        makeEffect('text', { text: 'Hello', x: 50, y: 100, fontSize: 24, color: '#ff0000' }),
      ),
    ).not.toThrow()
  })

  it('toFFmpegFilter returns a drawtext filter', () => {
    const h = getEffectHandler('text')!
    const filter = h.toFFmpegFilter(
      makeEffect('text', { text: 'Hello', x: 10, y: 20, fontSize: 24, color: '#ffffff' }),
      baseExportCtx,
    )
    expect(filter).not.toBeNull()
    expect(filter).toContain('drawtext')
    expect(filter).toContain('Hello')
    expect(filter).toContain('fontsize=24')
  })

  it('toFFmpegFilter escapes single quotes in text', () => {
    const h = getEffectHandler('text')!
    const filter = h.toFFmpegFilter(makeEffect('text', { text: "it's a test" }), baseExportCtx)
    expect(filter).toContain("\\'")
    expect(filter).not.toContain("it's")
  })
})

// ---------------------------------------------------------------------------
// crop handler
// ---------------------------------------------------------------------------

describe('crop handler', () => {
  it('has correct displayName', () => {
    expect(getEffectHandler('crop')?.displayName).toBe('Crop')
  })

  it('render does not throw', () => {
    const h = getEffectHandler('crop')!
    const rctx = makeCanvas()
    expect(() =>
      h.render(rctx, makeEffect('crop', { x: 0, y: 0, width: 1280, height: 720 })),
    ).not.toThrow()
  })

  it('toFFmpegFilter returns a crop filter', () => {
    const h = getEffectHandler('crop')!
    const filter = h.toFFmpegFilter(
      makeEffect('crop', { x: 10, y: 10, width: 1280, height: 720 }),
      baseExportCtx,
    )
    expect(filter).not.toBeNull()
    expect(filter).toContain('crop=1280:720:10:10')
  })
})
