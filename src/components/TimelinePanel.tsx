import { useRef, useCallback, useEffect, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import { useEditorStore } from '@/store'
import type { TrackType } from '@/store/types'
import {
  zoomAroundPoint,
  RULER_HEIGHT,
  TRACK_HEIGHT,
  TRACK_HEADER_WIDTH,
  getTracksHeight,
} from './timelineUtils'
import { DRAG_ASSET_TYPE } from './mediaBinUtils'
import { getClipBoundaryTimes, snapTime, SNAP_THRESHOLD_SEC } from './playheadUtils'
import { getSplitCandidates } from './splitUtils'
import TimeRuler from './TimeRuler'
import TrackLanesLayer from './TrackLanesLayer'
import TrackHeaders from './TrackHeaders'
import Playhead from './Playhead'

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
  const trimClip = useEditorStore((s) => s.trimClip)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const splitClip = useEditorStore((s) => s.splitClip)
  const removeClips = useEditorStore((s) => s.removeClips)
  const addClip = useEditorStore((s) => s.addClip)

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

  /** Handle click-to-seek on the ruler: apply snap then commit to store. */
  const handleRulerSeek = useCallback(
    (rawTime: number) => {
      const boundaries = getClipBoundaryTimes(tracks)
      const time = snapTime(rawTime, boundaries, SNAP_THRESHOLD_SEC)
      setCurrentTime(time)
    },
    [tracks, setCurrentTime],
  )

  const handleSplit = useCallback(() => {
    const candidates = getSplitCandidates(tracks, selectedClipIds, currentTime)
    for (const clipId of candidates) {
      splitClip(clipId, currentTime)
    }
  }, [tracks, selectedClipIds, currentTime, splitClip])

  const handleDelete = useCallback(() => {
    if (selectedClipIds.length > 0) {
      removeClips(selectedClipIds)
    }
  }, [selectedClipIds, removeClips])

  const handleTimelineDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(DRAG_ASSET_TYPE)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleTimelineDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const assetId = e.dataTransfer.getData(DRAG_ASSET_TYPE)
      if (!assetId) return
      e.preventDefault()

      const storeState = useEditorStore.getState()
      const asset = storeState.project.mediaAssets.find((a) => a.id === assetId)
      if (!asset) return

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const relX = e.clientX - rect.left
      const relY = e.clientY - rect.top

      const timelineX = relX - TRACK_HEADER_WIDTH + storeState.ui.scrollLeft
      const startTime = Math.max(0, timelineX / storeState.ui.pixelsPerSecond)

      const trackAreaY = relY - RULER_HEIGHT
      const dropTrackIndex = trackAreaY >= 0 ? Math.floor(trackAreaY / TRACK_HEIGHT) : 0

      const targetType = asset.type === 'audio' ? 'audio' : 'video'
      const currentTracks = storeState.project.tracks

      let targetTrackId: string
      if (dropTrackIndex >= 0 && dropTrackIndex < currentTracks.length) {
        targetTrackId = currentTracks[dropTrackIndex].id
      } else {
        const match = currentTracks.find((t) => t.type === targetType)
        if (match) {
          targetTrackId = match.id
        } else {
          addTrack(targetType)
          targetTrackId = useEditorStore.getState().project.tracks.slice(-1)[0].id
        }
      }

      const duration = asset.duration > 0 ? asset.duration : 5
      addClip(targetTrackId, {
        sourceId: asset.id,
        startTime,
        duration,
        sourceIn: 0,
        sourceOut: asset.duration,
        speed: 1,
        effects: [],
      })
    },
    [addTrack, addClip],
  )

  const tracksHeight = getTracksHeight(tracks.length)
  const stageHeight = Math.max(size.height, RULER_HEIGHT + tracksHeight)

  return (
    <div className="panel timeline-panel">
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Timeline</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button
            onClick={handleSplit}
            title="Split clip at playhead (S)"
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
            Split
          </button>
          <button
            onClick={handleDelete}
            title="Delete selected clip(s) (Del)"
            disabled={selectedClipIds.length === 0}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid #374151',
              background: '#1e293b',
              color: selectedClipIds.length === 0 ? '#4b5563' : '#f87171',
              cursor: selectedClipIds.length === 0 ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Delete
          </button>
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
        onDragOver={handleTimelineDragOver}
        onDrop={handleTimelineDrop}
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
              onSeek={handleRulerSeek}
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
              currentTime={currentTime}
              selectedClipIds={selectedClipIds}
              onSelectClip={selectClip}
              onMoveClip={moveClip}
              onTrimClip={trimClip}
            />
          </Layer>
          {/* Playhead layer: rendered on top of ruler and clips */}
          <Layer>
            <Playhead
              currentTime={currentTime}
              pixelsPerSecond={pixelsPerSecond}
              scrollLeft={scrollLeft}
              stageHeight={stageHeight}
              tracks={tracks}
              onSeek={setCurrentTime}
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
