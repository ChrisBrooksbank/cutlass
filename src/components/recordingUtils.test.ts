import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatRecordingTime,
  canPause,
  canResume,
  canStop,
  pickBestMimeType,
  createMemoryChunkStorage,
  createChunkStorage,
} from './recordingUtils'

describe('formatRecordingTime', () => {
  it('formats zero as 00:00', () => {
    expect(formatRecordingTime(0)).toBe('00:00')
  })

  it('formats seconds under a minute', () => {
    expect(formatRecordingTime(5)).toBe('00:05')
    expect(formatRecordingTime(59)).toBe('00:59')
  })

  it('formats exactly one minute', () => {
    expect(formatRecordingTime(60)).toBe('01:00')
  })

  it('formats minutes and seconds', () => {
    expect(formatRecordingTime(90)).toBe('01:30')
    expect(formatRecordingTime(3661)).toBe('61:01')
  })

  it('floors fractional seconds', () => {
    expect(formatRecordingTime(59.9)).toBe('00:59')
  })
})

describe('canPause', () => {
  it('returns true only when recording', () => {
    expect(canPause('recording')).toBe(true)
    expect(canPause('idle')).toBe(false)
    expect(canPause('paused')).toBe(false)
  })
})

describe('canResume', () => {
  it('returns true only when paused', () => {
    expect(canResume('paused')).toBe(true)
    expect(canResume('idle')).toBe(false)
    expect(canResume('recording')).toBe(false)
  })
})

describe('canStop', () => {
  it('returns true when recording or paused', () => {
    expect(canStop('recording')).toBe(true)
    expect(canStop('paused')).toBe(true)
    expect(canStop('idle')).toBe(false)
  })
})

describe('pickBestMimeType', () => {
  it('prefers vp9+opus over vp8+opus', () => {
    const supported = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    expect(pickBestMimeType(supported)).toBe('video/webm;codecs=vp9,opus')
  })

  it('falls back to vp8+opus when vp9 unavailable', () => {
    const supported = ['video/webm;codecs=vp8,opus', 'video/webm']
    expect(pickBestMimeType(supported)).toBe('video/webm;codecs=vp8,opus')
  })

  it('falls back to plain webm', () => {
    const supported = ['video/webm']
    expect(pickBestMimeType(supported)).toBe('video/webm')
  })

  it('returns video/webm as default when nothing matches', () => {
    expect(pickBestMimeType([])).toBe('video/webm')
  })
})

describe('createMemoryChunkStorage', () => {
  it('accumulates chunks and returns a blob with the correct MIME type', async () => {
    const storage = createMemoryChunkStorage()
    await storage.write(new Blob(['hello']))
    await storage.write(new Blob([' world']))
    const blob = await storage.toBlob('video/webm')
    expect(blob.type).toBe('video/webm')
    expect(blob.size).toBe(11) // 'hello'.length + ' world'.length
  })

  it('returns empty blob after dispose', async () => {
    const storage = createMemoryChunkStorage()
    await storage.write(new Blob(['data']))
    await storage.dispose()
    const blob = await storage.toBlob('video/webm')
    expect(blob.size).toBe(0)
  })

  it('returns empty blob when no chunks written', async () => {
    const storage = createMemoryChunkStorage()
    const blob = await storage.toBlob('video/webm')
    expect(blob.size).toBe(0)
  })
})

describe('createChunkStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to memory storage when OPFS is unavailable', async () => {
    // navigator.storage is not available in jsdom — OPFS will throw
    const storage = await createChunkStorage('test-fallback.webm')
    await storage.write(new Blob(['chunk']))
    const blob = await storage.toBlob('video/webm')
    expect(blob.size).toBe(5)
    await storage.dispose()
  })
})
