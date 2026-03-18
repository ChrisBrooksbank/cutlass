import { Group, Rect, Line, Text } from 'react-konva'
import { getRulerTicks, RULER_HEIGHT } from './timelineUtils'

interface TimeRulerProps {
  /** Total width of the Stage (including track header). */
  width: number
  /** Width reserved for the track header on the left. */
  trackHeaderWidth: number
  pixelsPerSecond: number
  scrollLeft: number
}

export default function TimeRuler({
  width,
  trackHeaderWidth,
  pixelsPerSecond,
  scrollLeft,
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
