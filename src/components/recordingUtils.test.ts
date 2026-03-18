import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatRecordingTime,
  canPause,
  canResume,
  canStop,
  pickBestMimeType,
  pickBestAudioMimeType,
  createMemoryChunkStorage,
  createChunkStorage,
  computeTimelineInsertTime,
  computeVoiceoverInsertTime,
  createCursorTracker,
} from './recordingUtils'
import type { Track } from '@/store/types'

function makeTrack(
  type: Track['type'],
  clips: Array<{ startTime: number; duration: number }>,
): Track {
  return {
    id: crypto.randomUUID(),
    type,
    name: type,
    muted: false,
    locked: false,
    volume: 1,
    clips: clips.map((c) => ({
      id: crypto.randomUUID(),
      trackId: '',
      sourceId: '',
      startTime: c.startTime,
      duration: c.duration,
      sourceIn: 0,
      sourceOut: c.duration,
      speed: 1,
      effects: [],
    })),
  }
}

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

describe('computeTimelineInsertTime', () => {
  it('returns 0 when there are no tracks', () => {
    expect(computeTimelineInsertTime([])).toBe(0)
  })

  it('returns 0 when there are only non-video tracks', () => {
    const tracks = [
      makeTrack('audio', [{ startTime: 0, duration: 10 }]),
      makeTrack('annotation', [{ startTime: 5, duration: 3 }]),
    ]
    expect(computeTimelineInsertTime(tracks)).toBe(0)
  })

  it('returns 0 when video track has no clips', () => {
    const tracks = [makeTrack('video', [])]
    expect(computeTimelineInsertTime(tracks)).toBe(0)
  })

  it('returns end time of the single video clip', () => {
    const tracks = [makeTrack('video', [{ startTime: 2, duration: 8 }])]
    expect(computeTimelineInsertTime(tracks)).toBe(10)
  })

  it('returns end time of the last clip across video tracks', () => {
    const tracks = [
      makeTrack('video', [
        { startTime: 0, duration: 5 },
        { startTime: 10, duration: 3 },
      ]),
      makeTrack('video', [{ startTime: 5, duration: 10 }]),
    ]
    // ends: 5, 13, 15 → max is 15
    expect(computeTimelineInsertTime(tracks)).toBe(15)
  })

  it('ignores audio clips when computing insert time', () => {
    const tracks = [
      makeTrack('video', [{ startTime: 0, duration: 5 }]),
      makeTrack('audio', [{ startTime: 0, duration: 100 }]),
    ]
    expect(computeTimelineInsertTime(tracks)).toBe(5)
  })
})

describe('pickBestAudioMimeType', () => {
  it('prefers audio/webm;codecs=opus', () => {
    const supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
    expect(pickBestAudioMimeType(supported)).toBe('audio/webm;codecs=opus')
  })

  it('falls back to audio/webm when opus unavailable', () => {
    const supported = ['audio/webm', 'audio/ogg']
    expect(pickBestAudioMimeType(supported)).toBe('audio/webm')
  })

  it('falls back to audio/ogg;codecs=opus when webm unavailable', () => {
    const supported = ['audio/ogg;codecs=opus', 'audio/ogg']
    expect(pickBestAudioMimeType(supported)).toBe('audio/ogg;codecs=opus')
  })

  it('returns audio/webm as default when nothing matches', () => {
    expect(pickBestAudioMimeType([])).toBe('audio/webm')
  })
})

describe('computeVoiceoverInsertTime', () => {
  it('returns 0 when there are no tracks', () => {
    expect(computeVoiceoverInsertTime([])).toBe(0)
  })

  it('returns 0 when there are only non-audio tracks', () => {
    const tracks = [
      makeTrack('video', [{ startTime: 0, duration: 10 }]),
      makeTrack('annotation', [{ startTime: 5, duration: 3 }]),
    ]
    expect(computeVoiceoverInsertTime(tracks)).toBe(0)
  })

  it('returns 0 when audio track has no clips', () => {
    const tracks = [makeTrack('audio', [])]
    expect(computeVoiceoverInsertTime(tracks)).toBe(0)
  })

  it('returns end time of the single audio clip', () => {
    const tracks = [makeTrack('audio', [{ startTime: 2, duration: 8 }])]
    expect(computeVoiceoverInsertTime(tracks)).toBe(10)
  })

  it('returns end time of the last clip across audio tracks', () => {
    const tracks = [
      makeTrack('audio', [
        { startTime: 0, duration: 5 },
        { startTime: 10, duration: 3 },
      ]),
      makeTrack('audio', [{ startTime: 5, duration: 10 }]),
    ]
    // ends: 5, 13, 15 → max is 15
    expect(computeVoiceoverInsertTime(tracks)).toBe(15)
  })

  it('ignores video clips when computing voiceover insert time', () => {
    const tracks = [
      makeTrack('audio', [{ startTime: 0, duration: 5 }]),
      makeTrack('video', [{ startTime: 0, duration: 100 }]),
    ]
    expect(computeVoiceoverInsertTime(tracks)).toBe(5)
  })
})

describe('createCursorTracker', () => {
  let nowMs: number

  beforeEach(() => {
    nowMs = 0
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
  })

  function firePointerMove(target: EventTarget, x: number, y: number): void {
    target.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x, clientY: y }))
  }

  it('does not capture points before start() is called', () => {
    const target = new EventTarget()
    const tracker = createCursorTracker(target)
    firePointerMove(target, 10, 20)
    const points = tracker.stop()
    expect(points).toHaveLength(0)
  })

  it('captures points after start()', () => {
    const target = new EventTarget()
    const tracker = createCursorTracker(target)
    nowMs = 0
    tracker.start()
    nowMs = 1000
    firePointerMove(target, 100, 200)
    const points = tracker.stop()
    expect(points).toHaveLength(1)
    expect(points[0].t).toBeCloseTo(1)
    expect(points[0].x).toBe(100)
    expect(points[0].y).toBe(200)
  })

  it('does not capture points while paused', () => {
    const target = new EventTarget()
    const tracker = createCursorTracker(target)
    nowMs = 0
    tracker.start()
    nowMs = 1000
    tracker.pause()
    nowMs = 2000
    firePointerMove(target, 50, 50)
    const points = tracker.stop()
    expect(points).toHaveLength(0)
  })

  it('resumes capture after resume() and excludes paused duration from timestamps', () => {
    const target = new EventTarget()
    const tracker = createCursorTracker(target)
    nowMs = 0
    tracker.start()
    nowMs = 1000
    tracker.pause()
    nowMs = 3000 // 2s paused
    tracker.resume()
    nowMs = 4000 // 1s after resume → effective time = 4000 - 0 - 2000 = 2000ms = 2s
    firePointerMove(target, 75, 80)
    const points = tracker.stop()
    expect(points).toHaveLength(1)
    expect(points[0].t).toBeCloseTo(2)
  })

  it('stops capturing after stop() and removes the listener', () => {
    const target = new EventTarget()
    const tracker = createCursorTracker(target)
    nowMs = 0
    tracker.start()
    nowMs = 500
    firePointerMove(target, 10, 10)
    const points = tracker.stop()
    expect(points).toHaveLength(1)
    // Fire after stop — should not be captured
    firePointerMove(target, 20, 20)
    // stop() returns a snapshot; a new stop would return 0 events
    expect(points).toHaveLength(1)
  })

  it('captures multiple points in order', () => {
    const target = new EventTarget()
    const tracker = createCursorTracker(target)
    nowMs = 0
    tracker.start()
    nowMs = 500
    firePointerMove(target, 1, 2)
    nowMs = 1500
    firePointerMove(target, 3, 4)
    const points = tracker.stop()
    expect(points).toHaveLength(2)
    expect(points[0].t).toBeCloseTo(0.5)
    expect(points[1].t).toBeCloseTo(1.5)
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
