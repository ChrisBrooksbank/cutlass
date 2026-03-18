import { useEffect, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { Clip, MediaAsset, Track } from '@/store/types'
import { TRACK_HEIGHT, TRACK_HEADER_WIDTH } from './timelineUtils'
import {
  CLIP_COLOR,
  CLIP_COLOR_SELECTED,
  CLIP_PADDING,
  CLIP_CORNER_RADIUS,
  TRIM_HANDLE_WIDTH,
  MIN_CLIP_DURATION,
  clipCanvasX,
  clipCanvasY,
  clipCanvasWidth,
  canvasXToStartTime,
  canvasYToTrackIndex,
  computeTrimLeft,
  computeTrimRight,
  getSnapTargetsExcluding,
} from './clipBlockUtils'
import { snapTime, SNAP_THRESHOLD_SEC } from './playheadUtils'
import { extractVideoThumbnail } from './thumbnailUtils'
import { extractAudioWaveform, computeWaveformPoints } from './waveformUtils'

interface TrimState {
  side: 'left' | 'right'
  startX: number
  originalStartTime: number
  originalDuration: number
  originalSourceIn: number
  originalSourceOut: number
  currentStartTime: number
  currentDuration: number
}

interface ClipBlockProps {
  clip: Clip
  track: Track
  trackIndex: number
  allTracks: Track[]
  mediaAsset: MediaAsset | undefined
  pixelsPerSecond: number
  scrollLeft: number
  currentTime: number
  isSelected: boolean
  onSelect: (clipId: string, addToSelection: boolean) => void
  onMove: (clipId: string, targetTrackId: string, startTime: number) => void
  onTrim: (
    clipId: string,
    startTime: number,
    duration: number,
    sourceIn: number,
    sourceOut: number,
  ) => void
}

export default function ClipBlock({
  clip,
  track,
  trackIndex,
  allTracks,
  mediaAsset,
  pixelsPerSecond,
  scrollLeft,
  currentTime,
  isSelected,
  onSelect,
  onMove,
  onTrim,
}: ClipBlockProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trimRef = useRef<TrimState | null>(null)
  const [trimPreview, setTrimPreview] = useState<{
    startTime: number
    duration: number
  } | null>(null)
  const [thumbnailImg, setThumbnailImg] = useState<HTMLImageElement | null>(null)
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null)

  // Extract thumbnail for video clips from the source media at sourceIn
  useEffect(() => {
    if (track.type !== 'video' || !mediaAsset?.url) return
    let cancelled = false
    extractVideoThumbnail(mediaAsset.url, clip.sourceIn)
      .then((dataUrl) => {
        if (cancelled) return
        const img = new window.Image()
        img.onload = () => {
          if (!cancelled) setThumbnailImg(img)
        }
        img.src = dataUrl
      })
      .catch(() => {
        // Thumbnail unavailable — clip renders without it
      })
    return () => {
      cancelled = true
    }
  }, [track.type, mediaAsset?.url, clip.sourceIn])

  // Extract waveform for audio clips
  useEffect(() => {
    if (track.type !== 'audio' || !mediaAsset?.url) return
    let cancelled = false
    extractAudioWaveform(mediaAsset.url)
      .then((data) => {
        if (!cancelled) setWaveformData(data)
      })
      .catch(() => {
        // Waveform unavailable — clip renders without it
      })
    return () => {
      cancelled = true
    }
  }, [track.type, mediaAsset?.url])

  const effectiveStartTime = trimPreview?.startTime ?? clip.startTime
  const effectiveDuration = trimPreview?.duration ?? clip.duration

  const x = clipCanvasX(effectiveStartTime, pixelsPerSecond, scrollLeft)
  const y = clipCanvasY(trackIndex)
  const w = clipCanvasWidth(effectiveDuration, pixelsPerSecond)
  const h = TRACK_HEIGHT

  const fill = isSelected
    ? (CLIP_COLOR_SELECTED[track.type] ?? '#93c5fd')
    : (CLIP_COLOR[track.type] ?? '#3b82f6')

  const innerW = Math.max(0, w - CLIP_PADDING * 2)
  const innerH = h - CLIP_PADDING * 2

  // Source media duration; Infinity when unknown (images or missing asset)
  const mediaDuration = mediaAsset && mediaAsset.duration > 0 ? mediaAsset.duration : Infinity

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true
    const addToSelection = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey
    onSelect(clip.id, addToSelection)
  }

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target as Konva.Group
    const rawStartTime = canvasXToStartTime(node.x(), pixelsPerSecond, scrollLeft)
    const snapTargets = getSnapTargetsExcluding(allTracks, clip.id, currentTime)
    const newStartTime = snapTime(rawStartTime, snapTargets, SNAP_THRESHOLD_SEC)
    const newTrackIndex = canvasYToTrackIndex(node.y(), allTracks.length)
    const targetTrack = allTracks[newTrackIndex]

    if (targetTrack && !targetTrack.locked) {
      onMove(clip.id, targetTrack.id, newStartTime)
    } else {
      // Snap back if target track is locked or missing
      node.x(x)
      node.y(y)
    }
  }

  function startTrim(e: Konva.KonvaEventObject<MouseEvent>, side: 'left' | 'right') {
    // Prevent the parent Group from receiving this mousedown and starting a clip drag
    e.cancelBubble = true

    const stage = e.target.getStage()
    if (!stage) return
    // Assign to a non-null const so TypeScript is happy inside the closures below
    const safeStage = stage
    const pos = safeStage.getPointerPosition()
    if (!pos) return

    trimRef.current = {
      side,
      startX: pos.x,
      originalStartTime: clip.startTime,
      originalDuration: clip.duration,
      originalSourceIn: clip.sourceIn,
      originalSourceOut: clip.sourceOut,
      currentStartTime: clip.startTime,
      currentDuration: clip.duration,
    }

    // Capture clip.speed, allTracks, currentTime, pixelsPerSecond in closure so they stay consistent throughout the drag
    const speed = clip.speed
    const capturedTracks = allTracks
    const capturedCurrentTime = currentTime
    const capturedPps = pixelsPerSecond

    function onMouseMove() {
      const p = safeStage.getPointerPosition()
      if (!p || !trimRef.current) return

      const deltaX = p.x - trimRef.current.startX
      const deltaTime = deltaX / capturedPps
      const snapTargets = getSnapTargetsExcluding(capturedTracks, clip.id, capturedCurrentTime)

      if (side === 'left') {
        const result = computeTrimLeft(
          trimRef.current.originalStartTime,
          trimRef.current.originalDuration,
          trimRef.current.originalSourceIn,
          deltaTime,
          speed,
        )
        const originalRightEdge =
          trimRef.current.originalStartTime + trimRef.current.originalDuration
        const snappedStartTime = snapTime(result.startTime, snapTargets, SNAP_THRESHOLD_SEC)
        // Re-clamp after snapping to prevent sourceIn from going negative
        const maxLeftShift = trimRef.current.originalSourceIn / speed
        const clampedStartTime = Math.max(
          trimRef.current.originalStartTime - maxLeftShift,
          snappedStartTime,
        )
        const snappedDuration = Math.max(MIN_CLIP_DURATION, originalRightEdge - clampedStartTime)
        trimRef.current.currentStartTime = clampedStartTime
        trimRef.current.currentDuration = snappedDuration
        setTrimPreview({ startTime: clampedStartTime, duration: snappedDuration })
      } else {
        const result = computeTrimRight(
          trimRef.current.originalDuration,
          trimRef.current.originalSourceOut,
          deltaTime,
          mediaDuration,
          speed,
        )
        const rawEndTime = trimRef.current.originalStartTime + result.duration
        const snappedEndTime = snapTime(rawEndTime, snapTargets, SNAP_THRESHOLD_SEC)
        const snappedDuration = Math.max(
          MIN_CLIP_DURATION,
          snappedEndTime - trimRef.current.originalStartTime,
        )
        // Re-clamp after snapping to prevent sourceOut from exceeding media duration
        const maxDurationDelta = (mediaDuration - trimRef.current.originalSourceOut) / speed
        const clampedDuration = Math.min(
          trimRef.current.originalDuration + maxDurationDelta,
          snappedDuration,
        )
        trimRef.current.currentDuration = clampedDuration
        setTrimPreview({
          startTime: trimRef.current.originalStartTime,
          duration: clampedDuration,
        })
      }
    }

    function onMouseUp() {
      safeStage.off('mousemove.trim', onMouseMove)
      safeStage.off('mouseup.trim', onMouseUp)

      const tr = trimRef.current
      if (tr) {
        if (side === 'left') {
          const actualDelta = tr.currentStartTime - tr.originalStartTime
          const newSourceIn = tr.originalSourceIn + actualDelta * speed
          onTrim(
            clip.id,
            tr.currentStartTime,
            tr.currentDuration,
            newSourceIn,
            tr.originalSourceOut,
          )
        } else {
          const durationDelta = tr.currentDuration - tr.originalDuration
          const newSourceOut = tr.originalSourceOut + durationDelta * speed
          onTrim(
            clip.id,
            tr.originalStartTime,
            tr.currentDuration,
            tr.originalSourceIn,
            newSourceOut,
          )
        }
      }

      trimRef.current = null
      setTrimPreview(null)
    }

    safeStage.on('mousemove.trim', onMouseMove)
    safeStage.on('mouseup.trim', onMouseUp)
  }

  function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = cursor
  }

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      draggable={!track.locked}
      onMouseDown={handleMouseDown}
      onDragEnd={handleDragEnd}
      dragBoundFunc={(pos) => ({
        x: Math.max(TRACK_HEADER_WIDTH, pos.x),
        y: Math.max(0, Math.min((allTracks.length - 1) * TRACK_HEIGHT, pos.y)),
      })}
    >
      <Rect
        x={CLIP_PADDING}
        y={CLIP_PADDING}
        width={innerW}
        height={innerH}
        fill={fill}
        cornerRadius={CLIP_CORNER_RADIUS}
        shadowColor="black"
        shadowBlur={isSelected ? 6 : 0}
        shadowOpacity={0.4}
      />

      {/* Thumbnail: video clips only, shown when clip is wide enough */}
      {thumbnailImg && innerW > 20 && (
        <Group
          x={CLIP_PADDING}
          y={CLIP_PADDING}
          clipFunc={(ctx) => {
            const r = CLIP_CORNER_RADIUS
            ctx.beginPath()
            ctx.moveTo(r, 0)
            ctx.lineTo(innerW - r, 0)
            ctx.arcTo(innerW, 0, innerW, r, r)
            ctx.lineTo(innerW, innerH - r)
            ctx.arcTo(innerW, innerH, innerW - r, innerH, r)
            ctx.lineTo(r, innerH)
            ctx.arcTo(0, innerH, 0, innerH - r, r)
            ctx.lineTo(0, r)
            ctx.arcTo(0, 0, r, 0, r)
            ctx.closePath()
          }}
        >
          <KonvaImage
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            image={thumbnailImg}
            opacity={0.45}
            listening={false}
          />
        </Group>
      )}

      {/* Waveform: audio clips only, shown when clip is wide enough and data available */}
      {waveformData && innerW > 20 && (
        <Group
          x={CLIP_PADDING}
          y={CLIP_PADDING}
          clipFunc={(ctx) => {
            const r = CLIP_CORNER_RADIUS
            ctx.beginPath()
            ctx.moveTo(r, 0)
            ctx.lineTo(innerW - r, 0)
            ctx.arcTo(innerW, 0, innerW, r, r)
            ctx.lineTo(innerW, innerH - r)
            ctx.arcTo(innerW, innerH, innerW - r, innerH, r)
            ctx.lineTo(r, innerH)
            ctx.arcTo(0, innerH, 0, innerH - r, r)
            ctx.lineTo(0, r)
            ctx.arcTo(0, 0, r, 0, r)
            ctx.closePath()
          }}
        >
          <Line
            points={computeWaveformPoints(waveformData, innerW, innerH)}
            closed
            fill="rgba(255,255,255,0.3)"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={0.5}
            listening={false}
          />
        </Group>
      )}

      {w > 32 && (
        <Text
          x={CLIP_PADDING + 4}
          y={CLIP_PADDING + Math.floor(innerH / 2) - 5}
          width={Math.max(0, innerW - 8)}
          height={14}
          text={mediaAsset?.name ?? clip.id.slice(0, 8)}
          fontSize={10}
          fontStyle="bold"
          fill="rgba(255,255,255,0.9)"
          ellipsis
          wrap="none"
          listening={false}
        />
      )}

      {/* Transition-out indicator: diagonal stripe on right edge */}
      {clip.transitionOut && innerW > 8 && (
        <Group
          x={CLIP_PADDING}
          y={CLIP_PADDING}
          clipFunc={(ctx) => {
            const r = CLIP_CORNER_RADIUS
            ctx.beginPath()
            ctx.moveTo(r, 0)
            ctx.lineTo(innerW - r, 0)
            ctx.arcTo(innerW, 0, innerW, r, r)
            ctx.lineTo(innerW, innerH - r)
            ctx.arcTo(innerW, innerH, innerW - r, innerH, r)
            ctx.lineTo(r, innerH)
            ctx.arcTo(0, innerH, 0, innerH - r, r)
            ctx.lineTo(0, r)
            ctx.arcTo(0, 0, r, 0, r)
            ctx.closePath()
          }}
          listening={false}
        >
          {/* Gradient fade on right edge to indicate transition */}
          <Rect
            x={Math.max(0, innerW - 16)}
            y={0}
            width={16}
            height={innerH}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 16, y: 0 }}
            fillLinearGradientColorStops={[0, 'rgba(255,255,255,0)', 1, 'rgba(255,255,255,0.55)']}
          />
        </Group>
      )}

      {/* Left trim handle */}
      {!track.locked && (
        <Rect
          x={0}
          y={0}
          width={TRIM_HANDLE_WIDTH}
          height={h}
          fill="rgba(255,255,255,0.2)"
          onMouseDown={(e) => startTrim(e, 'left')}
          onMouseEnter={(e) => setCursor(e, 'ew-resize')}
          onMouseLeave={(e) => setCursor(e, 'default')}
        />
      )}

      {/* Right trim handle */}
      {!track.locked && (
        <Rect
          x={w - TRIM_HANDLE_WIDTH}
          y={0}
          width={TRIM_HANDLE_WIDTH}
          height={h}
          fill="rgba(255,255,255,0.2)"
          onMouseDown={(e) => startTrim(e, 'right')}
          onMouseEnter={(e) => setCursor(e, 'ew-resize')}
          onMouseLeave={(e) => setCursor(e, 'default')}
        />
      )}
    </Group>
  )
}
