import { TRACK_HEIGHT, TRACK_HEADER_WIDTH } from './timelineUtils'

/** Clip fill colors by track type (normal state). */
export const CLIP_COLOR: Record<string, string> = {
  video: '#3b82f6',
  audio: '#10b981',
  annotation: '#f59e0b',
}

/** Clip fill colors by track type (selected state). */
export const CLIP_COLOR_SELECTED: Record<string, string> = {
  video: '#93c5fd',
  audio: '#6ee7b7',
  annotation: '#fde68a',
}

/** Padding inside each clip block (px). */
export const CLIP_PADDING = 2

/** Corner radius for clip rectangles (px). */
export const CLIP_CORNER_RADIUS = 3

/**
 * Compute the canvas X position of a clip's left edge within the Konva layer.
 * Accounts for scrollLeft so the result is the screen-space x.
 */
export function clipCanvasX(
  startTime: number,
  pixelsPerSecond: number,
  scrollLeft: number,
): number {
  return TRACK_HEADER_WIDTH + startTime * pixelsPerSecond - scrollLeft
}

/** Compute the canvas Y position of a clip (top of its track row). */
export function clipCanvasY(trackIndex: number): number {
  return trackIndex * TRACK_HEIGHT
}

/** Compute the canvas width of a clip (may be < 1 if very short). */
export function clipCanvasWidth(duration: number, pixelsPerSecond: number): number {
  return Math.max(1, duration * pixelsPerSecond)
}

/**
 * Convert a canvas X position back to a timeline startTime (seconds).
 * Clamps to >= 0.
 */
export function canvasXToStartTime(
  canvasX: number,
  pixelsPerSecond: number,
  scrollLeft: number,
): number {
  return Math.max(0, (canvasX - TRACK_HEADER_WIDTH + scrollLeft) / pixelsPerSecond)
}

/**
 * Convert a canvas Y position (within the tracks area, i.e. below the ruler)
 * to a track index. Clamps to [0, trackCount - 1].
 */
export function canvasYToTrackIndex(canvasY: number, trackCount: number): number {
  const raw = Math.floor((canvasY + TRACK_HEIGHT / 2) / TRACK_HEIGHT)
  return Math.max(0, Math.min(trackCount - 1, raw))
}
