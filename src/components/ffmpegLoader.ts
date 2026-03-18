/**
 * FFmpeg.wasm loader utility.
 *
 * Loads FFmpeg in a Web Worker (the @ffmpeg/ffmpeg class does this internally).
 * Uses the multi-threaded core when SharedArrayBuffer is available
 * (requires Cross-Origin-Isolation headers: COOP + COEP), and falls back to
 * the single-threaded core otherwise.
 *
 * CDN URLs point to the UMD bundles on unpkg. In production you may copy these
 * assets locally and pass custom base URLs via FFmpegLoadOptions.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import type { LogEvent, ProgressEvent } from '@ffmpeg/ffmpeg'

/** Core version aligned with the installed @ffmpeg/ffmpeg package. */
const CORE_VERSION = '0.12.9'

/** CDN base URL for the multi-threaded ffmpeg-core (requires SharedArrayBuffer). */
const MT_CORE_BASE = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd`

/** CDN base URL for the single-threaded ffmpeg-core fallback. */
const ST_CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`

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
 * @param mtBase - Override for the multi-threaded CDN base URL.
 * @param stBase - Override for the single-threaded CDN base URL.
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
   * Override CDN base URL for the multi-threaded core.
   * Useful when self-hosting the WASM assets.
   */
  mtCoreBase?: string
  /**
   * Override CDN base URL for the single-threaded core fallback.
   * Useful when self-hosting the WASM assets.
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

  try {
    // Convert raw URLs to Blob URLs so the browser can load them across origins.
    const coreURL = await toBlobURL(rawURLs.coreURL, 'text/javascript')
    const wasmURL = await toBlobURL(rawURLs.wasmURL, 'application/wasm')

    if (useMultiThread && rawURLs.workerURL) {
      const workerURL = await toBlobURL(rawURLs.workerURL, 'text/javascript')
      await ffmpeg.load({ coreURL, wasmURL, workerURL })
    } else {
      await ffmpeg.load({ coreURL, wasmURL })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to load FFmpeg: ${message}. ` +
      'This may be caused by network issues, CORS restrictions, or an unsupported browser.',
    )
  }

  return ffmpeg
}
