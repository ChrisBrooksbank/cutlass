import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditorStore } from '@/store'
import type { Effect, MediaAsset } from '@/store'
import {
  findActiveVideoClip,
  sourceTimeForClip,
  projectDuration,
  formatTime,
} from '@/components/previewUtils'
import {
  findTransitionAtTime,
  incomingSourceTime,
  outgoingOpacity,
  incomingOpacity,
  incomingClipPath,
} from '@/components/transitionUtils'
import { computeBlurRegion } from '@/components/blurUtils'
import { computeTextOverlay } from '@/components/textOverlayUtils'
import {
  computeShapeRect,
  computeShapeCircle,
  computeShapeArrow,
} from '@/components/shapeAnnotationUtils'
import { captureFrameFromVideo, downloadThumbnail } from '@/components/thumbnailUtils'

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
// Draggable text overlay element
// ---------------------------------------------------------------------------

function TextRect({
  clipId,
  effect,
  displayInfo,
}: {
  clipId: string
  effect: Effect
  displayInfo: DisplayInfo
}) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const dragRef = useRef<{
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
  } | null>(null)

  const overlay = computeTextOverlay(effect)
  const { scale, offsetX, offsetY } = displayInfo

  const left = offsetX + overlay.x * scale
  const top = offsetY + overlay.y * scale

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: overlay.x,
        startY: overlay.y,
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
    [clipId, effect.id, overlay.x, overlay.y, scale, updateEffectParams],
  )

  return (
    <div
      data-testid={`text-overlay-${effect.id}`}
      onMouseDown={handleMouseDown}
      title={overlay.text}
      style={{
        position: 'absolute',
        left,
        top,
        border: '1px dashed rgba(100, 180, 255, 0.8)',
        borderRadius: '2px',
        padding: '2px 4px',
        background: 'rgba(0, 0, 0, 0.35)',
        color: overlay.color.startsWith('#') ? overlay.color : '#ffffff',
        fontSize: `${Math.max(8, overlay.fontSize * scale)}px`,
        fontFamily: overlay.fontFamily,
        whiteSpace: 'nowrap',
        cursor: 'move',
        pointerEvents: 'all',
        userSelect: 'none',
        lineHeight: 1.2,
      }}
    >
      {overlay.text}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Text overlay layer for all text effects on the active clip
// ---------------------------------------------------------------------------

function TextOverlay({
  clipId,
  effects,
  containerRef,
  projectWidth,
  projectHeight,
}: {
  clipId: string
  effects: Effect[]
  containerRef: React.RefObject<HTMLDivElement | null>
  projectWidth: number
  projectHeight: number
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

  const textEffects = effects.filter((e) => e.type === 'text')
  if (textEffects.length === 0) return null

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {textEffects.map((effect) => (
        <TextRect key={effect.id} clipId={clipId} effect={effect} displayInfo={displayInfo} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draggable shape-rect overlay
// ---------------------------------------------------------------------------

function ShapeRectElement({
  clipId,
  effect,
  displayInfo,
}: {
  clipId: string
  effect: Effect
  displayInfo: DisplayInfo
}) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const dragRef = useRef<{
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
  } | null>(null)

  const shape = computeShapeRect(effect)
  const { scale, offsetX, offsetY } = displayInfo

  const left = offsetX + shape.x * scale
  const top = offsetY + shape.y * scale
  const width = shape.width * scale
  const height = shape.height * scale

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: shape.x,
        startY: shape.y,
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
    [clipId, effect.id, shape.x, shape.y, scale, updateEffectParams],
  )

  return (
    <div
      data-testid={`shape-rect-overlay-${effect.id}`}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        border: `${Math.max(1, shape.strokeWidth * scale)}px solid ${shape.strokeColor}`,
        background: shape.fillColor,
        boxSizing: 'border-box',
        cursor: 'move',
        pointerEvents: 'all',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Draggable shape-circle overlay
// ---------------------------------------------------------------------------

function ShapeCircleElement({
  clipId,
  effect,
  displayInfo,
}: {
  clipId: string
  effect: Effect
  displayInfo: DisplayInfo
}) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const dragRef = useRef<{
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
  } | null>(null)

  const shape = computeShapeCircle(effect)
  const { scale, offsetX, offsetY } = displayInfo

  const left = offsetX + (shape.x - shape.radiusX) * scale
  const top = offsetY + (shape.y - shape.radiusY) * scale
  const width = shape.radiusX * 2 * scale
  const height = shape.radiusY * 2 * scale

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: shape.x,
        startY: shape.y,
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
    [clipId, effect.id, shape.x, shape.y, scale, updateEffectParams],
  )

  return (
    <div
      data-testid={`shape-circle-overlay-${effect.id}`}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        borderRadius: '50%',
        border: `${Math.max(1, shape.strokeWidth * scale)}px solid ${shape.strokeColor}`,
        background: shape.fillColor,
        boxSizing: 'border-box',
        cursor: 'move',
        pointerEvents: 'all',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Draggable shape-arrow overlay (SVG-based)
// ---------------------------------------------------------------------------

function ShapeArrowElement({
  clipId,
  effect,
  displayInfo,
}: {
  clipId: string
  effect: Effect
  displayInfo: DisplayInfo
}) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const dragRef = useRef<{
    startMouseX: number
    startMouseY: number
    startX1: number
    startY1: number
    startX2: number
    startY2: number
  } | null>(null)

  const shape = computeShapeArrow(effect)
  const { scale, offsetX, offsetY } = displayInfo

  const sx1 = offsetX + shape.x1 * scale
  const sy1 = offsetY + shape.y1 * scale
  const sx2 = offsetX + shape.x2 * scale
  const sy2 = offsetY + shape.y2 * scale

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX1: shape.x1,
        startY1: shape.y1,
        startX2: shape.x2,
        startY2: shape.y2,
      }
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const dx = (ev.clientX - dragRef.current.startMouseX) / scale
        const dy = (ev.clientY - dragRef.current.startMouseY) / scale
        updateEffectParams(clipId, effect.id, {
          x1: Math.round(dragRef.current.startX1 + dx),
          y1: Math.round(dragRef.current.startY1 + dy),
          x2: Math.round(dragRef.current.startX2 + dx),
          y2: Math.round(dragRef.current.startY2 + dy),
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
    [clipId, effect.id, shape.x1, shape.y1, shape.x2, shape.y2, scale, updateEffectParams],
  )

  const markerId = `arrow-marker-${effect.id}`
  const sw = Math.max(1, shape.strokeWidth * scale)

  return (
    <svg
      data-testid={`shape-arrow-overlay-${effect.id}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={shape.color} />
        </marker>
      </defs>
      <line
        x1={sx1}
        y1={sy1}
        x2={sx2}
        y2={sy2}
        stroke={shape.color}
        strokeWidth={sw}
        markerEnd={`url(#${markerId})`}
        strokeLinecap="round"
        style={{ cursor: 'move', pointerEvents: 'stroke' }}
        onMouseDown={handleMouseDown}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Shape annotations overlay layer
// ---------------------------------------------------------------------------

function ShapeAnnotationOverlay({
  clipId,
  effects,
  containerRef,
  projectWidth,
  projectHeight,
}: {
  clipId: string
  effects: Effect[]
  containerRef: React.RefObject<HTMLDivElement | null>
  projectWidth: number
  projectHeight: number
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

  const rectEffects = effects.filter((e) => e.type === 'shape-rect')
  const circleEffects = effects.filter((e) => e.type === 'shape-circle')
  const arrowEffects = effects.filter((e) => e.type === 'shape-arrow')

  if (rectEffects.length === 0 && circleEffects.length === 0 && arrowEffects.length === 0)
    return null

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {rectEffects.map((effect) => (
        <ShapeRectElement
          key={effect.id}
          clipId={clipId}
          effect={effect}
          displayInfo={displayInfo}
        />
      ))}
      {circleEffects.map((effect) => (
        <ShapeCircleElement
          key={effect.id}
          clipId={clipId}
          effect={effect}
          displayInfo={displayInfo}
        />
      ))}
      {arrowEffects.map((effect) => (
        <ShapeArrowElement
          key={effect.id}
          clipId={clipId}
          effect={effect}
          displayInfo={displayInfo}
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
  const video2Ref = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastWallRef = useRef<number | null>(null)
  const currentAssetRef = useRef<MediaAsset | null>(null)
  const incomingAssetRef = useRef<MediaAsset | null>(null)

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

  // Transition detection
  const activeTransition = findTransitionAtTime(tracks, currentTime)
  const incomingAsset = activeTransition
    ? (mediaAssets.find((a) => a.id === activeTransition.incomingClip.sourceId) ?? null)
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

  // Sync incoming video src for transition
  useEffect(() => {
    const video2 = video2Ref.current
    if (!video2) return
    if (incomingAsset === incomingAssetRef.current) return
    incomingAssetRef.current = incomingAsset
    if (incomingAsset) {
      video2.src = incomingAsset.url
      video2.load()
    } else {
      video2.removeAttribute('src')
      video2.load()
    }
  })

  // Seek incoming video when paused (to match transition source time)
  useEffect(() => {
    if (isPlaying) return
    const video2 = video2Ref.current
    if (!video2 || !activeTransition || !incomingAsset) return
    const src = incomingSourceTime(activeTransition, currentTime)
    if (Math.abs(video2.currentTime - src) > 0.05) {
      video2.currentTime = src
    }
  }, [currentTime, isPlaying, activeTransition, incomingAsset])

  // Play/pause the incoming video when a transition is active during playback
  useEffect(() => {
    const video2 = video2Ref.current
    if (!video2) return
    if (isPlaying && activeTransition && incomingAsset) {
      const src = incomingSourceTime(activeTransition, currentTime)
      video2.currentTime = src
      video2.playbackRate = activeTransition.incomingClip.speed
      video2.play().catch(() => {
        // Autoplay may be blocked; transition will still render via opacity changes
      })
    } else {
      video2.pause()
    }
    // Only run when transition status or playback state changes, not on every currentTime tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, !!activeTransition, incomingAsset])

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

  const handleSaveThumbnail = () => {
    const video = videoRef.current
    if (!video) return
    try {
      const dataUrl = captureFrameFromVideo(video, projectWidth, projectHeight)
      const timestamp = Math.round(currentTime * 100) / 100
      downloadThumbnail(dataUrl, `thumbnail-${timestamp}s.png`)
    } catch {
      // Silently ignore if canvas capture is unavailable (e.g. cross-origin video)
    }
  }

  return (
    <div className="panel preview-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">Preview</div>
      <div
        className="panel-body"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}
      >
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Primary video (outgoing clip or normal playback) */}
          <video
            ref={videoRef}
            data-testid="preview-video"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: activeTransition
                ? outgoingOpacity(activeTransition.type, activeTransition.progress)
                : 1,
            }}
            playsInline
          />
          {/* Secondary video (incoming clip during transition) */}
          <video
            ref={video2Ref}
            data-testid="preview-video-incoming"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: activeTransition
                ? incomingOpacity(activeTransition.type, activeTransition.progress)
                : 0,
              clipPath: activeTransition
                ? (incomingClipPath(activeTransition.type, activeTransition.progress) ?? undefined)
                : undefined,
              display: activeTransition ? 'block' : 'none',
            }}
            playsInline
          />
          {/* Fade-to-black overlay */}
          {activeTransition?.type === 'fade-to-black' && (
            <div
              data-testid="transition-black-overlay"
              style={{
                position: 'absolute',
                inset: 0,
                background: '#000',
                opacity:
                  activeTransition.progress < 0.5
                    ? activeTransition.progress * 2
                    : (1 - activeTransition.progress) * 2,
                pointerEvents: 'none',
              }}
            />
          )}
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
          {activeClip && (
            <TextOverlay
              clipId={activeClip.id}
              effects={activeClip.effects}
              containerRef={containerRef}
              projectWidth={projectWidth}
              projectHeight={projectHeight}
            />
          )}
          {activeClip && (
            <ShapeAnnotationOverlay
              clipId={activeClip.id}
              effects={activeClip.effects}
              containerRef={containerRef}
              projectWidth={projectWidth}
              projectHeight={projectHeight}
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
          <button
            onClick={handleSaveThumbnail}
            aria-label="Save thumbnail"
            data-testid="save-thumbnail-btn"
            title="Save current frame as PNG"
            style={{
              background: 'none',
              border: '1px solid #555',
              color: '#fff',
              borderRadius: '4px',
              padding: '2px 8px',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Save Thumbnail
          </button>
        </div>
      </div>
    </div>
  )
}
