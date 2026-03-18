import { useRef, useCallback, useEffect, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import { useEditorStore } from '@/store'
import type { TrackType } from '@/store/types'
import { zoomAroundPoint, RULER_HEIGHT, TRACK_HEADER_WIDTH, getTracksHeight } from './timelineUtils'
import TimeRuler from './TimeRuler'
import TrackLanesLayer from './TrackLanesLayer'
import TrackHeaders from './TrackHeaders'

// Re-export for components that previously imported from here
export { TRACK_HEADER_WIDTH } from './timelineUtils'

const ADD_TRACK_TYPES: { type: TrackType; label: string }[] = [
  { type: 'video', label: '+ Video' },
  { type: 'audio', label: '+ Audio' },
  { type: 'annotation', label: '+ Annotation' },
]

export default function TimelinePanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 200 })

  const pixelsPerSecond = useEditorStore((s) => s.ui.pixelsPerSecond)
  const scrollLeft = useEditorStore((s) => s.ui.scrollLeft)
  const setPixelsPerSecond = useEditorStore((s) => s.setPixelsPerSecond)
  const setScrollLeft = useEditorStore((s) => s.setScrollLeft)
  const addTrack = useEditorStore((s) => s.addTrack)
  const tracks = useEditorStore((s) => s.project.tracks)
  const mediaAssets = useEditorStore((s) => s.project.mediaAssets)
  const selectedClipIds = useEditorStore((s) => s.selection.selectedClipIds)
  const selectClip = useEditorStore((s) => s.selectClip)
  const moveClip = useEditorStore((s) => s.moveClip)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const scaleFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1
        const focalPx = e.nativeEvent.offsetX - TRACK_HEADER_WIDTH
        const result = zoomAroundPoint(pixelsPerSecond, scrollLeft, focalPx, scaleFactor)
        setPixelsPerSecond(result.pps)
        setScrollLeft(result.scrollLeft)
      } else {
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY
        setScrollLeft(Math.max(0, scrollLeft + delta))
      }
    },
    [pixelsPerSecond, scrollLeft, setPixelsPerSecond, setScrollLeft],
  )

  const tracksHeight = getTracksHeight(tracks.length)
  const stageHeight = Math.max(size.height, RULER_HEIGHT + tracksHeight)

  return (
    <div className="panel timeline-panel">
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Timeline</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {ADD_TRACK_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => addTrack(type)}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid #374151',
                background: '#1e293b',
                color: '#9ca3af',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={containerRef}
        className="panel-body"
        onWheel={handleWheel}
        style={{ overflow: 'hidden', position: 'relative' }}
      >
        {/* Konva canvas: ruler + track lane backgrounds */}
        <Stage width={size.width} height={stageHeight}>
          <Layer>
            <TimeRuler
              width={size.width}
              trackHeaderWidth={TRACK_HEADER_WIDTH}
              pixelsPerSecond={pixelsPerSecond}
              scrollLeft={scrollLeft}
            />
          </Layer>
          <Layer y={RULER_HEIGHT}>
            <TrackLanesLayer
              tracks={tracks}
              width={size.width}
              height={stageHeight - RULER_HEIGHT}
              mediaAssets={mediaAssets}
              pixelsPerSecond={pixelsPerSecond}
              scrollLeft={scrollLeft}
              selectedClipIds={selectedClipIds}
              onSelectClip={selectClip}
              onMoveClip={moveClip}
            />
          </Layer>
        </Stage>

        {/* DOM overlay: track header controls (left column) */}
        <div
          style={{
            position: 'absolute',
            top: RULER_HEIGHT,
            left: 0,
            width: TRACK_HEADER_WIDTH,
            pointerEvents: 'auto',
            background: '#0f172a',
          }}
        >
          <TrackHeaders />
        </div>
      </div>
    </div>
  )
}
