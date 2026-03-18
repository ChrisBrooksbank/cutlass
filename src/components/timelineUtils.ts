export const PPS_MIN = 10 // pixels per second minimum
export const PPS_MAX = 2000 // pixels per second maximum

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
