import { describe, it, expect } from 'vitest'
import {
  formatRecordingTime,
  canPause,
  canResume,
  canStop,
  pickBestMimeType,
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
