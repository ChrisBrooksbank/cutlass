import type { Effect } from '@/store/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShapeRect {
  x: number
  y: number
  width: number
  height: number
  strokeColor: string
  strokeWidth: number
  fillColor: string
}

export interface ShapeCircle {
  x: number
  y: number
  radiusX: number
  radiusY: number
  strokeColor: string
  strokeWidth: number
  fillColor: string
}

export interface ShapeArrow {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  strokeWidth: number
}

// ---------------------------------------------------------------------------
// Compute functions (extract params with defaults)
// ---------------------------------------------------------------------------

export function computeShapeRect(effect: Effect): ShapeRect {
  const p = effect.params
  return {
    x: (p.x as number | undefined) ?? 100,
    y: (p.y as number | undefined) ?? 100,
    width: (p.width as number | undefined) ?? 200,
    height: (p.height as number | undefined) ?? 120,
    strokeColor: (p.strokeColor as string | undefined) ?? '#ff4444',
    strokeWidth: (p.strokeWidth as number | undefined) ?? 3,
    fillColor: (p.fillColor as string | undefined) ?? 'rgba(255,68,68,0.1)',
  }
}

export function computeShapeCircle(effect: Effect): ShapeCircle {
  const p = effect.params
  return {
    x: (p.x as number | undefined) ?? 200,
    y: (p.y as number | undefined) ?? 200,
    radiusX: (p.radiusX as number | undefined) ?? 80,
    radiusY: (p.radiusY as number | undefined) ?? 60,
    strokeColor: (p.strokeColor as string | undefined) ?? '#44aaff',
    strokeWidth: (p.strokeWidth as number | undefined) ?? 3,
    fillColor: (p.fillColor as string | undefined) ?? 'rgba(68,170,255,0.1)',
  }
}

export function computeShapeArrow(effect: Effect): ShapeArrow {
  const p = effect.params
  return {
    x1: (p.x1 as number | undefined) ?? 100,
    y1: (p.y1 as number | undefined) ?? 200,
    x2: (p.x2 as number | undefined) ?? 400,
    y2: (p.y2 as number | undefined) ?? 300,
    color: (p.color as string | undefined) ?? '#ffdd00',
    strokeWidth: (p.strokeWidth as number | undefined) ?? 4,
  }
}

// ---------------------------------------------------------------------------
// Render functions (draw to canvas)
// ---------------------------------------------------------------------------

export function renderShapeRect(ctx: CanvasRenderingContext2D, shape: ShapeRect): void {
  const { x, y, width, height, strokeColor, strokeWidth, fillColor } = shape
  if (width <= 0 || height <= 0) return
  ctx.save()
  ctx.lineWidth = strokeWidth
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = fillColor
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function renderShapeCircle(ctx: CanvasRenderingContext2D, shape: ShapeCircle): void {
  const { x, y, radiusX, radiusY, strokeColor, strokeWidth, fillColor } = shape
  if (radiusX <= 0 || radiusY <= 0) return
  ctx.save()
  ctx.lineWidth = strokeWidth
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = fillColor
  ctx.beginPath()
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function renderShapeArrow(ctx: CanvasRenderingContext2D, shape: ShapeArrow): void {
  const { x1, y1, x2, y2, color, strokeWidth } = shape
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return

  const angle = Math.atan2(dy, dx)
  const headLen = Math.max(16, strokeWidth * 5)

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Shaft
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  // Arrowhead (filled triangle)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6),
  )
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6),
  )
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}
