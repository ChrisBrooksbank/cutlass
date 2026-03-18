import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeShapeRect,
  computeShapeCircle,
  computeShapeArrow,
  renderShapeRect,
  renderShapeCircle,
  renderShapeArrow,
} from './shapeAnnotationUtils'
import type { Effect } from '@/store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEffect(params: Record<string, unknown> = {}): Effect {
  return {
    id: 'e1',
    type: 'shape-rect',
    params,
    keyframes: [],
  }
}

// ---------------------------------------------------------------------------
// computeShapeRect
// ---------------------------------------------------------------------------

describe('computeShapeRect', () => {
  it('returns defaults when params are empty', () => {
    const result = computeShapeRect(makeEffect())
    expect(result.x).toBe(100)
    expect(result.y).toBe(100)
    expect(result.width).toBe(200)
    expect(result.height).toBe(120)
    expect(result.strokeColor).toBe('#ff4444')
    expect(result.strokeWidth).toBe(3)
    expect(result.fillColor).toBe('rgba(255,68,68,0.1)')
  })

  it('reads custom params', () => {
    const result = computeShapeRect(
      makeEffect({ x: 50, y: 75, width: 300, height: 150, strokeColor: '#00ff00', strokeWidth: 5 }),
    )
    expect(result.x).toBe(50)
    expect(result.y).toBe(75)
    expect(result.width).toBe(300)
    expect(result.height).toBe(150)
    expect(result.strokeColor).toBe('#00ff00')
    expect(result.strokeWidth).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// computeShapeCircle
// ---------------------------------------------------------------------------

describe('computeShapeCircle', () => {
  it('returns defaults when params are empty', () => {
    const effect: Effect = { id: 'e1', type: 'shape-circle', params: {}, keyframes: [] }
    const result = computeShapeCircle(effect)
    expect(result.x).toBe(200)
    expect(result.y).toBe(200)
    expect(result.radiusX).toBe(80)
    expect(result.radiusY).toBe(60)
    expect(result.strokeColor).toBe('#44aaff')
    expect(result.strokeWidth).toBe(3)
  })

  it('reads custom params', () => {
    const effect: Effect = {
      id: 'e1',
      type: 'shape-circle',
      params: { x: 500, y: 400, radiusX: 120, radiusY: 90, strokeColor: '#ff00ff', strokeWidth: 6 },
      keyframes: [],
    }
    const result = computeShapeCircle(effect)
    expect(result.x).toBe(500)
    expect(result.y).toBe(400)
    expect(result.radiusX).toBe(120)
    expect(result.radiusY).toBe(90)
    expect(result.strokeColor).toBe('#ff00ff')
    expect(result.strokeWidth).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// computeShapeArrow
// ---------------------------------------------------------------------------

describe('computeShapeArrow', () => {
  it('returns defaults when params are empty', () => {
    const effect: Effect = { id: 'e1', type: 'shape-arrow', params: {}, keyframes: [] }
    const result = computeShapeArrow(effect)
    expect(result.x1).toBe(100)
    expect(result.y1).toBe(200)
    expect(result.x2).toBe(400)
    expect(result.y2).toBe(300)
    expect(result.color).toBe('#ffdd00')
    expect(result.strokeWidth).toBe(4)
  })

  it('reads custom params', () => {
    const effect: Effect = {
      id: 'e1',
      type: 'shape-arrow',
      params: { x1: 10, y1: 20, x2: 300, y2: 250, color: '#ffffff', strokeWidth: 2 },
      keyframes: [],
    }
    const result = computeShapeArrow(effect)
    expect(result.x1).toBe(10)
    expect(result.y1).toBe(20)
    expect(result.x2).toBe(300)
    expect(result.y2).toBe(250)
    expect(result.color).toBe('#ffffff')
    expect(result.strokeWidth).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// renderShapeRect
// ---------------------------------------------------------------------------

describe('renderShapeRect', () => {
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D
  })

  it('calls rect and fill/stroke for a valid shape', () => {
    renderShapeRect(ctx, {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      strokeColor: '#ff0000',
      strokeWidth: 3,
      fillColor: 'rgba(255,0,0,0.1)',
    })
    expect(ctx.rect).toHaveBeenCalledWith(10, 20, 100, 50)
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('does nothing for zero-size shape', () => {
    renderShapeRect(ctx, {
      x: 0,
      y: 0,
      width: 0,
      height: 50,
      strokeColor: '#ff0000',
      strokeWidth: 2,
      fillColor: 'red',
    })
    expect(ctx.rect).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// renderShapeCircle
// ---------------------------------------------------------------------------

describe('renderShapeCircle', () => {
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D
  })

  it('calls ellipse and fill/stroke for a valid shape', () => {
    renderShapeCircle(ctx, {
      x: 200,
      y: 200,
      radiusX: 80,
      radiusY: 60,
      strokeColor: '#0000ff',
      strokeWidth: 2,
      fillColor: 'rgba(0,0,255,0.1)',
    })
    expect(ctx.ellipse).toHaveBeenCalledWith(200, 200, 80, 60, 0, 0, Math.PI * 2)
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('does nothing for zero-radius shape', () => {
    renderShapeCircle(ctx, {
      x: 0,
      y: 0,
      radiusX: 0,
      radiusY: 60,
      strokeColor: '#ff0000',
      strokeWidth: 2,
      fillColor: 'red',
    })
    expect(ctx.ellipse).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// renderShapeArrow
// ---------------------------------------------------------------------------

describe('renderShapeArrow', () => {
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
      lineCap: '',
      lineJoin: '',
    } as unknown as CanvasRenderingContext2D
  })

  it('draws shaft and arrowhead', () => {
    renderShapeArrow(ctx, { x1: 0, y1: 0, x2: 100, y2: 0, color: '#yellow', strokeWidth: 3 })
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0)
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 0)
    expect(ctx.stroke).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.closePath).toHaveBeenCalled()
  })

  it('does nothing for zero-length arrow', () => {
    renderShapeArrow(ctx, { x1: 100, y1: 100, x2: 100, y2: 100, color: '#ff0000', strokeWidth: 2 })
    expect(ctx.moveTo).not.toHaveBeenCalled()
  })
})
