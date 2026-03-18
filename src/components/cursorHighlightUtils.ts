import type { Effect, Keyframe } from '@/store/types'
import { interpolateKeyframes } from './keyframeUtils'
import type { CursorPoint } from './recordingUtils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A keyframe that carries a channel discriminator ('x' or 'y').
 * Extends the base Keyframe interface with a channel property used by the
 * cursor highlight effect renderer.
 */
export interface CursorKeyframe extends Keyframe {
  channel: 'x' | 'y'
}

export interface CursorPosition {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

/**
 * Convert an array of recorded CursorPoints into cursor-effect keyframes.
 *
 * Each CursorPoint contributes two keyframes: one on channel 'x' and one
 * on channel 'y'.  Viewport coordinates are mapped to project pixels using
 * the supplied viewport and project dimensions.
 *
 * @param points       Timestamped cursor positions from the recording session.
 * @param viewportWidth   Width of the recording viewport (e.g. screen width in CSS px).
 * @param viewportHeight  Height of the recording viewport.
 * @param projectWidth    Width of the video project in pixels (e.g. 1920).
 * @param projectHeight   Height of the video project in pixels (e.g. 1080).
 */
export function buildCursorKeyframes(
  points: CursorPoint[],
  viewportWidth: number,
  viewportHeight: number,
  projectWidth: number,
  projectHeight: number,
): CursorKeyframe[] {
  if (viewportWidth <= 0 || viewportHeight <= 0) return []

  const scaleX = projectWidth / viewportWidth
  const scaleY = projectHeight / viewportHeight
  const keyframes: CursorKeyframe[] = []

  points.forEach((pt, index) => {
    keyframes.push({
      id: `cursor-x-${index}`,
      time: pt.t,
      value: pt.x * scaleX,
      easing: 'linear',
      channel: 'x',
    })
    keyframes.push({
      id: `cursor-y-${index}`,
      time: pt.t,
      value: pt.y * scaleY,
      easing: 'linear',
      channel: 'y',
    })
  })

  return keyframes
}

/**
 * Compute the cursor position in project pixels at the given clip time.
 * Returns null when the effect has no cursor keyframes or the time is
 * outside the range where cursor data was captured.
 */
export function computeCursorPosition(effect: Effect, clipTime: number): CursorPosition | null {
  const kfX = effect.keyframes.filter((k) => (k as CursorKeyframe).channel === 'x')
  const kfY = effect.keyframes.filter((k) => (k as CursorKeyframe).channel === 'y')
  if (!kfX.length || !kfY.length) return null

  const x = interpolateKeyframes(kfX, clipTime)
  const y = interpolateKeyframes(kfY, clipTime)
  if (x === null || y === null) return null

  return { x, y }
}

/**
 * Draw a cursor highlight circle (or spotlight) onto the given canvas context.
 * The circle is drawn at (x, y) with the given radius and fill color.
 */
export function renderCursorHighlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}
