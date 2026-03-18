import { useRef } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { Clip, MediaAsset, Track } from '@/store/types'
import { TRACK_HEIGHT, TRACK_HEADER_WIDTH } from './timelineUtils'
import {
  CLIP_COLOR,
  CLIP_COLOR_SELECTED,
  CLIP_PADDING,
  CLIP_CORNER_RADIUS,
  clipCanvasX,
  clipCanvasY,
  clipCanvasWidth,
  canvasXToStartTime,
  canvasYToTrackIndex,
} from './clipBlockUtils'

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
}: ClipBlockProps) {
  const groupRef = useRef<Konva.Group>(null)

  const x = clipCanvasX(clip.startTime, pixelsPerSecond, scrollLeft)
  const y = clipCanvasY(trackIndex)
  const w = clipCanvasWidth(clip.duration, pixelsPerSecond)
  const h = TRACK_HEIGHT

  const fill = isSelected
    ? (CLIP_COLOR_SELECTED[track.type] ?? '#93c5fd')
    : (CLIP_COLOR[track.type] ?? '#3b82f6')

  const innerW = Math.max(0, w - CLIP_PADDING * 2)
  const innerH = h - CLIP_PADDING * 2

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
    </Group>
  )
}
