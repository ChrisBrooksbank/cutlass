import type { Effect } from '@/store/types'
import { interpolateKeyframes } from './keyframeUtils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlurRegion {
  x: number // project pixels from left
  y: number // project pixels from top
  width: number // project pixels
  height: number // project pixels
  strength: number // blur radius in pixels
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChannel(effect: Effect, channel: string) {
  return effect.keyframes.filter((k) => (k as { channel?: string }).channel === channel)
}

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

/**
 * Compute the blur region at the given clip time.
 * Reads keyframes on channels 'x', 'y', 'width', 'height'.
 * Falls back to effect.params when no keyframes exist for a channel.
 * The 'strength' param is always static (not keyframed).
 */
export function computeBlurRegion(effect: Effect, clipTime: number): BlurRegion {
  const kfX = getChannel(effect, 'x')
  const kfY = getChannel(effect, 'y')
  const kfW = getChannel(effect, 'width')
  const kfH = getChannel(effect, 'height')

  const x = kfX.length
    ? (interpolateKeyframes(kfX, clipTime) ?? 0)
    : ((effect.params.x as number | undefined) ?? 0)

  const y = kfY.length
    ? (interpolateKeyframes(kfY, clipTime) ?? 0)
    : ((effect.params.y as number | undefined) ?? 0)

  const width = kfW.length
    ? (interpolateKeyframes(kfW, clipTime) ?? 100)
    : ((effect.params.width as number | undefined) ?? 100)

  const height = kfH.length
    ? (interpolateKeyframes(kfH, clipTime) ?? 60)
    : ((effect.params.height as number | undefined) ?? 60)

  const strength = (effect.params.strength as number | undefined) ?? 10

  return { x, y, width, height, strength }
}

/**
 * Render a blur/redact region onto a canvas context.
 *
 * Copies the source pixels from the canvas into a small offscreen canvas,
 * then redraws them with a CSS blur filter applied, producing a pixelated
 * / blurred appearance over the underlying content.
 *
 * Falls back to a semi-opaque black overlay when an offscreen canvas is
 * unavailable (e.g. in test environments where canvas is not implemented).
 */
export function renderBlurRegion(ctx: CanvasRenderingContext2D, region: BlurRegion): void {
  const { x, y, width, height, strength } = region
  if (width <= 0 || height <= 0) return

  // Access the backing canvas so we can copy pixels
  const sourceCanvas = (ctx as CanvasRenderingContext2D & { canvas?: HTMLCanvasElement }).canvas

  if (sourceCanvas) {
    try {
      const w = Math.ceil(width)
      const h = Math.ceil(height)
      let offscreen: HTMLCanvasElement | OffscreenCanvas | null = null
      let offCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null

      if (typeof OffscreenCanvas !== 'undefined') {
        const oc = new OffscreenCanvas(w, h)
        offCtx = oc.getContext('2d') as OffscreenCanvasRenderingContext2D | null
        offscreen = oc
      } else if (typeof document !== 'undefined') {
        const el = document.createElement('canvas')
        el.width = w
        el.height = h
        offCtx = el.getContext('2d')
        offscreen = el
      }

      if (offscreen && offCtx) {
        // Copy the region from the main canvas into the offscreen canvas
        offCtx.drawImage(sourceCanvas, x, y, width, height, 0, 0, w, h)
        // Redraw with blur filter applied
        ctx.save()
        ctx.filter = `blur(${strength}px)`
        ctx.drawImage(offscreen as CanvasImageSource, 0, 0, w, h, x, y, width, height)
        ctx.restore()
        return
      }
    } catch {
      // Fall through to opaque fallback
    }
  }

  // Fallback: solid black overlay (redact rather than blur)
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillRect(x, y, width, height)
  ctx.restore()
}
