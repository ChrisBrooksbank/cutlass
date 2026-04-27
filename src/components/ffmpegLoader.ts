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
 *
 * toBlobURL is used so Vite's dev-server does not intercept the /public files
 * as ES module imports (which it would refuse). Instead the files are fetched
 * via HTTP and turned into blob: URLs that @ffmpeg/ffmpeg can import freely.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import type { LogEvent, ProgressEvent } from '@ffmpeg/ffmpeg'

/** Local base URL for the multi-threaded ffmpeg-core (requires SharedArrayBuffer). */
const MT_CORE_BASE = '/ffmpeg-core-mt'

/** Local base URL for the single-threaded ffmpeg-core fallback. */
const ST_CORE_BASE = '/ffmpeg-core-st'

/** CDN base URLs (version-pinned) for opt-in CDN mode via VITE_FFMPEG_CDN env var. */
const CDN_MT_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.9/dist/esm'
const CDN_ST_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.9/dist/esm'

/** Whether CDN mode is enabled via the VITE_FFMPEG_CDN environment variable. */
const USE_CDN = import.meta.env.VITE_FFMPEG_CDN === 'true'

/**
 * Multi-threaded FFmpeg is faster but has been less reliable in-browser for
 * long encodes. Keep it opt-in so production exports prefer the stable core.
 */
const ENABLE_MT = import.meta.env.VITE_FFMPEG_ENABLE_MT === 'true'

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

/**
 * Returns true when the multi-threaded FFmpeg core can be used.
 *
 * FFmpeg's pthread build requires SharedArrayBuffer and a cross-origin isolated
 * page. In older browsers the global may be absent, so we only reject an
 * explicit `false`.
 */
export function supportsMultiThreadFFmpeg(): boolean {
  return ENABLE_MT && supportsSharedArrayBuffer() && globalThis.crossOriginIsolated !== false
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
    const base = mtBase ?? (USE_CDN ? CDN_MT_CORE_BASE : MT_CORE_BASE)
    return {
      coreURL: `${base}/ffmpeg-core.js`,
      wasmURL: `${base}/ffmpeg-core.wasm`,
      workerURL: `${base}/ffmpeg-core.worker.js`,
    }
  }
  const base = stBase ?? (USE_CDN ? CDN_ST_CORE_BASE : ST_CORE_BASE)
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
 * toBlobURL converts each asset URL to a blob: URL by fetching it over HTTP.
 * This prevents Vite's dev-server from trying to transform /public files as
 * ES module imports (which it refuses for files in the public directory).
 *
 * @returns A fully loaded FFmpeg instance ready for `exec()` calls.
 */
export async function loadFFmpeg(options: FFmpegLoadOptions = {}): Promise<FFmpeg> {
  const candidates = supportsMultiThreadFFmpeg() ? [true, false] : [false]

  // Retry up to 2 times with exponential backoff for network resilience.
  const MAX_RETRIES = 2

  for (const useMultiThread of candidates) {
    const rawURLs = buildFFmpegCoreURLs(useMultiThread, options.mtCoreBase, options.stCoreBase)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const ffmpeg = new FFmpeg()

      if (options.onLog) {
        ffmpeg.on('log', options.onLog)
      }
      if (options.onProgress) {
        ffmpeg.on('progress', options.onProgress)
      }

      try {
        // Convert raw paths to blob: URLs so @ffmpeg/ffmpeg can import() them
        // without Vite intercepting the /public files as module transforms.
        const coreURL = await toBlobURL(rawURLs.coreURL, 'text/javascript')
        const wasmURL = await toBlobURL(rawURLs.wasmURL, 'application/wasm')

        const loadConfig =
          useMultiThread && rawURLs.workerURL
            ? {
                coreURL,
                wasmURL,
                workerURL: await toBlobURL(rawURLs.workerURL, 'text/javascript'),
              }
            : { coreURL, wasmURL }

        await ffmpeg.load(loadConfig)
        return ffmpeg
      } catch (err) {
        try {
          ffmpeg.terminate()
        } catch {
          // Nothing to terminate if the worker never finished starting.
        }

        if (attempt < MAX_RETRIES) {
          const delay = 1000 * 2 ** attempt // 1s, 2s
          await new Promise((r) => setTimeout(r, delay))
          continue
        }

        if (useMultiThread && candidates.length > 1) {
          break
        }

        const message = err instanceof Error ? err.message : String(err)
        throw new Error(
          `Failed to load FFmpeg: ${message}. ` +
            'This may be caused by missing assets, network issues, or an unsupported browser.',
        )
      }
    }
  }

  throw new Error('Failed to load FFmpeg.')
}
