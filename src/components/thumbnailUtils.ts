/**
 * Thumbnail extraction from video assets via hidden HTMLVideoElement + canvas seek.
 * Results are cached in-memory to avoid redundant extraction.
 */

const cache = new Map<string, string>()

/**
 * Extract a single-frame thumbnail from a video URL at the given time.
 * Returns a JPEG data URL. Caches results keyed on `url@time`.
 *
 * @param url  - Object URL or any URL the browser can load as a video source
 * @param time - Seek time in seconds (clamped to video duration)
 * @param width  - Output thumbnail width in pixels (default 160)
 * @param height - Output thumbnail height in pixels (default 90)
 */
export function extractVideoThumbnail(
  url: string,
  time: number,
  width = 160,
  height = 90,
): Promise<string> {
  const key = `${url}@${time}`
  if (cache.has(key)) return Promise.resolve(cache.get(key)!)

  return new Promise<string>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(time, video.duration)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get 2d context'))
          return
        }
        ctx.drawImage(video, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        cache.set(key, dataUrl)
        resolve(dataUrl)
      } catch (err) {
        reject(err)
      }
    }

    video.onerror = () => {
      reject(new Error(`Failed to load video: ${url}`))
    }

    video.src = url
  })
}

/** Clear the thumbnail cache (useful in tests). */
export function clearThumbnailCache(): void {
  cache.clear()
}

/** Return how many entries are in the cache (useful in tests). */
export function thumbnailCacheSize(): number {
  return cache.size
}
