import type { EasingType, Keyframe } from '@/store/types'

/**
 * Format a keyframe time in seconds to a display string (e.g. "1.23s").
 */
export function formatKeyframeTime(seconds: number): string {
  return `${seconds.toFixed(2)}s`
}

/**
 * Return keyframes sorted ascending by time (non-mutating).
 */
export function sortKeyframesByTime(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.time - b.time)
}

/**
 * Clamp a time value to [min, max].
 */
export function clampTime(time: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, time))
}

export const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
]

/**
 * Return a human-readable label for an effect type string.
 * Unknown types fall back to a title-cased version of the type.
 */
export function getEffectDisplayName(effectType: string): string {
  const names: Record<string, string> = {
    zoom: 'Zoom / Pan',
    blur: 'Blur / Redact',
    cursor: 'Cursor Highlight',
    text: 'Text Overlay',
    crop: 'Crop',
  }
  return names[effectType] ?? effectType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
