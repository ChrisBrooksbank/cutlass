import { useRef, useCallback } from 'react'
import { useEditorStore } from '@/store'
import type { MediaAsset } from '@/store'
import { DRAG_ASSET_TYPE, getAssetTypeFromMime, getMediaDuration } from './mediaBinUtils'
import RecordingControls from './RecordingControls'
import VoiceoverControls from './VoiceoverControls'
import BackgroundMusicControls from './BackgroundMusicControls'
import { extractVideoThumbnail } from './thumbnailUtils'
import { computeTimelineInsertTime, computeVoiceoverInsertTime } from './recordingUtils'

function assetIcon(type: MediaAsset['type']): string {
  if (type === 'video') return '▶'
  if (type === 'audio') return '♫'
  return '⬜'
}

function assetIconColor(type: MediaAsset['type']): string {
  if (type === 'video') return '#60a5fa'
  if (type === 'audio') return '#34d399'
  return '#f59e0b'
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function MediaBin() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaAssets = useEditorStore((s) => s.project.mediaAssets)
  const addMediaAsset = useEditorStore((s) => s.addMediaAsset)
  const removeMediaAsset = useEditorStore((s) => s.removeMediaAsset)
  const addTrack = useEditorStore((s) => s.addTrack)
  const addClip = useEditorStore((s) => s.addClip)

  const handleRecordingComplete = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      const url = URL.createObjectURL(blob)
      const name = `Screen Recording ${new Date().toLocaleTimeString()}`

      let thumbnail: string | undefined
      try {
        thumbnail = await extractVideoThumbnail(url, 0)
      } catch {
        // Thumbnail extraction failed; proceed without it
      }

      const asset = addMediaAsset({
        name,
        type: 'video',
        url,
        duration: durationSeconds,
        thumbnail,
      })

      // Find or create a video track
      const tracks = useEditorStore.getState().project.tracks
      let videoTrack = tracks.find((t) => t.type === 'video')
      if (!videoTrack) {
        addTrack('video')
        videoTrack = useEditorStore.getState().project.tracks.find((t) => t.type === 'video')!
      }

      const insertTime = computeTimelineInsertTime(useEditorStore.getState().project.tracks)
      addClip(videoTrack.id, {
        sourceId: asset.id,
        startTime: insertTime,
        duration: durationSeconds,
        sourceIn: 0,
        sourceOut: durationSeconds,
        speed: 1,
        effects: [],
      })
    },
    [addMediaAsset, addTrack, addClip],
  )

  const handleVoiceoverComplete = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      const url = URL.createObjectURL(blob)
      const name = `Voiceover ${new Date().toLocaleTimeString()}`

      const asset = addMediaAsset({
        name,
        type: 'audio',
        url,
        duration: durationSeconds,
      })

      // Find or create an audio track for voiceover
      const tracks = useEditorStore.getState().project.tracks
      let audioTrack = tracks.find((t) => t.type === 'audio')
      if (!audioTrack) {
        addTrack('audio')
        audioTrack = useEditorStore.getState().project.tracks.find((t) => t.type === 'audio')!
      }

      const insertTime = computeVoiceoverInsertTime(useEditorStore.getState().project.tracks)
      addClip(audioTrack.id, {
        sourceId: asset.id,
        startTime: insertTime,
        duration: durationSeconds,
        sourceIn: 0,
        sourceOut: durationSeconds,
        speed: 1,
        effects: [],
      })
    },
    [addMediaAsset, addTrack, addClip],
  )

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const assetType = getAssetTypeFromMime(file.type)
        if (!assetType) continue
        const url = URL.createObjectURL(file)
        const duration = await getMediaDuration(file)
        addMediaAsset({ name: file.name, type: assetType, url, duration })
      }
    },
    [addMediaAsset],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target
      if (files && files.length > 0) {
        void processFiles(files)
        e.target.value = ''
      }
    },
    [processFiles],
  )

  const handleDropZoneDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer.items).some((item) => item.kind === 'file')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDropZoneDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const { files } = e.dataTransfer
      if (files.length > 0) {
        void processFiles(files)
      }
    },
    [processFiles],
  )

  const handleAssetDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, asset: MediaAsset) => {
      e.dataTransfer.setData(DRAG_ASSET_TYPE, asset.id)
      e.dataTransfer.effectAllowed = 'copy'
    },
    [],
  )

  return (
    <div className="panel media-bin">
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Media Bin</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid #374151',
            background: '#1e293b',
            color: '#9ca3af',
            cursor: 'pointer',
          }}
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </div>
      <RecordingControls onRecordingComplete={handleRecordingComplete} />
      <VoiceoverControls onVoiceoverComplete={handleVoiceoverComplete} />
      <BackgroundMusicControls />
      <div
        className="panel-body"
        onDragOver={handleDropZoneDragOver}
        onDrop={handleDropZoneDrop}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {mediaAssets.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#4b5563',
              fontSize: 12,
              gap: 8,
              userSelect: 'none',
            }}
          >
            <span>Drop files here</span>
            <span>or click Import</span>
          </div>
        )}
        {mediaAssets.map((asset) => (
          <div
            key={asset.id}
            draggable
            onDragStart={(e) => handleAssetDragStart(e, asset)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: 'grab',
              borderBottom: '1px solid #2e2e2e',
              fontSize: 12,
            }}
          >
            <span style={{ color: assetIconColor(asset.type), fontSize: 14, flexShrink: 0 }}>
              {assetIcon(asset.type)}
            </span>
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: '#d1d5db',
              }}
            >
              {asset.name}
            </span>
            <span style={{ color: '#6b7280', fontSize: 11, flexShrink: 0 }}>
              {asset.duration > 0 ? formatDuration(asset.duration) : '—'}
            </span>
            <button
              onClick={() => removeMediaAsset(asset.id)}
              title="Remove from bin"
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
