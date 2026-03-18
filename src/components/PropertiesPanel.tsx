import { useEditorStore } from '@/store'
import type { EasingType, Effect } from '@/store'
import { SPEED_PRESETS, SPEED_MIN, SPEED_MAX, formatSpeed } from '@/components/speedUtils'
import {
  EASING_OPTIONS,
  clampTime,
  formatKeyframeTime,
  getEffectDisplayName,
  sortKeyframesByTime,
} from '@/components/keyframeEditorUtils'

// ---------------------------------------------------------------------------
// Keyframe editor for a single effect
// ---------------------------------------------------------------------------

function KeyframeEffectEditor({
  clipId,
  clip_duration,
  effect,
}: {
  clipId: string
  clip_duration: number
  effect: Effect
}) {
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const addKeyframe = useEditorStore((s) => s.addKeyframe)
  const removeKeyframe = useEditorStore((s) => s.removeKeyframe)
  const updateKeyframe = useEditorStore((s) => s.updateKeyframe)

  const sorted = sortKeyframesByTime(effect.keyframes)

  function handleAddKeyframe() {
    // Time is relative to clip — clamp playhead to clip duration
    const relativeTime = clampTime(currentTime, 0, clip_duration)
    addKeyframe(clipId, effect.id, { time: relativeTime, value: 0, easing: 'linear' })
  }

  return (
    <div
      style={{
        marginBottom: '12px',
        border: '1px solid #333',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {/* Effect header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: '#2a2a2a',
          fontSize: '11px',
          color: '#aaa',
        }}
      >
        <span>{getEffectDisplayName(effect.type)}</span>
        <button
          data-testid={`add-keyframe-${effect.id}`}
          onClick={handleAddKeyframe}
          style={{
            fontSize: '11px',
            padding: '2px 6px',
            background: '#333',
            border: '1px solid #555',
            color: '#ccc',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          + Add at {formatKeyframeTime(clampTime(currentTime, 0, clip_duration))}
        </button>
      </div>

      {/* Keyframe list */}
      {sorted.length === 0 ? (
        <div style={{ padding: '6px 8px', fontSize: '11px', color: '#555', fontStyle: 'italic' }}>
          No keyframes
        </div>
      ) : (
        <div>
          {sorted.map((kf) => (
            <div
              key={kf.id}
              data-testid={`keyframe-row-${kf.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: '4px',
                alignItems: 'center',
                padding: '4px 8px',
                borderTop: '1px solid #222',
                fontSize: '11px',
              }}
            >
              {/* Time */}
              <div>
                <div style={{ color: '#666', marginBottom: '1px' }}>Time</div>
                <input
                  type="number"
                  data-testid={`kf-time-${kf.id}`}
                  value={kf.time}
                  min={0}
                  max={clip_duration}
                  step={0.01}
                  onChange={(e) => {
                    const t = clampTime(parseFloat(e.target.value) || 0, 0, clip_duration)
                    updateKeyframe(clipId, effect.id, kf.id, { time: t })
                  }}
                  style={{
                    width: '100%',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    color: '#fff',
                    borderRadius: '3px',
                    padding: '2px 4px',
                    fontSize: '11px',
                  }}
                />
              </div>

              {/* Value */}
              <div>
                <div style={{ color: '#666', marginBottom: '1px' }}>Value</div>
                <input
                  type="number"
                  data-testid={`kf-value-${kf.id}`}
                  value={kf.value}
                  step={0.01}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0
                    updateKeyframe(clipId, effect.id, kf.id, { value: v })
                  }}
                  style={{
                    width: '100%',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    color: '#fff',
                    borderRadius: '3px',
                    padding: '2px 4px',
                    fontSize: '11px',
                  }}
                />
              </div>

              {/* Easing */}
              <div>
                <div style={{ color: '#666', marginBottom: '1px' }}>Easing</div>
                <select
                  data-testid={`kf-easing-${kf.id}`}
                  value={kf.easing}
                  onChange={(e) =>
                    updateKeyframe(clipId, effect.id, kf.id, {
                      easing: e.target.value as EasingType,
                    })
                  }
                  style={{
                    width: '100%',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    color: '#fff',
                    borderRadius: '3px',
                    padding: '2px 4px',
                    fontSize: '11px',
                  }}
                >
                  {EASING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delete */}
              <button
                data-testid={`kf-delete-${kf.id}`}
                onClick={() => removeKeyframe(clipId, effect.id, kf.id)}
                title="Remove keyframe"
                style={{
                  background: 'transparent',
                  border: '1px solid #444',
                  color: '#888',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  padding: '2px 5px',
                  fontSize: '12px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Keyframe section (all effects for a clip)
// ---------------------------------------------------------------------------

function KeyframeEditor({
  clipId,
  clip_duration,
  effects,
}: {
  clipId: string
  clip_duration: number
  effects: Effect[]
}) {
  if (effects.length === 0) {
    return (
      <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic', padding: '4px 0' }}>
        No effects — add an effect to use keyframes
      </div>
    )
  }

  return (
    <div>
      {effects.map((effect) => (
        <KeyframeEffectEditor
          key={effect.id}
          clipId={clipId}
          clip_duration={clip_duration}
          effect={effect}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Clip properties (speed + keyframe editor)
// ---------------------------------------------------------------------------

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

      {/* Keyframe editor */}
      <div>
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#888',
            marginBottom: '8px',
          }}
        >
          Keyframes
        </div>
        <KeyframeEditor clipId={clipId} clip_duration={clip.duration} effects={clip.effects} />
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
