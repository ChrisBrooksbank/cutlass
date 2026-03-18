import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditorStore } from '@/store'
import type { Effect, MediaAsset } from '@/store'
import {
  findActiveVideoClip,
  sourceTimeForClip,
  projectDuration,
  formatTime,
} from '@/components/previewUtils'
import { computeBlurRegion } from '@/components/blurUtils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DisplayInfo {
  scale: number
  offsetX: number
  offsetY: number
}

function computeDisplayInfo(
  containerWidth: number,
  containerHeight: number,
  projectWidth: number,
  projectHeight: number,
): DisplayInfo {
  const scale = Math.min(containerWidth / projectWidth, containerHeight / projectHeight)
  const offsetX = (containerWidth - projectWidth * scale) / 2
  const offsetY = (containerHeight - projectHeight * scale) / 2
  return { scale, offsetX, offsetY }
}

// ---------------------------------------------------------------------------
// Draggable blur region overlay element
// ---------------------------------------------------------------------------

function BlurRect({
  clipId,
  effect,
  displayInfo,
  clipTime,
}: {
  clipId: string
  effect: Effect
  displayInfo: DisplayInfo
  clipTime: number
}) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const dragRef = useRef<{
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
  } | null>(null)

  const region = computeBlurRegion(effect, clipTime)
  const { scale, offsetX, offsetY } = displayInfo

  const left = offsetX + region.x * scale
  const top = offsetY + region.y * scale
  const width = region.width * scale
  const height = region.height * scale

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: region.x,
        startY: region.y,
      }

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const dx = (ev.clientX - dragRef.current.startMouseX) / scale
        const dy = (ev.clientY - dragRef.current.startMouseY) / scale
        updateEffectParams(clipId, effect.id, {
          x: Math.round(dragRef.current.startX + dx),
          y: Math.round(dragRef.current.startY + dy),
        })
      }

      const onMouseUp = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [clipId, effect.id, region.x, region.y, scale, updateEffectParams],
  )

  return (
    <div
      data-testid={`blur-overlay-${effect.id}`}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        backdropFilter: `blur(${Math.min(region.strength, 20)}px)`,
        WebkitBackdropFilter: `blur(${Math.min(region.strength, 20)}px)`,
        border: '2px dashed rgba(255, 200, 0, 0.8)',
        boxSizing: 'border-box',
        cursor: 'move',
        pointerEvents: 'all',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Blur overlay layer for all blur effects on the active clip
// ---------------------------------------------------------------------------

function BlurOverlay({
  clipId,
  effects,
  containerRef,
  projectWidth,
  projectHeight,
  clipTime,
}: {
  clipId: string
  effects: Effect[]
  containerRef: React.RefObject<HTMLDivElement | null>
  projectWidth: number
  projectHeight: number
  clipTime: number
}) {
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo>({ scale: 1, offsetX: 0, offsetY: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      setDisplayInfo(
        computeDisplayInfo(el.clientWidth, el.clientHeight, projectWidth, projectHeight),
      )
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, projectWidth, projectHeight])

  const blurEffects = effects.filter((e) => e.type === 'blur')
  if (blurEffects.length === 0) return null

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {blurEffects.map((effect) => (
        <BlurRect
          key={effect.id}
          clipId={clipId}
          effect={effect}
          displayInfo={displayInfo}
          clipTime={clipTime}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PreviewPanel
// ---------------------------------------------------------------------------

export default function PreviewPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastWallRef = useRef<number | null>(null)
  const currentAssetRef = useRef<MediaAsset | null>(null)

  const tracks = useEditorStore((s) => s.project.tracks)
  const mediaAssets = useEditorStore((s) => s.project.mediaAssets)
  const projectWidth = useEditorStore((s) => s.project.width)
  const projectHeight = useEditorStore((s) => s.project.height)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const isPlaying = useEditorStore((s) => s.playback.isPlaying)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying)

  const activeClip = findActiveVideoClip(tracks, currentTime)
  const activeAsset = activeClip
    ? (mediaAssets.find((a) => a.id === activeClip.sourceId) ?? null)
    : null

  // Clip time relative to clip start (for keyframe evaluation)
  const clipTime = activeClip ? Math.max(0, currentTime - activeClip.startTime) : 0

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
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            data-testid="preview-video"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            playsInline
          />
          {activeClip && (
            <BlurOverlay
              clipId={activeClip.id}
              effects={activeClip.effects}
              containerRef={containerRef}
              projectWidth={projectWidth}
              projectHeight={projectHeight}
              clipTime={clipTime}
            />
          )}
        </div>
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
