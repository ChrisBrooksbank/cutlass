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
