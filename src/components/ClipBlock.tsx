import { useRef, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { Clip, MediaAsset, Track } from '@/store/types'
import { TRACK_HEIGHT, TRACK_HEADER_WIDTH } from './timelineUtils'
import {
  CLIP_COLOR,
  CLIP_COLOR_SELECTED,
  CLIP_PADDING,
  CLIP_CORNER_RADIUS,
  TRIM_HANDLE_WIDTH,
  clipCanvasX,
  clipCanvasY,
  clipCanvasWidth,
  canvasXToStartTime,
  canvasYToTrackIndex,
  computeTrimLeft,
  computeTrimRight,
} from './clipBlockUtils'

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
    const newStartTime = canvasXToStartTime(node.x(), pixelsPerSecond, scrollLeft)
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

    // Capture clip.speed in closure so it stays consistent throughout the drag
    const speed = clip.speed

    function onMouseMove() {
      const p = safeStage.getPointerPosition()
      if (!p || !trimRef.current) return

      const deltaX = p.x - trimRef.current.startX
      const deltaTime = deltaX / pixelsPerSecond

      if (side === 'left') {
        const result = computeTrimLeft(
          trimRef.current.originalStartTime,
          trimRef.current.originalDuration,
          trimRef.current.originalSourceIn,
          deltaTime,
        )
        trimRef.current.currentStartTime = result.startTime
        trimRef.current.currentDuration = result.duration
        setTrimPreview({ startTime: result.startTime, duration: result.duration })
      } else {
        const result = computeTrimRight(
          trimRef.current.originalDuration,
          trimRef.current.originalSourceOut,
          deltaTime,
          mediaDuration,
        )
        trimRef.current.currentDuration = result.duration
        setTrimPreview({
          startTime: trimRef.current.originalStartTime,
          duration: result.duration,
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
