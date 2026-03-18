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
import { getEffectHandler } from '@/components/effectRegistry'
import { computeTextOverlay } from '@/components/textOverlayUtils'

// ---------------------------------------------------------------------------
// Blur effect parameter editor
// ---------------------------------------------------------------------------

function BlurEffectEditor({ clipId, effect }: { clipId: string; effect: Effect }) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const removeEffect = useEditorStore((s) => s.removeEffect)

  const p = effect.params
  const x = (p.x as number | undefined) ?? 0
  const y = (p.y as number | undefined) ?? 0
  const width = (p.width as number | undefined) ?? 100
  const height = (p.height as number | undefined) ?? 60
  const strength = (p.strength as number | undefined) ?? 10

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: '3px',
    padding: '2px 4px',
    fontSize: '11px',
  }
  const labelStyle: React.CSSProperties = { color: '#666', marginBottom: '1px', fontSize: '10px' }

  return (
    <div
      style={{
        marginBottom: '8px',
        border: '1px solid #333',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
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
        <span>Blur / Redact</span>
        <button
          data-testid={`remove-blur-${effect.id}`}
          onClick={() => removeEffect(clipId, effect.id)}
          title="Remove blur effect"
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#888',
            borderRadius: '3px',
            cursor: 'pointer',
            padding: '2px 5px',
            fontSize: '12px',
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          padding: '6px 8px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
        }}
      >
        <div>
          <div style={labelStyle}>X</div>
          <input
            type="number"
            data-testid={`blur-x-${effect.id}`}
            value={x}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { x: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Y</div>
          <input
            type="number"
            data-testid={`blur-y-${effect.id}`}
            value={y}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { y: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Width</div>
          <input
            type="number"
            data-testid={`blur-width-${effect.id}`}
            value={width}
            min={1}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, {
                width: Math.max(1, parseFloat(e.target.value) || 1),
              })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Height</div>
          <input
            type="number"
            data-testid={`blur-height-${effect.id}`}
            value={height}
            min={1}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, {
                height: Math.max(1, parseFloat(e.target.value) || 1),
              })
            }
            style={fieldStyle}
          />
        </div>
      </div>

      <div style={{ padding: '0 8px 6px' }}>
        <div style={labelStyle}>Strength: {strength}px</div>
        <input
          type="range"
          data-testid={`blur-strength-${effect.id}`}
          min={1}
          max={50}
          step={1}
          value={strength}
          onChange={(e) =>
            updateEffectParams(clipId, effect.id, { strength: parseInt(e.target.value, 10) })
          }
          style={{ width: '100%' }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Text overlay effect parameter editor
// ---------------------------------------------------------------------------

const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace', 'Arial', 'Georgia', 'Verdana']

function TextEffectEditor({ clipId, effect }: { clipId: string; effect: Effect }) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const removeEffect = useEditorStore((s) => s.removeEffect)

  const overlay = computeTextOverlay(effect)

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: '3px',
    padding: '2px 4px',
    fontSize: '11px',
  }
  const labelStyle: React.CSSProperties = { color: '#666', marginBottom: '1px', fontSize: '10px' }

  return (
    <div
      style={{
        marginBottom: '8px',
        border: '1px solid #333',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
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
        <span>Text Overlay</span>
        <button
          data-testid={`remove-text-${effect.id}`}
          onClick={() => removeEffect(clipId, effect.id)}
          title="Remove text overlay"
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#888',
            borderRadius: '3px',
            cursor: 'pointer',
            padding: '2px 5px',
            fontSize: '12px',
          }}
        >
          ×
        </button>
      </div>

      {/* Text content */}
      <div style={{ padding: '6px 8px' }}>
        <div style={labelStyle}>Text</div>
        <textarea
          data-testid={`text-content-${effect.id}`}
          value={overlay.text}
          rows={2}
          onChange={(e) => updateEffectParams(clipId, effect.id, { text: e.target.value })}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </div>

      {/* Position */}
      <div
        style={{
          padding: '0 8px 6px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
        }}
      >
        <div>
          <div style={labelStyle}>X</div>
          <input
            type="number"
            data-testid={`text-x-${effect.id}`}
            value={overlay.x}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { x: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Y</div>
          <input
            type="number"
            data-testid={`text-y-${effect.id}`}
            value={overlay.y}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { y: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
      </div>

      {/* Font size and color */}
      <div
        style={{
          padding: '0 8px 6px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
        }}
      >
        <div>
          <div style={labelStyle}>Font Size</div>
          <input
            type="number"
            data-testid={`text-fontsize-${effect.id}`}
            value={overlay.fontSize}
            min={6}
            max={300}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, {
                fontSize: Math.max(6, parseInt(e.target.value, 10) || 32),
              })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Color</div>
          <input
            type="color"
            data-testid={`text-color-${effect.id}`}
            value={overlay.color.startsWith('#') ? overlay.color : '#ffffff'}
            onChange={(e) => updateEffectParams(clipId, effect.id, { color: e.target.value })}
            style={{ ...fieldStyle, padding: '1px 2px', height: '24px', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Font family */}
      <div style={{ padding: '0 8px 6px' }}>
        <div style={labelStyle}>Font Family</div>
        <select
          data-testid={`text-fontfamily-${effect.id}`}
          value={overlay.fontFamily}
          onChange={(e) => updateEffectParams(clipId, effect.id, { fontFamily: e.target.value })}
          style={fieldStyle}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Effects section (add / manage effects per clip)
// ---------------------------------------------------------------------------

function EffectsSection({ clipId, effects }: { clipId: string; effects: Effect[] }) {
  const addEffect = useEditorStore((s) => s.addEffect)

  function handleAddBlur() {
    const handler = getEffectHandler('blur')
    if (!handler) return
    addEffect(clipId, { type: 'blur', params: { ...handler.defaultParams }, keyframes: [] })
  }

  function handleAddText() {
    const handler = getEffectHandler('text')
    if (!handler) return
    addEffect(clipId, { type: 'text', params: { ...handler.defaultParams }, keyframes: [] })
  }

  const blurEffects = effects.filter((e) => e.type === 'blur')
  const textEffects = effects.filter((e) => e.type === 'text')
  const hasEffects = blurEffects.length > 0 || textEffects.length > 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#888',
          }}
        >
          Effects
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            data-testid="add-blur-effect"
            onClick={handleAddBlur}
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              background: '#333',
              border: '1px solid #555',
              color: '#ccc',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            + Blur
          </button>
          <button
            data-testid="add-text-effect"
            onClick={handleAddText}
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              background: '#333',
              border: '1px solid #555',
              color: '#ccc',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            + Text
          </button>
        </div>
      </div>

      {!hasEffects ? (
        <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic', marginBottom: '8px' }}>
          No effects
        </div>
      ) : (
        <>
          {blurEffects.map((e) => (
            <BlurEffectEditor key={e.id} clipId={clipId} effect={e} />
          ))}
          {textEffects.map((e) => (
            <TextEffectEditor key={e.id} clipId={clipId} effect={e} />
          ))}
        </>
      )}
    </div>
  )
}

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

      {/* Effects section */}
      <div style={{ marginBottom: '12px' }}>
        <EffectsSection clipId={clipId} effects={clip.effects} />
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
