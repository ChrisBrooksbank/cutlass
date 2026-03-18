import { useState, useRef, useEffect, useCallback } from 'react'
import {
  formatRecordingTime,
  canPause,
  canResume,
  canStop,
  getPreferredMimeType,
  createChunkStorage,
  type ChunkStorage,
  type RecordingStatus,
} from './recordingUtils'

interface RecordingControlsProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void | Promise<void>
}

export default function RecordingControls({ onRecordingComplete }: RecordingControlsProps) {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [elapsed, setElapsed] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const storageRef = useRef<ChunkStorage | null>(null)
  const trackEndedRef = useRef<{ track: MediaStreamTrack; handler: () => void } | null>(null)

  // Wall-clock time when recording last started/resumed
  const segmentStartRef = useRef<number>(0)
  // Seconds accumulated from completed pause/resume cycles
  const accumulatedRef = useRef<number>(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    segmentStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const secs =
        accumulatedRef.current + Math.floor((Date.now() - segmentStartRef.current) / 1000)
      setElapsed(secs)
    }, 500)
  }, [stopTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      if (trackEndedRef.current) {
        trackEndedRef.current.track.removeEventListener('ended', trackEndedRef.current.handler)
        trackEndedRef.current = null
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [stopTimer])

  const handleStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      streamRef.current = stream
      accumulatedRef.current = 0
      setElapsed(0)

      const mimeType = getPreferredMimeType()
      const storage = await createChunkStorage(`rec-${Date.now()}.webm`)
      storageRef.current = storage

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          void storage.write(e.data)
        }
      }

      recorder.onstop = () => {
        // Remove the track ended listener
        if (trackEndedRef.current) {
          trackEndedRef.current.track.removeEventListener('ended', trackEndedRef.current.handler)
          trackEndedRef.current = null
        }
        const duration = accumulatedRef.current
        void storage.toBlob('video/webm').then((blob) => {
          void storage.dispose().then(() => {
            storageRef.current = null
          })
          stopTimer()
          setStatus('idle')
          setElapsed(0)
          accumulatedRef.current = 0
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          recorderRef.current = null
          onRecordingComplete(blob, duration)
        })
      }

      // Handle user clicking "Stop sharing" in the browser's native UI
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        const onTrackEnded = () => {
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            if (recorderRef.current.state === 'recording') {
              accumulatedRef.current += (Date.now() - segmentStartRef.current) / 1000
            }
            recorderRef.current.stop()
          }
        }
        videoTrack.addEventListener('ended', onTrackEnded)
        trackEndedRef.current = { track: videoTrack, handler: onTrackEnded }
      }

      recorder.start(1000) // emit chunks every second
      setStatus('recording')
      startTimer()
    } catch {
      // User cancelled permission dialog or browser denied access — silently ignore
    }
  }, [onRecordingComplete, startTimer, stopTimer])

  const handlePause = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      accumulatedRef.current += (Date.now() - segmentStartRef.current) / 1000
      recorderRef.current.pause()
      stopTimer()
      setElapsed(accumulatedRef.current)
      setStatus('paused')
    }
  }, [stopTimer])

  const handleResume = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume()
      setStatus('recording')
      startTimer()
    }
  }, [startTimer])

  const handleStop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      if (recorderRef.current.state === 'recording') {
        accumulatedRef.current += (Date.now() - segmentStartRef.current) / 1000
      }
      recorderRef.current.stop()
    }
  }, [])

  const isRecordingActive = status !== 'idle'

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #2e2e2e',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* Timer */}
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 13,
            color: isRecordingActive ? (status === 'paused' ? '#f59e0b' : '#ef4444') : '#6b7280',
            minWidth: 42,
          }}
          aria-label="Recording timer"
        >
          {formatRecordingTime(elapsed)}
        </span>

        {/* Status dot */}
        {isRecordingActive && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: status === 'paused' ? '#f59e0b' : '#ef4444',
              animation: status === 'recording' ? 'pulse 1s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
            aria-hidden
          />
        )}

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {!isRecordingActive && (
            <button
              onClick={() => void handleStart()}
              title="Start screen recording"
              style={btnStyle('#ef4444')}
            >
              ● Rec
            </button>
          )}

          {canPause(status) && (
            <button onClick={handlePause} title="Pause recording" style={btnStyle()}>
              ⏸
            </button>
          )}

          {canResume(status) && (
            <button onClick={handleResume} title="Resume recording" style={btnStyle()}>
              ▶
            </button>
          )}

          {canStop(status) && (
            <button onClick={handleStop} title="Stop recording" style={btnStyle()}>
              ⏹
            </button>
          )}
        </div>
      </div>

      {isRecordingActive && (
        <div style={{ fontSize: 10, color: '#6b7280', userSelect: 'none' }}>
          {status === 'recording' ? 'Recording…' : 'Paused'}
        </div>
      )}
    </div>
  )
}

function btnStyle(bg = '#374151'): React.CSSProperties {
  return {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid #4b5563',
    background: bg,
    color: '#e5e7eb',
    cursor: 'pointer',
  }
}
