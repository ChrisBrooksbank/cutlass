import { describe, it, expect } from 'vitest'
import {
  parseTimeFromFFmpegLog,
  timeToPercent,
  progressRatioToPercent,
  createExportProgress,
  startExport,
  updateProgress,
  cancelExport,
  completeExport,
  failExport,
} from './exportProgressUtils'

// ---------------------------------------------------------------------------
// parseTimeFromFFmpegLog
// ---------------------------------------------------------------------------

describe('parseTimeFromFFmpegLog', () => {
  it('extracts time from a typical FFmpeg progress line', () => {
    const line =
      'frame=  123 fps= 25 q=18.0 size=  512kB time=00:00:05.12 bitrate=819.2kbits/s speed=1.05x'
    expect(parseTimeFromFFmpegLog(line)).toBeCloseTo(5.12)
  })

  it('parses minutes correctly', () => {
    const line = 'frame=1500 fps=25 q=18.0 size=2000kB time=00:01:00.00 bitrate=266.7kbits/s'
    expect(parseTimeFromFFmpegLog(line)).toBeCloseTo(60)
  })

  it('parses hours correctly', () => {
    const line = 'frame=90000 fps=25 q=18.0 size=100000kB time=01:00:00.00 bitrate=...'
    expect(parseTimeFromFFmpegLog(line)).toBeCloseTo(3600)
  })

  it('parses combined hours, minutes, seconds', () => {
    const line = 'time=01:02:03.50'
    expect(parseTimeFromFFmpegLog(line)).toBeCloseTo(3600 + 120 + 3.5)
  })

  it('returns null for lines without a time field', () => {
    expect(parseTimeFromFFmpegLog('ffmpeg version 6.0 ...')).toBeNull()
    expect(parseTimeFromFFmpegLog('')).toBeNull()
  })

  it('returns null for the FFmpeg negative-time sentinel', () => {
    const sentinel = 'time=-577014:32:22.77'
    expect(parseTimeFromFFmpegLog(sentinel)).toBeNull()
  })

  it('returns 0 for time=-00:00:00.00 (parsed total is 0, not negative)', () => {
    expect(parseTimeFromFFmpegLog('time=-00:00:00.00')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// timeToPercent
// ---------------------------------------------------------------------------

describe('timeToPercent', () => {
  it('returns 0 when currentSec is 0', () => {
    expect(timeToPercent(0, 60)).toBe(0)
  })

  it('returns 100 when currentSec equals totalSec', () => {
    expect(timeToPercent(60, 60)).toBe(100)
  })

  it('returns correct midpoint', () => {
    expect(timeToPercent(30, 60)).toBeCloseTo(50)
  })

  it('clamps to 100 when currentSec exceeds totalSec', () => {
    expect(timeToPercent(70, 60)).toBe(100)
  })

  it('clamps to 0 when currentSec is negative', () => {
    expect(timeToPercent(-5, 60)).toBe(0)
  })

  it('returns 0 when totalSec is 0', () => {
    expect(timeToPercent(10, 0)).toBe(0)
  })

  it('returns 0 when totalSec is negative', () => {
    expect(timeToPercent(10, -1)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// progressRatioToPercent
// ---------------------------------------------------------------------------

describe('progressRatioToPercent', () => {
  it('converts 0 to 0', () => {
    expect(progressRatioToPercent(0)).toBe(0)
  })

  it('converts 1 to 100', () => {
    expect(progressRatioToPercent(1)).toBe(100)
  })

  it('converts 0.5 to 50', () => {
    expect(progressRatioToPercent(0.5)).toBe(50)
  })

  it('clamps values above 1 to 100', () => {
    expect(progressRatioToPercent(1.5)).toBe(100)
  })

  it('clamps negative values to 0', () => {
    expect(progressRatioToPercent(-0.1)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// State machine helpers
// ---------------------------------------------------------------------------

describe('createExportProgress', () => {
  it('returns idle state with 0 percent', () => {
    const state = createExportProgress()
    expect(state.status).toBe('idle')
    expect(state.percent).toBe(0)
    expect(state.errorMessage).toBeUndefined()
  })
})

describe('startExport', () => {
  it('transitions idle to running', () => {
    const state = startExport(createExportProgress())
    expect(state.status).toBe('running')
    expect(state.percent).toBe(0)
  })

  it('resets percent to 0 when restarting', () => {
    let state = createExportProgress()
    state = { ...state, percent: 50, status: 'running' }
    const restarted = startExport(state)
    expect(restarted.percent).toBe(0)
    expect(restarted.status).toBe('running')
  })

  it('clears errorMessage when restarting after error', () => {
    const errorState: import('./exportProgressUtils').ExportProgress = {
      status: 'error',
      percent: 0,
      errorMessage: 'something failed',
    }
    const restarted = startExport(errorState)
    expect(restarted.errorMessage).toBeUndefined()
  })
})

describe('updateProgress', () => {
  it('updates percent when status is running', () => {
    const running = startExport(createExportProgress())
    const updated = updateProgress(running, 42)
    expect(updated.percent).toBe(42)
    expect(updated.status).toBe('running')
  })

  it('clamps percent to [0, 100]', () => {
    const running = startExport(createExportProgress())
    expect(updateProgress(running, -10).percent).toBe(0)
    expect(updateProgress(running, 150).percent).toBe(100)
  })

  it('is a no-op when status is not running', () => {
    const idle = createExportProgress()
    const same = updateProgress(idle, 50)
    expect(same).toBe(idle)
  })
})

describe('cancelExport', () => {
  it('transitions running to cancelled', () => {
    const running = startExport(createExportProgress())
    const cancelled = cancelExport(running)
    expect(cancelled.status).toBe('cancelled')
  })

  it('preserves percent at cancellation point', () => {
    let running = startExport(createExportProgress())
    running = updateProgress(running, 37)
    const cancelled = cancelExport(running)
    expect(cancelled.percent).toBe(37)
  })
})

describe('completeExport', () => {
  it('transitions running to done with 100%', () => {
    const running = startExport(createExportProgress())
    const done = completeExport(running)
    expect(done.status).toBe('done')
    expect(done.percent).toBe(100)
  })
})

describe('failExport', () => {
  it('transitions running to error with message', () => {
    const running = startExport(createExportProgress())
    const failed = failExport(running, 'out of memory')
    expect(failed.status).toBe('error')
    expect(failed.errorMessage).toBe('out of memory')
  })
})
