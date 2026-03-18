import type { EasingType, Keyframe } from '@/store/types'

/**
 * Apply an easing function to a normalized time value t ∈ [0, 1].
 */
export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
      return t
    case 'ease-in':
      return t * t
    case 'ease-out':
      return t * (2 - t)
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  }
}

/**
 * Interpolate a numeric value from a sorted list of keyframes at a given time.
 *
 * - Returns null if there are no keyframes.
 * - Clamps to the first/last value when outside the keyframe range.
 * - Uses the easing type of the *from* keyframe for the segment.
 */
export function interpolateKeyframes(keyframes: Keyframe[], time: number): number | null {
  if (keyframes.length === 0) return null

  const sorted = [...keyframes].sort((a, b) => a.time - b.time)

  if (time <= sorted[0].time) return sorted[0].value
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value

  let loIndex = 0
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].time <= time && time < sorted[i + 1].time) {
      loIndex = i
      break
    }
  }

  const from = sorted[loIndex]
  const to = sorted[loIndex + 1]
  const t = (time - from.time) / (to.time - from.time)
  const easedT = applyEasing(t, from.easing)
  return from.value + (to.value - from.value) * easedT
}
