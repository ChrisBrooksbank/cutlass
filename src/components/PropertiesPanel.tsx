import { useEditorStore } from '@/store'
import { SPEED_PRESETS, SPEED_MIN, SPEED_MAX, formatSpeed } from '@/components/speedUtils'

function ClipProperties({ clipId }: { clipId: string }) {
  const tracks = useEditorStore((s) => s.project.tracks)
  const setClipSpeed = useEditorStore((s) => s.setClipSpeed)

  const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId) ?? null
  if (!clip) return null

  return (
    <div style={{ padding: '8px 12px' }}>
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#888',
          marginBottom: '8px',
        }}
      >
        Clip
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            color: '#ccc',
            marginBottom: '4px',
          }}
        >
          Speed
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={0.25}
            value={clip.speed}
            data-testid="speed-slider"
            onChange={(e) => setClipSpeed(clipId, parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span
            data-testid="speed-value"
            style={{
              fontSize: '12px',
              color: '#fff',
              minWidth: '36px',
              textAlign: 'right',
            }}
          >
            {formatSpeed(clip.speed)}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset}
              data-testid={`speed-preset-${preset}`}
              onClick={() => setClipSpeed(clipId, preset)}
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                background: clip.speed === preset ? '#555' : '#333',
                border: '1px solid',
                borderColor: clip.speed === preset ? '#888' : '#444',
                color: clip.speed === preset ? '#fff' : '#aaa',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              {formatSpeed(preset)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PropertiesPanel() {
  const selectedClipIds = useEditorStore((s) => s.selection.selectedClipIds)
  const singleClipId = selectedClipIds.length === 1 ? selectedClipIds[0] : null

  return (
    <div className="panel properties-panel">
      <div className="panel-header">Properties</div>
      <div className="panel-body">
        {singleClipId ? (
          <ClipProperties clipId={singleClipId} />
        ) : (
          <div
            style={{
              padding: '12px',
              fontSize: '12px',
              color: '#666',
              fontStyle: 'italic',
            }}
          >
            {selectedClipIds.length > 1 ? 'Multiple clips selected' : 'No clip selected'}
          </div>
        )}
      </div>
    </div>
  )
}
