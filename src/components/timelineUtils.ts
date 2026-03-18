export const PPS_MIN = 10 // pixels per second minimum
export const PPS_MAX = 2000 // pixels per second maximum

export const RULER_HEIGHT = 24 // px height of the time ruler
const MIN_TICK_SPACING = 60 // minimum px gap between major ticks

// Candidate tick intervals in seconds (ascending order)
const TICK_INTERVALS = [
  1 / 30, // 1 frame at 30 fps
  1 / 10,
  1 / 5,
  1 / 2,
  1,
  2,
  5,
  10,
  15,
  30,
  60,
  120,
  300,
  600,
  1800,
  3600,
]

/** Return the smallest tick interval (seconds) that keeps ticks ≥ MIN_TICK_SPACING apart. */
export function getRulerTickInterval(pixelsPerSecond: number): number {
  for (const interval of TICK_INTERVALS) {
    if (interval * pixelsPerSecond >= MIN_TICK_SPACING) {
      return interval
    }
  }
  return TICK_INTERVALS[TICK_INTERVALS.length - 1]
}

export interface RulerTick {
  time: number // seconds
  x: number // pixel offset relative to scrollLeft=0
  label: string
}

/** Format a time value as a human-readable label appropriate for the given interval. */
export function formatRulerTime(seconds: number, interval: number): string {
  if (interval < 1) {
    // Frame level – show s:ff (30 fps)
    const s = Math.floor(seconds)
    const frame = Math.round((seconds - s) * 30)
    return `${s}:${String(frame).padStart(2, '0')}`
  }
  if (interval < 60) {
    // Second level
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
  }
  // Minute level
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m}m`
}

/**
 * Compute the tick marks visible in the current viewport.
 *
 * @param pixelsPerSecond  Current zoom level
 * @param scrollLeft       Horizontal scroll offset in pixels
 * @param viewportWidth    Width of the scrollable canvas area (excluding track header)
 */
export function getRulerTicks(
  pixelsPerSecond: number,
  scrollLeft: number,
  viewportWidth: number,
): RulerTick[] {
  const interval = getRulerTickInterval(pixelsPerSecond)
  const startTime = scrollLeft / pixelsPerSecond
  const endTime = (scrollLeft + viewportWidth) / pixelsPerSecond

  const firstTick = Math.floor(startTime / interval) * interval
  const ticks: RulerTick[] = []
  let t = firstTick
  while (t <= endTime + interval) {
    ticks.push({
      time: t,
      x: t * pixelsPerSecond - scrollLeft,
      label: formatRulerTime(t, interval),
    })
    t = Math.round((t + interval) * 1e9) / 1e9 // avoid float drift
    if (ticks.length > 2000) break
  }
  return ticks
}

/** Convert a timeline time (seconds) to a canvas x-offset in pixels. */
export function timeToPixel(time: number, pixelsPerSecond: number): number {
  return time * pixelsPerSecond
}

/** Convert a canvas x-offset in pixels back to timeline time (seconds). */
export function pixelToTime(px: number, pixelsPerSecond: number): number {
  return px / pixelsPerSecond
}

/** Clamp pixelsPerSecond to the allowed zoom range. */
export function clampPps(pps: number): number {
  return Math.min(PPS_MAX, Math.max(PPS_MIN, pps))
}

/**
 * Zoom the timeline around a focal canvas pixel, keeping that pixel's
 * timeline time fixed after the zoom.
 *
 * @param currentPps    Current pixels-per-second
 * @param currentScrollLeft  Current horizontal scroll offset (pixels)
 * @param focalPx       X position within the scrollable canvas area
 * @param scaleFactor   Zoom multiplier (>1 zooms in, <1 zooms out)
 * @returns New { pps, scrollLeft }
 */
export function zoomAroundPoint(
  currentPps: number,
  currentScrollLeft: number,
  focalPx: number,
  scaleFactor: number,
): { pps: number; scrollLeft: number } {
  const newPps = clampPps(currentPps * scaleFactor)
  // Time at the focal pixel must remain constant after zoom
  const timeAtFocal = (focalPx + currentScrollLeft) / currentPps
  const newScrollLeft = Math.max(0, timeAtFocal * newPps - focalPx)
  return { pps: newPps, scrollLeft: newScrollLeft }
}
