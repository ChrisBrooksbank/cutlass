import { useState } from 'react'
import { useEditorStore } from '@/store'
import type { Track, TrackType } from '@/store/types'
import { TRACK_HEIGHT } from './timelineUtils'

const TYPE_COLOR: Record<TrackType, string> = {
  video: '#3b82f6',
  audio: '#10b981',
  annotation: '#f59e0b',
}

const TYPE_LABEL: Record<TrackType, string> = {
  video: 'V',
  audio: 'A',
  annotation: 'N',
}

interface TrackHeaderRowProps {
  track: Track
  index: number
  total: number
}

function TrackHeaderRow({ track, index, total }: TrackHeaderRowProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(track.name)

  const setTrackMuted = useEditorStore((s) => s.setTrackMuted)
  const setTrackLocked = useEditorStore((s) => s.setTrackLocked)
  const removeTrack = useEditorStore((s) => s.removeTrack)
  const reorderTracks = useEditorStore((s) => s.reorderTracks)
  const renameTrack = useEditorStore((s) => s.renameTrack)
  const selectTrack = useEditorStore((s) => s.selectTrack)
  const selectedTrackId = useEditorStore((s) => s.selection.selectedTrackId)
  const tracks = useEditorStore((s) => s.project.tracks)

  const isSelected = selectedTrackId === track.id

  function swapTracks(a: number, b: number) {
    const ids = tracks.map((t) => t.id)
    ;[ids[a], ids[b]] = [ids[b], ids[a]]
    reorderTracks(ids)
  }

  function handleRenameSubmit() {
    const trimmed = editName.trim()
    if (trimmed) renameTrack(track.id, trimmed)
    setEditing(false)
  }

  return (
    <div
      data-testid={`track-header-${track.id}`}
      style={{
        height: TRACK_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '0 6px',
        borderBottom: '1px solid #374151',
        background: isSelected ? '#1e3a5f' : 'transparent',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
      onClick={() => selectTrack(track.id)}
    >
      {/* Track type badge */}
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          background: TYPE_COLOR[track.type],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
          userSelect: 'none',
        }}
        title={track.type}
      >
        {TYPE_LABEL[track.type]}
      </span>

      {/* Track name */}
      {editing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit()
            if (e.key === 'Escape') {
              setEditName(track.name)
              setEditing(false)
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            background: '#374151',
            border: '1px solid #4b5563',
            borderRadius: 3,
            color: '#f3f4f6',
            padding: '1px 4px',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            color: track.muted ? '#6b7280' : '#e2e8f0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditName(track.name)
            setEditing(true)
          }}
          title={`${track.name} (double-click to rename)`}
        >
          {track.name}
        </span>
      )}

      {/* Reorder up */}
      <button
        title="Move up"
        disabled={index === 0}
        onClick={(e) => {
          e.stopPropagation()
          swapTracks(index - 1, index)
        }}
        style={{
          width: 14,
          height: 14,
          borderRadius: 2,
          border: 'none',
          background: 'transparent',
          color: index === 0 ? '#374151' : '#6b7280',
          fontSize: 10,
          cursor: index === 0 ? 'default' : 'pointer',
          flexShrink: 0,
          padding: 0,
          lineHeight: 1,
        }}
      >
        ^
      </button>

      {/* Reorder down */}
      <button
        title="Move down"
        disabled={index === total - 1}
        onClick={(e) => {
          e.stopPropagation()
          swapTracks(index, index + 1)
        }}
        style={{
          width: 14,
          height: 14,
          borderRadius: 2,
          border: 'none',
          background: 'transparent',
          color: index === total - 1 ? '#374151' : '#6b7280',
          fontSize: 10,
          cursor: index === total - 1 ? 'default' : 'pointer',
          flexShrink: 0,
          padding: 0,
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        ^
      </button>

      {/* Mute toggle */}
      <button
        title={track.muted ? 'Unmute' : 'Mute'}
        onClick={(e) => {
          e.stopPropagation()
          setTrackMuted(track.id, !track.muted)
        }}
        style={{
          width: 18,
          height: 18,
          borderRadius: 3,
          border: 'none',
          background: track.muted ? '#3b82f6' : '#374151',
          color: track.muted ? '#fff' : '#9ca3af',
          fontSize: 9,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
        }}
      >
        M
      </button>

      {/* Lock toggle */}
      <button
        title={track.locked ? 'Unlock' : 'Lock'}
        onClick={(e) => {
          e.stopPropagation()
          setTrackLocked(track.id, !track.locked)
        }}
        style={{
          width: 18,
          height: 18,
          borderRadius: 3,
          border: 'none',
          background: track.locked ? '#f59e0b' : '#374151',
          color: track.locked ? '#1f2937' : '#9ca3af',
          fontSize: 9,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
        }}
      >
        L
      </button>

      {/* Remove track */}
      <button
        title="Remove track"
        onClick={(e) => {
          e.stopPropagation()
          removeTrack(track.id)
        }}
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          border: 'none',
          background: 'transparent',
          color: '#6b7280',
          fontSize: 14,
          fontWeight: 400,
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        x
      </button>
    </div>
  )
}

export default function TrackHeaders() {
  const tracks = useEditorStore((s) => s.project.tracks)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      }}
    >
      {tracks.map((track, index) => (
        <TrackHeaderRow key={track.id} track={track} index={index} total={tracks.length} />
      ))}
    </div>
  )
}
