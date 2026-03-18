export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

export const SPEED_MIN = 0.25
export const SPEED_MAX = 4

export function formatSpeed(speed: number): string {
  const rounded = Math.round(speed * 100) / 100
  return `${rounded}x`
}

export function clampSpeed(speed: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed))
}

/**
 * Recalculate timeline duration when speed changes.
 * duration = (sourceOut - sourceIn) / newSpeed
 */
export function durationAtSpeed(sourceIn: number, sourceOut: number, speed: number): number {
  return (sourceOut - sourceIn) / clampSpeed(speed)
}
