import { Group, Rect, Line, Text } from 'react-konva'
import type Konva from 'konva'
import { getRulerTicks, RULER_HEIGHT } from './timelineUtils'

interface TimeRulerProps {
  /** Total width of the Stage (including track header). */
  width: number
  /** Width reserved for the track header on the left. */
  trackHeaderWidth: number
  pixelsPerSecond: number
  scrollLeft: number
  /** Called with the raw (unsnapped) time in seconds when the user clicks the ruler canvas area. */
  onSeek?: (time: number) => void
}

export default function TimeRuler({
  width,
  trackHeaderWidth,
  pixelsPerSecond,
  scrollLeft,
  onSeek,
}: TimeRulerProps) {
  const viewportWidth = width - trackHeaderWidth
  const ticks = getRulerTicks(pixelsPerSecond, scrollLeft, viewportWidth)

  return (
    <Group>
      {/* Background */}
      <Rect x={0} y={0} width={width} height={RULER_HEIGHT} fill="#111827" />
      {/* Track-header blank area separator */}
      <Rect x={0} y={0} width={trackHeaderWidth} height={RULER_HEIGHT} fill="#0f172a" />
      {/* Bottom border line */}
      <Line
        points={[0, RULER_HEIGHT - 1, width, RULER_HEIGHT - 1]}
        stroke="#374151"
        strokeWidth={1}
      />
      {/* Invisible click target for click-to-seek (canvas area only, above tick marks) */}
      {onSeek && (
        <Rect
          x={trackHeaderWidth}
          y={0}
          width={viewportWidth}
          height={RULER_HEIGHT}
          fill="transparent"
          onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getPointerPosition()
            if (!pos) return
            const rawTime = Math.max(0, (pos.x - trackHeaderWidth + scrollLeft) / pixelsPerSecond)
            onSeek(rawTime)
          }}
          onMouseEnter={(e: Konva.KonvaEventObject<MouseEvent>) => {
            const stage = e.target.getStage()
            if (stage) stage.container().style.cursor = 'pointer'
          }}
          onMouseLeave={(e: Konva.KonvaEventObject<MouseEvent>) => {
            const stage = e.target.getStage()
            if (stage) stage.container().style.cursor = 'default'
          }}
        />
      )}
      {/* Tick marks and labels */}
      {ticks.map((tick) => {
        const x = trackHeaderWidth + tick.x
        if (x < trackHeaderWidth - 1 || x > width + 1) return null
        return (
          <Group key={tick.time}>
            <Line
              points={[x, RULER_HEIGHT / 2, x, RULER_HEIGHT]}
              stroke="#6b7280"
              strokeWidth={1}
            />
            <Text
              x={x + 3}
              y={5}
              text={tick.label}
              fontSize={10}
              fontFamily="monospace"
              fill="#9ca3af"
            />
          </Group>
        )
      })}
    </Group>
  )
}
