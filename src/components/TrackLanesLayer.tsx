import { Group, Rect, Line } from 'react-konva'
import type { Track, TrackType } from '@/store/types'
import { TRACK_HEIGHT, TRACK_HEADER_WIDTH } from './timelineUtils'

const TRACK_BG: Record<TrackType, string> = {
  video: '#1e293b',
  audio: '#172032',
  annotation: '#1c2130',
}

const TRACK_BG_MUTED: Record<TrackType, string> = {
  video: '#131f2e',
  audio: '#111827',
  annotation: '#131825',
}

interface TrackLanesLayerProps {
  tracks: Track[]
  width: number
  height: number
}

export default function TrackLanesLayer({ tracks, width, height }: TrackLanesLayerProps) {
  return (
    <Group>
      {/* Overall background for the tracks area */}
      <Rect x={0} y={0} width={width} height={height} fill="#0f172a" />
      {tracks.map((track, index) => {
        const y = index * TRACK_HEIGHT
        const bg = track.muted ? TRACK_BG_MUTED[track.type] : TRACK_BG[track.type]
        return (
          <Group key={track.id}>
            {/* Lane background (canvas area only, header handled by DOM) */}
            <Rect
              x={TRACK_HEADER_WIDTH}
              y={y}
              width={width - TRACK_HEADER_WIDTH}
              height={TRACK_HEIGHT}
              fill={bg}
            />
            {/* Row separator */}
            <Line
              points={[0, y + TRACK_HEIGHT, width, y + TRACK_HEIGHT]}
              stroke="#374151"
              strokeWidth={1}
            />
          </Group>
        )
      })}
    </Group>
  )
}
