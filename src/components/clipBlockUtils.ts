import type { Track } from '@/store/types'
import { TRACK_HEIGHT, TRACK_HEADER_WIDTH } from './timelineUtils'

/** Width of the trim handle hit area in pixels. */
export const TRIM_HANDLE_WIDTH = 6

/** Minimum clip duration in seconds to prevent collapsing to zero. */
export const MIN_CLIP_DURATION = 0.1

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

/**
 * Compute new startTime and duration when dragging the left trim handle.
 *
 * @param originalStartTime - clip's startTime before trimming begins
 * @param originalDuration  - clip's duration before trimming begins
 * @param originalSourceIn  - clip's sourceIn before trimming begins (seconds)
 * @param deltaTime         - how far the handle moved in timeline seconds (positive = trim inward)
 * @returns clamped { startTime, duration }
 */
export function computeTrimLeft(
  originalStartTime: number,
  originalDuration: number,
  originalSourceIn: number,
  deltaTime: number,
): { startTime: number; duration: number } {
  // Can't trim further left than source start (sourceIn would go negative)
  const minDelta = -originalSourceIn
  // Can't trim so far right that duration drops below minimum
  const maxDelta = originalDuration - MIN_CLIP_DURATION
  const clamped = Math.max(minDelta, Math.min(maxDelta, deltaTime))
  // Also clamp resulting startTime to >= 0
  const startTime = Math.max(0, originalStartTime + clamped)
  const actualDelta = startTime - originalStartTime
  return { startTime, duration: originalDuration - actualDelta }
}

/**
 * Compute new duration when dragging the right trim handle.
 *
 * @param originalDuration  - clip's duration before trimming begins
 * @param originalSourceOut - clip's sourceOut before trimming begins (seconds)
 * @param deltaTime         - how far the handle moved in timeline seconds (positive = extend)
 * @param mediaDuration     - total source media duration (Infinity if unknown)
 * @returns clamped { duration }
 */
export function computeTrimRight(
  originalDuration: number,
  originalSourceOut: number,
  deltaTime: number,
  mediaDuration: number,
): { duration: number } {
  // Can't trim so far left that duration drops below minimum
  const minDelta = -(originalDuration - MIN_CLIP_DURATION)
  // Can't extend beyond the end of the source media
  const maxDelta = mediaDuration - originalSourceOut
  const clamped = Math.max(minDelta, Math.min(maxDelta, deltaTime))
  return { duration: originalDuration + clamped }
}

/**
 * Collect snap targets for a clip being moved or trimmed.
 * Includes all clip boundary times from all tracks except the specified clip,
 * plus the current playhead time.
 * Returns times sorted ascending.
 */
export function getSnapTargetsExcluding(
  allTracks: Track[],
  excludeClipId: string,
  playheadTime: number,
): number[] {
  const times = new Set<number>()
  times.add(playheadTime)
  for (const track of allTracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue
      times.add(clip.startTime)
      times.add(clip.startTime + clip.duration)
    }
  }
  return Array.from(times).sort((a, b) => a - b)
}
