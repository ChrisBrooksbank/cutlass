/**
 * Thumbnail generation utilities.
 *
 * Provides helpers to:
 *  - Seek a video URL to a given time and capture a JPEG data URL
 *    (with LRU-style in-memory cache).
 *  - Trigger a browser PNG download from the current preview video element.
 */

// ---------------------------------------------------------------------------
// Internal cache
// ---------------------------------------------------------------------------

/** Cache key: "<url>@<seekTime>" → data URL */
const thumbnailCache = new Map<string, string>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a video from `url`, seek to `seekTime` (in seconds), and return a
 * JPEG data URL of that frame.
 *
 * Results are cached by `"<url>@<seekTime>"` so repeat calls with the same
 * arguments are O(1) after the first request.
 *
 * @param url      - Object URL or any URL loadable by an HTMLVideoElement.
 * @param seekTime - Time in seconds to seek to. Clamped to [0, duration].
 * @param width    - Output canvas width in pixels (default 160).
 * @param height   - Output canvas height in pixels (default 90).
 */
export function extractVideoThumbnail(
  url: string,
  seekTime: number,
  width = 160,
  height = 90,
): Promise<string> {
  const cacheKey = `${url}@${seekTime}`
  const cached = thumbnailCache.get(cacheKey)
  if (cached !== undefined) return Promise.resolve(cached)

  return new Promise<string>((resolve, reject) => {
    const video = document.createElement('video') as HTMLVideoElement
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      // Clamp seek time to valid range
      const clampedTime = Math.min(Math.max(0, seekTime), video.duration)
      video.currentTime = clampedTime
    }

    video.onseeked = () => {
      const draw = () => {
        try {
          const canvas = document.createElement('canvas') as HTMLCanvasElement
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not get 2d canvas context'))
            return
          }
          ctx.drawImage(video, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg')
          thumbnailCache.set(cacheKey, dataUrl)
          resolve(dataUrl)
        } catch (err) {
          reject(err)
        }
      }

      // Use requestVideoFrameCallback when available to ensure the frame is
      // fully decoded/painted before capturing. Fall back to rAF.
      if ('requestVideoFrameCallback' in video) {
        (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void })
          .requestVideoFrameCallback(draw)
      } else {
        requestAnimationFrame(draw)
      }
    }

    video.onerror = () => reject(new Error(`Failed to load video: ${url}`))

    video.src = url
  })
}

/**
 * Clear the in-memory thumbnail cache.
 */
export function clearThumbnailCache(): void {
  thumbnailCache.clear()
}

/**
 * Return the current number of entries in the thumbnail cache.
 */
export function thumbnailCacheSize(): number {
  return thumbnailCache.size
}

// ---------------------------------------------------------------------------
// Frame capture from a live video element
// ---------------------------------------------------------------------------

/**
 * Draw the current frame of an already-seeked video element onto a canvas
 * and return a PNG data URL.
 *
 * @param video  - The HTMLVideoElement to capture from.
 * @param width  - Output canvas width in pixels.
 * @param height - Output canvas height in pixels.
 */
export function captureFrameFromVideo(
  video: HTMLVideoElement,
  width: number,
  height: number,
): string {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2d canvas context')
  ctx.drawImage(video, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

/**
 * Trigger a browser download of a data URL with the given filename.
 *
 * @param dataUrl  - Data URL (e.g. from canvas.toDataURL()).
 * @param filename - Suggested download filename (e.g. 'thumbnail.png').
 */
export function downloadThumbnail(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
