import type { Effect } from '@/store/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CropRegion {
  x: number // left edge in project pixels
  y: number // top edge in project pixels
  width: number // crop width in project pixels
  height: number // crop height in project pixels
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CROP_MIN_SIZE = 1

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

/**
 * Compute the crop region from effect params.
 * Reads x, y, width, height from effect.params.
 * Width and height are clamped to at least CROP_MIN_SIZE.
 */
export function computeCropRegion(
  effect: Effect,
  defaultWidth = 1920,
  defaultHeight = 1080,
): CropRegion {
  const x = (effect.params.x as number | undefined) ?? 0
  const y = (effect.params.y as number | undefined) ?? 0
  const width = Math.max(CROP_MIN_SIZE, (effect.params.width as number | undefined) ?? defaultWidth)
  const height = Math.max(
    CROP_MIN_SIZE,
    (effect.params.height as number | undefined) ?? defaultHeight,
  )
  return { x, y, width, height }
}
