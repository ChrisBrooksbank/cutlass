import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/store'
import type { MediaAsset } from '@/store'
import {
  findActiveVideoClip,
  sourceTimeForClip,
  projectDuration,
  formatTime,
} from '@/components/previewUtils'

export default function PreviewPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastWallRef = useRef<number | null>(null)
  const currentAssetRef = useRef<MediaAsset | null>(null)

  const tracks = useEditorStore((s) => s.project.tracks)
  const mediaAssets = useEditorStore((s) => s.project.mediaAssets)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const isPlaying = useEditorStore((s) => s.playback.isPlaying)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying)

  const activeClip = findActiveVideoClip(tracks, currentTime)
  const activeAsset = activeClip
    ? (mediaAssets.find((a) => a.id === activeClip.sourceId) ?? null)
    : null

  // Sync video src when active asset changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (activeAsset === currentAssetRef.current) return
    currentAssetRef.current = activeAsset
    if (activeAsset) {
      video.src = activeAsset.url
      video.load()
    } else {
      video.removeAttribute('src')
      video.load()
    }
  })

  // Seek video when paused or when active clip changes
  useEffect(() => {
    if (isPlaying) return
    const video = videoRef.current
    if (!video || !activeClip) return
    const src = sourceTimeForClip(activeClip, currentTime)
    if (Math.abs(video.currentTime - src) > 0.05) {
      video.currentTime = src
    }
  }, [currentTime, isPlaying, activeClip])

  // Handle play/pause state changes
  useEffect(() => {
    const video = videoRef.current
    if (isPlaying) {
      if (video && activeClip) {
        const src = sourceTimeForClip(activeClip, currentTime)
        video.currentTime = src
        video.playbackRate = activeClip.speed
        video.play().catch(() => {
          // Autoplay may be blocked; playback will be driven by RAF only
        })
      }
      // Start RAF loop for timeline advancement
      lastWallRef.current = null
      const tick = (now: number) => {
        const last = lastWallRef.current
        lastWallRef.current = now
        if (last !== null) {
          const delta = (now - last) / 1000
          const state = useEditorStore.getState()
          const newTime = state.playback.currentTime + delta
          const dur = projectDuration(state.project.tracks)
          if (dur > 0 && newTime >= dur) {
            setCurrentTime(dur)
            setIsPlaying(false)
            return
          }
          setCurrentTime(newTime)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      // Cancel RAF loop
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      lastWallRef.current = null
      video?.pause()
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  const togglePlayback = () => setIsPlaying(!isPlaying)

  return (
    <div className="panel preview-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">Preview</div>
      <div
        className="panel-body"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}
      >
        <video
          ref={videoRef}
          data-testid="preview-video"
          style={{ flex: 1, width: '100%', objectFit: 'contain' }}
          playsInline
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            background: '#1a1a1a',
            color: '#fff',
            fontSize: '13px',
          }}
        >
          <button
            onClick={togglePlayback}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              background: 'none',
              border: '1px solid #555',
              color: '#fff',
              borderRadius: '4px',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span data-testid="preview-time">{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
  )
}
