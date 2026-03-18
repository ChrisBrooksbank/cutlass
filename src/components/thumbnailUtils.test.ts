import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractVideoThumbnail, clearThumbnailCache, thumbnailCacheSize } from './thumbnailUtils'

// Minimal fake for HTMLVideoElement used in tests
function makeFakeVideo(opts: { failLoad?: boolean; duration?: number } = {}) {
  const { failLoad = false, duration = 10 } = opts
  const video = {
    preload: '',
    muted: false,
    playsInline: false,
    src: '',
    currentTime: 0,
    duration,
    onloadedmetadata: null as (() => void) | null,
    onseeked: null as (() => void) | null,
    onerror: null as (() => void) | null,
  }

  // Simulate seek completion synchronously after currentTime is set
  const originalDescriptor = Object.getOwnPropertyDescriptor(video, 'currentTime')
  Object.defineProperty(video, 'currentTime', {
    get() {
      return originalDescriptor?.get?.call(video) ?? (video as unknown as { _ct: number })._ct ?? 0
    },
    set(v: number) {
      ;(video as unknown as { _ct: number })._ct = v
      if (!failLoad && video.onseeked) {
        Promise.resolve().then(() => video.onseeked?.())
      }
    },
  })

  // Simulate metadata load when src is assigned
  Object.defineProperty(video, 'src', {
    get() {
      return (video as unknown as { _src: string })._src ?? ''
    },
    set(v: string) {
      ;(video as unknown as { _src: string })._src = v
      if (failLoad) {
        Promise.resolve().then(() => video.onerror?.())
      } else {
        Promise.resolve().then(() => video.onloadedmetadata?.())
      }
    },
  })

  return video
}

function makeFakeCanvas(dataUrl = 'data:image/jpeg;base64,FAKE') {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    }),
    toDataURL: vi.fn().mockReturnValue(dataUrl),
  }
}

describe('extractVideoThumbnail', () => {
  beforeEach(() => {
    clearThumbnailCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves with a data URL from the canvas', async () => {
    const fakeVideo = makeFakeVideo()
    const fakeCanvas = makeFakeCanvas('data:image/jpeg;base64,ABC')

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return fakeVideo as unknown as HTMLElement
      if (tag === 'canvas') return fakeCanvas as unknown as HTMLElement
      return document.createElement(tag)
    })

    const result = await extractVideoThumbnail('blob:fake', 2)
    expect(result).toBe('data:image/jpeg;base64,ABC')
  })

  it('caches results and does not create a second video element for the same key', async () => {
    const fakeVideo = makeFakeVideo()
    const fakeCanvas = makeFakeCanvas('data:image/jpeg;base64,CACHED')
    let videoCreateCount = 0

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') {
        videoCreateCount++
        return fakeVideo as unknown as HTMLElement
      }
      if (tag === 'canvas') return fakeCanvas as unknown as HTMLElement
      return document.createElement(tag)
    })

    await extractVideoThumbnail('blob:same', 3)
    expect(thumbnailCacheSize()).toBe(1)

    // Second call should hit cache
    const result = await extractVideoThumbnail('blob:same', 3)
    expect(result).toBe('data:image/jpeg;base64,CACHED')
    expect(videoCreateCount).toBe(1) // video created only once
  })

  it('uses separate cache entries for different times', async () => {
    let callIndex = 0
    const dataUrls = ['data:image/jpeg;base64,TIME0', 'data:image/jpeg;base64,TIME5']

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return makeFakeVideo() as unknown as HTMLElement
      if (tag === 'canvas') return makeFakeCanvas(dataUrls[callIndex++]) as unknown as HTMLElement
      return document.createElement(tag)
    })

    const r0 = await extractVideoThumbnail('blob:vid', 0)
    const r5 = await extractVideoThumbnail('blob:vid', 5)
    expect(r0).toBe('data:image/jpeg;base64,TIME0')
    expect(r5).toBe('data:image/jpeg;base64,TIME5')
    expect(thumbnailCacheSize()).toBe(2)
  })

  it('rejects when the video fails to load', async () => {
    const fakeVideo = makeFakeVideo({ failLoad: true })

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return fakeVideo as unknown as HTMLElement
      return document.createElement(tag)
    })

    await expect(extractVideoThumbnail('blob:bad', 0)).rejects.toThrow()
  })

  it('clamps seek time to video duration', async () => {
    const fakeVideo = makeFakeVideo({ duration: 5 })
    const fakeCanvas = makeFakeCanvas()
    const setCurrentTimeSpy = vi.fn()

    // Intercept currentTime setter to record value
    let setTime: number | undefined
    Object.defineProperty(fakeVideo, 'currentTime', {
      get: () => setTime ?? 0,
      set: (v: number) => {
        setTime = v
        Promise.resolve().then(() => fakeVideo.onseeked?.())
      },
    })

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return fakeVideo as unknown as HTMLElement
      if (tag === 'canvas') return fakeCanvas as unknown as HTMLElement
      return document.createElement(tag)
    })
    void setCurrentTimeSpy // suppress unused warning

    await extractVideoThumbnail('blob:clamp', 999)
    expect(setTime).toBe(5) // clamped to duration
  })
})

describe('clearThumbnailCache', () => {
  beforeEach(() => {
    clearThumbnailCache()
    vi.restoreAllMocks()
  })

  it('empties the cache', async () => {
    const fakeVideo = makeFakeVideo()
    const fakeCanvas = makeFakeCanvas()

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return fakeVideo as unknown as HTMLElement
      if (tag === 'canvas') return fakeCanvas as unknown as HTMLElement
      return document.createElement(tag)
    })

    await extractVideoThumbnail('blob:x', 0)
    expect(thumbnailCacheSize()).toBe(1)

    clearThumbnailCache()
    expect(thumbnailCacheSize()).toBe(0)
  })
})
