import { describe, it, expect } from 'vitest'
import { computeTextOverlay } from './textOverlayUtils'
import type { Effect } from '@/store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEffect(params: Record<string, unknown> = {}): Effect {
  return { id: 'e1', type: 'text', params, keyframes: [] }
}

// ---------------------------------------------------------------------------
// computeTextOverlay
// ---------------------------------------------------------------------------

describe('computeTextOverlay', () => {
  it('returns defaults when no params are set', () => {
    const overlay = computeTextOverlay(makeEffect())
    expect(overlay).toEqual({
      text: 'Label',
      x: 50,
      y: 50,
      fontSize: 32,
      color: '#ffffff',
      fontFamily: 'sans-serif',
    })
  })

  it('reads text from params', () => {
    const overlay = computeTextOverlay(makeEffect({ text: 'Hello World' }))
    expect(overlay.text).toBe('Hello World')
  })

  it('reads x and y position from params', () => {
    const overlay = computeTextOverlay(makeEffect({ x: 200, y: 300 }))
    expect(overlay.x).toBe(200)
    expect(overlay.y).toBe(300)
  })

  it('reads fontSize from params', () => {
    const overlay = computeTextOverlay(makeEffect({ fontSize: 48 }))
    expect(overlay.fontSize).toBe(48)
  })

  it('reads color from params', () => {
    const overlay = computeTextOverlay(makeEffect({ color: '#ff0000' }))
    expect(overlay.color).toBe('#ff0000')
  })

  it('reads fontFamily from params', () => {
    const overlay = computeTextOverlay(makeEffect({ fontFamily: 'Arial' }))
    expect(overlay.fontFamily).toBe('Arial')
  })

  it('reads all params together', () => {
    const overlay = computeTextOverlay(
      makeEffect({
        text: 'Test',
        x: 100,
        y: 200,
        fontSize: 24,
        color: '#00ff00',
        fontFamily: 'Georgia',
      }),
    )
    expect(overlay).toEqual({
      text: 'Test',
      x: 100,
      y: 200,
      fontSize: 24,
      color: '#00ff00',
      fontFamily: 'Georgia',
    })
  })

  it('falls back to default for each missing param individually', () => {
    expect(computeTextOverlay(makeEffect({ y: 100 })).x).toBe(50)
    expect(computeTextOverlay(makeEffect({ x: 100 })).y).toBe(50)
    expect(computeTextOverlay(makeEffect({ text: 'hi' })).fontSize).toBe(32)
    expect(computeTextOverlay(makeEffect({ fontSize: 16 })).color).toBe('#ffffff')
    expect(computeTextOverlay(makeEffect({ color: '#000' })).fontFamily).toBe('sans-serif')
  })
})
