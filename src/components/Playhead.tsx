import { useRef } from 'react'
import { Group, Line, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Track } from '@/store/types'
import { TRACK_HEADER_WIDTH } from './timelineUtils'
import { getClipBoundaryTimes, snapTime, SNAP_THRESHOLD_SEC } from './playheadUtils'

interface PlayheadProps {
  currentTime: number
  pixelsPerSecond: number
  scrollLeft: number
  stageHeight: number
  tracks: Track[]
  onSeek: (time: number) => void
}

/** Width of the drag handle rectangle (px). */
const HANDLE_WIDTH = 12
/** Height of the drag handle rectangle (px). */
const HANDLE_HEIGHT = 14

export default function Playhead({
  currentTime,
  pixelsPerSecond,
  scrollLeft,
  stageHeight,
  tracks,
  onSeek,
}: PlayheadProps) {
  const isDragging = useRef(false)
  const x = TRACK_HEADER_WIDTH + currentTime * pixelsPerSecond - scrollLeft

  function startDrag(e: Konva.KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true
    const stage = e.target.getStage()
    if (!stage) return
    // Assign to a non-null const so TypeScript is happy inside the closures below
    const safeStage = stage

    isDragging.current = true
    safeStage.container().style.cursor = 'ew-resize'

    // Capture zoom/scroll/tracks state at drag start to avoid stale closures
    const capturedPps = pixelsPerSecond
    const capturedScrollLeft = scrollLeft
    const capturedTracks = tracks

    function onMouseMove() {
      const pos = safeStage.getPointerPosition()
      if (!pos) return
      const rawTime = Math.max(0, (pos.x - TRACK_HEADER_WIDTH + capturedScrollLeft) / capturedPps)
      const boundaries = getClipBoundaryTimes(capturedTracks)
      const time = snapTime(rawTime, boundaries, SNAP_THRESHOLD_SEC)
      onSeek(time)
    }

    function onMouseUp() {
      isDragging.current = false
      safeStage.off('mousemove.playhead', onMouseMove)
      safeStage.off('mouseup.playhead', onMouseUp)
      safeStage.container().style.cursor = 'default'
    }

    safeStage.on('mousemove.playhead', onMouseMove)
    safeStage.on('mouseup.playhead', onMouseUp)
  }

  return (
    <Group x={x} y={0}>
      {/* Vertical line spanning full stage height — non-interactive */}
      <Line points={[0, 0, 0, stageHeight]} stroke="#ef4444" strokeWidth={1.5} listening={false} />
      {/* Drag handle in the ruler area */}
      <Rect
        x={-HANDLE_WIDTH / 2}
        y={2}
        width={HANDLE_WIDTH}
        height={HANDLE_HEIGHT}
        fill="#ef4444"
        cornerRadius={2}
        onMouseDown={startDrag}
        onMouseEnter={(e) => {
          const stage = e.target.getStage()
          if (stage) stage.container().style.cursor = 'ew-resize'
        }}
        onMouseLeave={(e) => {
          if (!isDragging.current) {
            const stage = e.target.getStage()
            if (stage) stage.container().style.cursor = 'default'
          }
        }}
      />
    </Group>
  )
}
