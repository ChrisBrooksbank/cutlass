import type { Track } from '@/store/types'

export type RecordingStatus = 'idle' | 'recording' | 'paused'

/**
 * Compute the timeline insert time for a new recording clip.
 * Returns the end time of the last clip across all video tracks,
 * or 0 if no video clips exist.
 */
export function computeTimelineInsertTime(tracks: Track[]): number {
  let maxEnd = 0
  for (const track of tracks) {
    if (track.type !== 'video') continue
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration
      if (end > maxEnd) maxEnd = end
    }
  }
  return maxEnd
}

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

/**
 * Abstraction over chunk storage for streamed WebM recording.
 * Implementations may write to OPFS or fall back to in-memory arrays.
 */
export interface ChunkStorage {
  /** Append a recorded chunk. */
  write(chunk: Blob): Promise<void>
  /** Assemble all chunks into a single Blob with the given MIME type. */
  toBlob(mimeType: string): Promise<Blob>
  /** Release any resources (temp files, memory). */
  dispose(): Promise<void>
}

/**
 * In-memory ChunkStorage. Fast but not suitable for very long recordings.
 * Used as the fallback when OPFS is unavailable.
 */
export function createMemoryChunkStorage(): ChunkStorage {
  const chunks: Blob[] = []
  return {
    async write(chunk: Blob) {
      chunks.push(chunk)
    },
    async toBlob(mimeType: string) {
      return new Blob(chunks, { type: mimeType })
    },
    async dispose() {
      chunks.length = 0
    },
  }
}

/**
 * OPFS-backed ChunkStorage. Writes each chunk to a temp file in the Origin
 * Private File System so heap memory stays bounded during long recordings.
 */
export async function createOPFSChunkStorage(filename: string): Promise<ChunkStorage> {
  const root = await navigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  let closed = false

  return {
    async write(chunk: Blob) {
      await writable.write(chunk)
    },
    async toBlob(mimeType: string) {
      if (!closed) {
        await writable.close()
        closed = true
      }
      const file = await fileHandle.getFile()
      return new Blob([await file.arrayBuffer()], { type: mimeType })
    },
    async dispose() {
      if (!closed) {
        try {
          await writable.close()
        } catch {
          /* already closed */
        }
        closed = true
      }
      try {
        const r = await navigator.storage.getDirectory()
        await r.removeEntry(filename)
      } catch {
        /* ignore — file may not exist */
      }
    },
  }
}

/**
 * Create the best available ChunkStorage for the current environment.
 * Tries OPFS first; falls back to in-memory if OPFS is not supported.
 */
export async function createChunkStorage(filename: string): Promise<ChunkStorage> {
  try {
    return await createOPFSChunkStorage(filename)
  } catch {
    return createMemoryChunkStorage()
  }
}

/**
 * Pick the best supported audio MIME type from an array of supported types.
 * Separated from MediaRecorder.isTypeSupported for testability.
 */
export function pickBestAudioMimeType(supportedTypes: string[]): string {
  const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
  for (const t of preferred) {
    if (supportedTypes.includes(t)) return t
  }
  return 'audio/webm'
}

/**
 * Detect the best available audio MIME type for MediaRecorder at runtime.
 */
export function getPreferredAudioMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  return pickBestAudioMimeType(candidates.filter((t) => MediaRecorder.isTypeSupported(t)))
}

/**
 * A single captured cursor position relative to the recording start.
 */
export interface CursorPoint {
  /** Seconds elapsed in the recording (excludes paused time). */
  t: number
  /** Viewport x coordinate (clientX). */
  x: number
  /** Viewport y coordinate (clientY). */
  y: number
}

/**
 * Controls for a cursor tracker attached to a DOM target.
 */
export interface CursorTracker {
  /** Call when recording starts; resets internal state. */
  start(): void
  /** Call when recording is paused; stops accumulating time. */
  pause(): void
  /** Call when recording is resumed; resumes accumulating time. */
  resume(): void
  /** Call when recording stops; removes listener and returns all points. */
  stop(): CursorPoint[]
}

/**
 * Create a cursor tracker that captures pointer positions during recording.
 * Listens to `pointermove` on `target` (defaults to `document`).
 * Timestamps are relative to recording start, excluding paused intervals.
 */
export function createCursorTracker(
  target: EventTarget = typeof document !== 'undefined' ? document : globalThis,
): CursorTracker {
  let points: CursorPoint[] = []
  let recordingStartMs = 0
  let pauseStartMs = 0
  let totalPausedMs = 0
  let active = false
  let paused = false
  let listenerAttached = false

  function onPointerMove(event: Event): void {
    if (!active) return
    const e = event as PointerEvent
    const t = (performance.now() - recordingStartMs - totalPausedMs) / 1000
    points.push({ t, x: e.clientX, y: e.clientY })
  }

  return {
    start() {
      points = []
      recordingStartMs = performance.now()
      totalPausedMs = 0
      pauseStartMs = 0
      paused = false
      active = true
      if (!listenerAttached) {
        target.addEventListener('pointermove', onPointerMove)
        listenerAttached = true
      }
    },
    pause() {
      active = false
      paused = true
      pauseStartMs = performance.now()
    },
    resume() {
      if (!paused) return
      totalPausedMs += performance.now() - pauseStartMs
      paused = false
      active = true
    },
    stop() {
      active = false
      paused = false
      if (listenerAttached) {
        target.removeEventListener('pointermove', onPointerMove)
        listenerAttached = false
      }
      return [...points]
    },
  }
}

/**
 * Compute the timeline insert time for a new voiceover clip.
 * Returns the end time of the last clip across all audio tracks,
 * or 0 if no audio clips exist.
 */
export function computeVoiceoverInsertTime(tracks: Track[]): number {
  let maxEnd = 0
  for (const track of tracks) {
    if (track.type !== 'audio') continue
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration
      if (end > maxEnd) maxEnd = end
    }
  }
  return maxEnd
}
