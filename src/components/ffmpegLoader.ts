/**
 * FFmpeg.wasm loader utility.
 *
 * Loads FFmpeg in a Web Worker (the @ffmpeg/ffmpeg class does this internally).
 * Uses the multi-threaded core when SharedArrayBuffer is available
 * (requires Cross-Origin-Isolation headers: COOP + COEP), and falls back to
 * the single-threaded core otherwise.
 *
 * Assets are served locally from public/. Custom base URLs can be provided
 * via FFmpegLoadOptions for alternative deployments.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import type { LogEvent, ProgressEvent } from '@ffmpeg/ffmpeg'

/** Local base URL for the multi-threaded ffmpeg-core (requires SharedArrayBuffer). */
const MT_CORE_BASE = '/ffmpeg-core-mt'

/** Local base URL for the single-threaded ffmpeg-core fallback. */
const ST_CORE_BASE = '/ffmpeg-core-st'

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/**
 * Returns true when SharedArrayBuffer is available in the current context.
 *
 * SharedArrayBuffer requires Cross-Origin-Isolation (COOP + COEP headers) and
 * is necessary for the multi-threaded FFmpeg core.
 */
export function supportsSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== 'undefined'
}

// ---------------------------------------------------------------------------
// URL config builder (pure, testable without network)
// ---------------------------------------------------------------------------

export interface FFmpegCoreURLs {
  coreURL: string
  wasmURL: string
  /** Present only for the multi-threaded core. */
  workerURL?: string
}

/**
 * Build the URL configuration for loading FFmpeg core assets.
 *
 * @param multiThread - Whether to build URLs for the multi-threaded core.
 * @param mtBase - Override for the multi-threaded core base path.
 * @param stBase - Override for the single-threaded core base path.
 */
export function buildFFmpegCoreURLs(
  multiThread: boolean,
  mtBase?: string,
  stBase?: string,
): FFmpegCoreURLs {
  if (multiThread) {
    const base = mtBase ?? MT_CORE_BASE
    return {
      coreURL: `${base}/ffmpeg-core.js`,
      wasmURL: `${base}/ffmpeg-core.wasm`,
      workerURL: `${base}/ffmpeg-core.worker.js`,
    }
  }
  const base = stBase ?? ST_CORE_BASE
  return {
    coreURL: `${base}/ffmpeg-core.js`,
    wasmURL: `${base}/ffmpeg-core.wasm`,
  }
}

// ---------------------------------------------------------------------------
// High-level loader
// ---------------------------------------------------------------------------

export interface FFmpegLoadOptions {
  /**
   * Override base path for the multi-threaded core.
   * Useful for custom deployments or CDN hosting.
   */
  mtCoreBase?: string
  /**
   * Override base path for the single-threaded core fallback.
   * Useful for custom deployments or CDN hosting.
   */
  stCoreBase?: string
  /** Called for each FFmpeg log line (stdout + stderr). */
  onLog?: (event: LogEvent) => void
  /** Called periodically with export progress [0, 1]. */
  onProgress?: (event: ProgressEvent) => void
}

/**
 * Create and load an FFmpeg instance inside a Web Worker.
 *
 * The @ffmpeg/ffmpeg library automatically spawns a Web Worker internally,
 * keeping the encoding work off the main thread.
 *
 * Strategy:
 *  - SharedArrayBuffer available → load multi-threaded core (faster)
 *  - SharedArrayBuffer unavailable → load single-threaded core (fallback)
 *
 * @returns A fully loaded FFmpeg instance ready for `exec()` calls.
 */
export async function loadFFmpeg(options: FFmpegLoadOptions = {}): Promise<FFmpeg> {
  const ffmpeg = new FFmpeg()

  if (options.onLog) {
    ffmpeg.on('log', options.onLog)
  }
  if (options.onProgress) {
    ffmpeg.on('progress', options.onProgress)
  }

  const useMultiThread = supportsSharedArrayBuffer()
  const rawURLs = buildFFmpegCoreURLs(useMultiThread, options.mtCoreBase, options.stCoreBase)

  const { coreURL, wasmURL, workerURL } = rawURLs
  const loadConfig = useMultiThread && workerURL
    ? { coreURL, wasmURL, workerURL }
    : { coreURL, wasmURL }

  // Retry up to 2 times with exponential backoff for network resilience
  const MAX_RETRIES = 2
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await ffmpeg.load(loadConfig)
      break
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * 2 ** attempt // 1s, 2s
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Failed to load FFmpeg: ${message}. ` +
        'This may be caused by missing assets, network issues, or an unsupported browser.',
      )
    }
  }

  return ffmpeg
}
