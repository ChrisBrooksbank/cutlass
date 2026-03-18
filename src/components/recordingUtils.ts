export type RecordingStatus = 'idle' | 'recording' | 'paused'

/**
 * Format elapsed recording seconds as MM:SS.
 */
export function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function canPause(status: RecordingStatus): boolean {
  return status === 'recording'
}

export function canResume(status: RecordingStatus): boolean {
  return status === 'paused'
}

export function canStop(status: RecordingStatus): boolean {
  return status === 'recording' || status === 'paused'
}

/**
 * Pick the best supported WebM MIME type from an array of supported types.
 * Separated from MediaRecorder.isTypeSupported for testability.
 */
export function pickBestMimeType(supportedTypes: string[]): string {
  const preferred = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  for (const t of preferred) {
    if (supportedTypes.includes(t)) return t
  }
  return 'video/webm'
}

/**
 * Detect the best available WebM MIME type for MediaRecorder at runtime.
 */
export function getPreferredMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  if (typeof MediaRecorder === 'undefined') return 'video/webm'
  return pickBestMimeType(candidates.filter((t) => MediaRecorder.isTypeSupported(t)))
}
