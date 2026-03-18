/**
 * Export progress utilities.
 *
 * Pure helpers for:
 *  - Parsing progress percentage from FFmpeg stderr log lines
 *  - Converting the @ffmpeg/ffmpeg ProgressEvent ratio to a percentage
 *  - Managing export state transitions (idle → running → done / cancelled / error)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportStatus = 'idle' | 'running' | 'cancelled' | 'done' | 'error'

export interface ExportProgress {
  status: ExportStatus
  /** Progress percentage 0–100. Meaningful only when status is 'running' or 'done'. */
  percent: number
  /** Present when status is 'error'. */
  errorMessage?: string
}

// ---------------------------------------------------------------------------
// FFmpeg stderr parser
// ---------------------------------------------------------------------------

/**
 * Extract the current encoded time (in seconds) from an FFmpeg log line.
 *
 * FFmpeg writes progress lines to stderr in the form:
 *   frame=  123 fps= 25 q=18.0 size=  512kB time=00:00:05.12 bitrate=819.2kbits/s speed=1.05x
 *
 * Returns null when the line does not contain a `time=` field or when the
 * time value is negative (FFmpeg uses time=-577014:32:22.77 as a sentinel).
 */
export function parseTimeFromFFmpegLog(logLine: string): number | null {
  const match = logLine.match(/time=(-?\d+):(\d{2}):(\d{2}(?:\.\d+)?)/)
  if (!match) return null

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseFloat(match[3])

  const total = hours * 3600 + minutes * 60 + seconds
  // Negative sentinels emitted by FFmpeg before encoding starts
  if (total < 0) return null

  return total
}

/**
 * Convert a current-time / total-duration pair into a 0–100 percentage.
 *
 * Clamps the result to [0, 100].
 */
export function timeToPercent(currentSec: number, totalSec: number): number {
  if (totalSec <= 0) return 0
  return Math.min(100, Math.max(0, (currentSec / totalSec) * 100))
}

/**
 * Convert the `progress` field of an @ffmpeg/ffmpeg ProgressEvent (0–1 ratio)
 * to a 0–100 percentage, clamped to [0, 100].
 */
export function progressRatioToPercent(ratio: number): number {
  return Math.min(100, Math.max(0, ratio * 100))
}

// ---------------------------------------------------------------------------
// State machine helpers (pure)
// ---------------------------------------------------------------------------

/** Return the initial idle state. */
export function createExportProgress(): ExportProgress {
  return { status: 'idle', percent: 0 }
}

/** Transition from idle → running. */
export function startExport(state: ExportProgress): ExportProgress {
  return { ...state, status: 'running', percent: 0, errorMessage: undefined }
}

/**
 * Update the running percentage.
 * No-op (returns current state) when status is not 'running'.
 */
export function updateProgress(state: ExportProgress, percent: number): ExportProgress {
  if (state.status !== 'running') return state
  return { ...state, percent: Math.min(100, Math.max(0, percent)) }
}

/** Transition to cancelled. */
export function cancelExport(state: ExportProgress): ExportProgress {
  return { ...state, status: 'cancelled' }
}

/** Transition to done (100%). */
export function completeExport(state: ExportProgress): ExportProgress {
  return { ...state, status: 'done', percent: 100 }
}

/** Transition to error. */
export function failExport(state: ExportProgress, errorMessage: string): ExportProgress {
  return { ...state, status: 'error', errorMessage }
}
