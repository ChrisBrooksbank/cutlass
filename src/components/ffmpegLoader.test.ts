import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  supportsSharedArrayBuffer,
  supportsMultiThreadFFmpeg,
  buildFFmpegCoreURLs,
} from './ffmpegLoader'

// ---------------------------------------------------------------------------
// supportsSharedArrayBuffer
// ---------------------------------------------------------------------------

describe('supportsSharedArrayBuffer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when SharedArrayBuffer is defined', () => {
    vi.stubGlobal('SharedArrayBuffer', class {})
    expect(supportsSharedArrayBuffer()).toBe(true)
  })

  it('returns false when SharedArrayBuffer is undefined', () => {
    vi.stubGlobal('SharedArrayBuffer', undefined)
    expect(supportsSharedArrayBuffer()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// supportsMultiThreadFFmpeg
// ---------------------------------------------------------------------------

describe('supportsMultiThreadFFmpeg', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when SharedArrayBuffer exists and isolation is not explicitly false', () => {
    vi.stubGlobal('SharedArrayBuffer', class {})
    vi.stubGlobal('crossOriginIsolated', true)
    expect(supportsMultiThreadFFmpeg()).toBe(true)
  })

  it('returns false when crossOriginIsolated is false', () => {
    vi.stubGlobal('SharedArrayBuffer', class {})
    vi.stubGlobal('crossOriginIsolated', false)
    expect(supportsMultiThreadFFmpeg()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildFFmpegCoreURLs
// ---------------------------------------------------------------------------

describe('buildFFmpegCoreURLs', () => {
  it('returns MT URLs (with workerURL) when multiThread=true', () => {
    const urls = buildFFmpegCoreURLs(true)
    expect(urls.coreURL).toContain('ffmpeg-core.js')
    expect(urls.wasmURL).toContain('ffmpeg-core.wasm')
    expect(urls.workerURL).toContain('ffmpeg-core.worker.js')
    // MT core should reference the "-mt" directory
    expect(urls.coreURL).toContain('ffmpeg-core-mt')
  })

  it('returns ST URLs (no workerURL) when multiThread=false', () => {
    const urls = buildFFmpegCoreURLs(false)
    expect(urls.coreURL).toContain('ffmpeg-core.js')
    expect(urls.wasmURL).toContain('ffmpeg-core.wasm')
    expect(urls.workerURL).toBeUndefined()
    // ST core should reference the "-st" directory
    expect(urls.coreURL).toContain('ffmpeg-core-st')
  })

  it('uses custom mtBase when provided', () => {
    const custom = 'https://cdn.example.com/ffmpeg-mt'
    const urls = buildFFmpegCoreURLs(true, custom)
    expect(urls.coreURL).toBe(`${custom}/ffmpeg-core.js`)
    expect(urls.wasmURL).toBe(`${custom}/ffmpeg-core.wasm`)
    expect(urls.workerURL).toBe(`${custom}/ffmpeg-core.worker.js`)
  })

  it('uses custom stBase when provided', () => {
    const custom = 'https://cdn.example.com/ffmpeg-st'
    const urls = buildFFmpegCoreURLs(false, undefined, custom)
    expect(urls.coreURL).toBe(`${custom}/ffmpeg-core.js`)
    expect(urls.wasmURL).toBe(`${custom}/ffmpeg-core.wasm`)
    expect(urls.workerURL).toBeUndefined()
  })

  it('MT URLs use local path', () => {
    const urls = buildFFmpegCoreURLs(true)
    expect(urls.coreURL).toBe('/ffmpeg-core-mt/ffmpeg-core.js')
  })

  it('ST URLs use local path', () => {
    const urls = buildFFmpegCoreURLs(false)
    expect(urls.coreURL).toBe('/ffmpeg-core-st/ffmpeg-core.js')
  })
})
