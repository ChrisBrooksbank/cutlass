import { useRef, useCallback } from 'react'
import { useEditorStore } from '@/store'
import { getAssetTypeFromMime, getMediaDuration } from './mediaBinUtils'
import {
  BACKGROUND_MUSIC_TRACK_NAME,
  computeBackgroundMusicInsertTime,
} from './backgroundMusicUtils'

interface BackgroundMusicControlsProps {
  onMusicAdded?: (assetId: string) => void
}

export default function BackgroundMusicControls({ onMusicAdded }: BackgroundMusicControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMediaAsset = useEditorStore((s) => s.addMediaAsset)
  const addTrack = useEditorStore((s) => s.addTrack)
  const addClip = useEditorStore((s) => s.addClip)

  const handleFile = useCallback(
    async (file: File) => {
      const assetType = getAssetTypeFromMime(file.type)
      if (assetType !== 'audio') return

      const url = URL.createObjectURL(file)
      const duration = await getMediaDuration(file)

      const asset = addMediaAsset({ name: file.name, type: 'audio', url, duration })

      // Find or create the dedicated Background Music track
      const tracks = useEditorStore.getState().project.tracks
      let bgTrack = tracks.find((t) => t.type === 'audio' && t.name === BACKGROUND_MUSIC_TRACK_NAME)
      if (!bgTrack) {
        addTrack('audio', BACKGROUND_MUSIC_TRACK_NAME)
        bgTrack = useEditorStore
          .getState()
          .project.tracks.find((t) => t.type === 'audio' && t.name === BACKGROUND_MUSIC_TRACK_NAME)!
      }

      const insertTime = computeBackgroundMusicInsertTime(useEditorStore.getState().project.tracks)
      addClip(bgTrack.id, {
        sourceId: asset.id,
        startTime: insertTime,
        duration,
        sourceIn: 0,
        sourceOut: duration,
        speed: 1,
        effects: [],
      })

      onMusicAdded?.(asset.id)
    },
    [addMediaAsset, addTrack, addClip, onMusicAdded],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        void handleFile(file)
        e.target.value = ''
      }
    },
    [handleFile],
  )

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #2e2e2e',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 12, color: '#9ca3af', flex: 1 }}>Background Music</span>
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Upload background music"
        style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 4,
          border: '1px solid #4b5563',
          background: '#1e3a2f',
          color: '#34d399',
          cursor: 'pointer',
        }}
      >
        ♫ Add
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
    </div>
  )
}
