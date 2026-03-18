import type { Effect } from '@/store/types'
import { interpolateKeyframes } from './keyframeUtils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KenBurnsTransform {
  scaleX: number
  scaleY: number
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChannel(effect: Effect, channel: string) {
  return effect.keyframes.filter((k) => k.channel === channel)
}

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

/**
 * Compute the Ken Burns viewport transform for the given effect at the given clip time.
 * Reads keyframes on channels 'scaleX', 'scaleY', 'x', 'y'.
 * Falls back to effect.params values when no keyframes are present for a channel.
 */
export function computeKenBurnsTransform(effect: Effect, clipTime: number): KenBurnsTransform {
  const kfScaleX = getChannel(effect, 'scaleX')
  const kfScaleY = getChannel(effect, 'scaleY')
  const kfX = getChannel(effect, 'x')
  const kfY = getChannel(effect, 'y')

  const scaleX = kfScaleX.length
    ? (interpolateKeyframes(kfScaleX, clipTime) ?? 1)
    : ((effect.params.scaleX as number | undefined) ?? 1)

  const scaleY = kfScaleY.length
    ? (interpolateKeyframes(kfScaleY, clipTime) ?? 1)
    : ((effect.params.scaleY as number | undefined) ?? 1)

  const x = kfX.length
    ? (interpolateKeyframes(kfX, clipTime) ?? 0)
    : ((effect.params.x as number | undefined) ?? 0)

  const y = kfY.length
    ? (interpolateKeyframes(kfY, clipTime) ?? 0)
    : ((effect.params.y as number | undefined) ?? 0)

  return { scaleX, scaleY, x, y }
}

/**
 * Apply a Ken Burns viewport transform to a canvas 2D context.
 *
 * The transform is centered on the canvas: scale is applied around the canvas
 * centre, then the x/y pan offset is added.
 *
 * The caller must wrap this call in ctx.save() / ctx.restore() to scope the
 * transform to a single draw operation.
 */
export function applyKenBurnsTransform(
  ctx: CanvasRenderingContext2D,
  transform: KenBurnsTransform,
  width: number,
  height: number,
): void {
  const { scaleX, scaleY, x, y } = transform
  // Translate to centre, scale, then translate back with pan offset
  ctx.translate(width / 2, height / 2)
  ctx.scale(scaleX, scaleY)
  ctx.translate(-width / 2 + x, -height / 2 + y)
}
