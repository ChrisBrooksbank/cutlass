import { useEditorStore } from '@/store'
import type { EasingType, Effect, TransitionType } from '@/store'
import {
  TRANSITION_TYPE_OPTIONS,
  TRANSITION_DURATION_MIN,
  TRANSITION_DURATION_MAX,
  TRANSITION_DURATION_DEFAULT,
  clampTransitionDuration,
} from '@/components/transitionUtils'
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
import {
  computeShapeRect,
  computeShapeCircle,
  computeShapeArrow,
} from '@/components/shapeAnnotationUtils'
import { computeCropRegion } from '@/components/cropUtils'
import { INTRO_OUTRO_STYLES, computeIntroOutroScene } from '@/components/introOutroUtils'

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
// Shape rect effect editor
// ---------------------------------------------------------------------------

function ShapeRectEditor({ clipId, effect }: { clipId: string; effect: Effect }) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const removeEffect = useEditorStore((s) => s.removeEffect)

  const shape = computeShapeRect(effect)

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
        <span>Rectangle</span>
        <button
          data-testid={`remove-shape-rect-${effect.id}`}
          onClick={() => removeEffect(clipId, effect.id)}
          title="Remove rectangle"
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
            data-testid={`shape-rect-x-${effect.id}`}
            value={shape.x}
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
            data-testid={`shape-rect-y-${effect.id}`}
            value={shape.y}
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
            data-testid={`shape-rect-width-${effect.id}`}
            value={shape.width}
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
            data-testid={`shape-rect-height-${effect.id}`}
            value={shape.height}
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
        <div>
          <div style={labelStyle}>Stroke Color</div>
          <input
            type="color"
            data-testid={`shape-rect-stroke-color-${effect.id}`}
            value={shape.strokeColor.startsWith('#') ? shape.strokeColor : '#ff4444'}
            onChange={(e) => updateEffectParams(clipId, effect.id, { strokeColor: e.target.value })}
            style={{ ...fieldStyle, padding: '1px 2px', height: '24px', cursor: 'pointer' }}
          />
        </div>
        <div>
          <div style={labelStyle}>Stroke Width</div>
          <input
            type="number"
            data-testid={`shape-rect-stroke-width-${effect.id}`}
            value={shape.strokeWidth}
            min={1}
            max={20}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, {
                strokeWidth: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            style={fieldStyle}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shape circle effect editor
// ---------------------------------------------------------------------------

function ShapeCircleEditor({ clipId, effect }: { clipId: string; effect: Effect }) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const removeEffect = useEditorStore((s) => s.removeEffect)

  const shape = computeShapeCircle(effect)

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
        <span>Circle</span>
        <button
          data-testid={`remove-shape-circle-${effect.id}`}
          onClick={() => removeEffect(clipId, effect.id)}
          title="Remove circle"
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
          <div style={labelStyle}>Center X</div>
          <input
            type="number"
            data-testid={`shape-circle-x-${effect.id}`}
            value={shape.x}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { x: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Center Y</div>
          <input
            type="number"
            data-testid={`shape-circle-y-${effect.id}`}
            value={shape.y}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { y: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Radius X</div>
          <input
            type="number"
            data-testid={`shape-circle-radiusX-${effect.id}`}
            value={shape.radiusX}
            min={1}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, {
                radiusX: Math.max(1, parseFloat(e.target.value) || 1),
              })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Radius Y</div>
          <input
            type="number"
            data-testid={`shape-circle-radiusY-${effect.id}`}
            value={shape.radiusY}
            min={1}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, {
                radiusY: Math.max(1, parseFloat(e.target.value) || 1),
              })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Stroke Color</div>
          <input
            type="color"
            data-testid={`shape-circle-stroke-color-${effect.id}`}
            value={shape.strokeColor.startsWith('#') ? shape.strokeColor : '#44aaff'}
            onChange={(e) => updateEffectParams(clipId, effect.id, { strokeColor: e.target.value })}
            style={{ ...fieldStyle, padding: '1px 2px', height: '24px', cursor: 'pointer' }}
          />
        </div>
        <div>
          <div style={labelStyle}>Stroke Width</div>
          <input
            type="number"
            data-testid={`shape-circle-stroke-width-${effect.id}`}
            value={shape.strokeWidth}
            min={1}
            max={20}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, {
                strokeWidth: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            style={fieldStyle}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shape arrow effect editor
// ---------------------------------------------------------------------------

function ShapeArrowEditor({ clipId, effect }: { clipId: string; effect: Effect }) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const removeEffect = useEditorStore((s) => s.removeEffect)

  const shape = computeShapeArrow(effect)

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
        <span>Arrow</span>
        <button
          data-testid={`remove-shape-arrow-${effect.id}`}
          onClick={() => removeEffect(clipId, effect.id)}
          title="Remove arrow"
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
          <div style={labelStyle}>Start X</div>
          <input
            type="number"
            data-testid={`shape-arrow-x1-${effect.id}`}
            value={shape.x1}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { x1: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Start Y</div>
          <input
            type="number"
            data-testid={`shape-arrow-y1-${effect.id}`}
            value={shape.y1}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { y1: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>End X</div>
          <input
            type="number"
            data-testid={`shape-arrow-x2-${effect.id}`}
            value={shape.x2}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { x2: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>End Y</div>
          <input
            type="number"
            data-testid={`shape-arrow-y2-${effect.id}`}
            value={shape.y2}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, { y2: parseFloat(e.target.value) || 0 })
            }
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Color</div>
          <input
            type="color"
            data-testid={`shape-arrow-color-${effect.id}`}
            value={shape.color.startsWith('#') ? shape.color : '#ffdd00'}
            onChange={(e) => updateEffectParams(clipId, effect.id, { color: e.target.value })}
            style={{ ...fieldStyle, padding: '1px 2px', height: '24px', cursor: 'pointer' }}
          />
        </div>
        <div>
          <div style={labelStyle}>Stroke Width</div>
          <input
            type="number"
            data-testid={`shape-arrow-stroke-width-${effect.id}`}
            value={shape.strokeWidth}
            min={1}
            max={20}
            step={1}
            onChange={(e) =>
              updateEffectParams(clipId, effect.id, {
                strokeWidth: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            style={fieldStyle}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Crop effect parameter editor
// ---------------------------------------------------------------------------

function CropEffectEditor({ clipId, effect }: { clipId: string; effect: Effect }) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const removeEffect = useEditorStore((s) => s.removeEffect)

  const region = computeCropRegion(effect)

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
        <span>Crop</span>
        <button
          data-testid={`remove-crop-${effect.id}`}
          onClick={() => removeEffect(clipId, effect.id)}
          title="Remove crop"
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
            data-testid={`crop-x-${effect.id}`}
            value={region.x}
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
            data-testid={`crop-y-${effect.id}`}
            value={region.y}
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
            data-testid={`crop-width-${effect.id}`}
            value={region.width}
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
            data-testid={`crop-height-${effect.id}`}
            value={region.height}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transition section (add / edit / remove transition at clip end)
// ---------------------------------------------------------------------------

function TransitionSection({ clipId }: { clipId: string }) {
  const tracks = useEditorStore((s) => s.project.tracks)
  const setClipTransition = useEditorStore((s) => s.setClipTransition)

  const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId)
  if (!clip) return null

  const transition = clip.transitionOut ?? null

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

  function handleToggle() {
    if (transition) {
      setClipTransition(clipId, null)
    } else {
      setClipTransition(clipId, { type: 'cross-dissolve', duration: TRANSITION_DURATION_DEFAULT })
    }
  }

  function handleTypeChange(type: TransitionType) {
    setClipTransition(clipId, {
      type,
      duration: transition?.duration ?? TRANSITION_DURATION_DEFAULT,
    })
  }

  function handleDurationChange(raw: number) {
    const duration = clampTransitionDuration(raw)
    setClipTransition(clipId, { type: transition!.type, duration })
  }

  return (
    <div style={{ marginBottom: '12px' }}>
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
          Transition (out)
        </div>
        <button
          data-testid="toggle-transition"
          onClick={handleToggle}
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: transition ? '#444' : '#333',
            border: '1px solid #555',
            color: transition ? '#fff' : '#ccc',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {transition ? 'Remove' : '+ Add'}
        </button>
      </div>

      {transition && (
        <div
          style={{
            border: '1px solid #333',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{ padding: '6px 8px', display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}
          >
            <div>
              <div style={labelStyle}>Type</div>
              <select
                data-testid="transition-type"
                value={transition.type}
                onChange={(e) => handleTypeChange(e.target.value as TransitionType)}
                style={fieldStyle}
              >
                {TRANSITION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Duration: {transition.duration.toFixed(2)}s</div>
              <input
                type="range"
                data-testid="transition-duration"
                min={TRANSITION_DURATION_MIN}
                max={TRANSITION_DURATION_MAX}
                step={0.1}
                value={transition.duration}
                onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}

      {!transition && (
        <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic' }}>No transition</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Intro / Outro effect parameter editor
// ---------------------------------------------------------------------------

function IntroOutroEffectEditor({ clipId, effect }: { clipId: string; effect: Effect }) {
  const updateEffectParams = useEditorStore((s) => s.updateEffectParams)
  const removeEffect = useEditorStore((s) => s.removeEffect)

  const scene = computeIntroOutroScene(effect)

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
        <span>Intro / Outro</span>
        <button
          data-testid={`remove-intro-outro-${effect.id}`}
          onClick={() => removeEffect(clipId, effect.id)}
          title="Remove intro/outro"
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

      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div>
          <div style={labelStyle}>Style</div>
          <select
            data-testid={`intro-outro-style-${effect.id}`}
            value={scene.style}
            onChange={(e) => updateEffectParams(clipId, effect.id, { style: e.target.value })}
            style={fieldStyle}
          >
            {INTRO_OUTRO_STYLES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={labelStyle}>Title</div>
          <input
            type="text"
            data-testid={`intro-outro-title-${effect.id}`}
            value={scene.title}
            onChange={(e) => updateEffectParams(clipId, effect.id, { title: e.target.value })}
            style={fieldStyle}
          />
        </div>

        <div>
          <div style={labelStyle}>Subtitle</div>
          <input
            type="text"
            data-testid={`intro-outro-subtitle-${effect.id}`}
            value={scene.subtitle}
            onChange={(e) => updateEffectParams(clipId, effect.id, { subtitle: e.target.value })}
            style={fieldStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          <div>
            <div style={labelStyle}>Background</div>
            <input
              type="color"
              data-testid={`intro-outro-bg-color-${effect.id}`}
              value={scene.bgColor}
              onChange={(e) => updateEffectParams(clipId, effect.id, { bgColor: e.target.value })}
              style={{ ...fieldStyle, padding: '1px 2px', height: '24px', cursor: 'pointer' }}
            />
          </div>
          <div>
            <div style={labelStyle}>Text</div>
            <input
              type="color"
              data-testid={`intro-outro-text-color-${effect.id}`}
              value={scene.textColor}
              onChange={(e) => updateEffectParams(clipId, effect.id, { textColor: e.target.value })}
              style={{ ...fieldStyle, padding: '1px 2px', height: '24px', cursor: 'pointer' }}
            />
          </div>
          <div>
            <div style={labelStyle}>Accent</div>
            <input
              type="color"
              data-testid={`intro-outro-accent-color-${effect.id}`}
              value={scene.accentColor}
              onChange={(e) =>
                updateEffectParams(clipId, effect.id, { accentColor: e.target.value })
              }
              style={{ ...fieldStyle, padding: '1px 2px', height: '24px', cursor: 'pointer' }}
            />
          </div>
        </div>
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

  function handleAddShapeRect() {
    const handler = getEffectHandler('shape-rect')
    if (!handler) return
    addEffect(clipId, { type: 'shape-rect', params: { ...handler.defaultParams }, keyframes: [] })
  }

  function handleAddShapeCircle() {
    const handler = getEffectHandler('shape-circle')
    if (!handler) return
    addEffect(clipId, {
      type: 'shape-circle',
      params: { ...handler.defaultParams },
      keyframes: [],
    })
  }

  function handleAddShapeArrow() {
    const handler = getEffectHandler('shape-arrow')
    if (!handler) return
    addEffect(clipId, {
      type: 'shape-arrow',
      params: { ...handler.defaultParams },
      keyframes: [],
    })
  }

  function handleAddCrop() {
    const handler = getEffectHandler('crop')
    if (!handler) return
    addEffect(clipId, { type: 'crop', params: { ...handler.defaultParams }, keyframes: [] })
  }

  function handleAddIntroOutro() {
    const handler = getEffectHandler('intro-outro')
    if (!handler) return
    addEffect(clipId, { type: 'intro-outro', params: { ...handler.defaultParams }, keyframes: [] })
  }

  const blurEffects = effects.filter((e) => e.type === 'blur')
  const textEffects = effects.filter((e) => e.type === 'text')
  const rectEffects = effects.filter((e) => e.type === 'shape-rect')
  const circleEffects = effects.filter((e) => e.type === 'shape-circle')
  const arrowEffects = effects.filter((e) => e.type === 'shape-arrow')
  const cropEffects = effects.filter((e) => e.type === 'crop')
  const introOutroEffects = effects.filter((e) => e.type === 'intro-outro')
  const hasEffects =
    blurEffects.length > 0 ||
    textEffects.length > 0 ||
    rectEffects.length > 0 ||
    circleEffects.length > 0 ||
    arrowEffects.length > 0 ||
    cropEffects.length > 0 ||
    introOutroEffects.length > 0

  const btnStyle: React.CSSProperties = {
    fontSize: '11px',
    padding: '2px 8px',
    background: '#333',
    border: '1px solid #555',
    color: '#ccc',
    borderRadius: '3px',
    cursor: 'pointer',
  }

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
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button data-testid="add-blur-effect" onClick={handleAddBlur} style={btnStyle}>
            + Blur
          </button>
          <button data-testid="add-text-effect" onClick={handleAddText} style={btnStyle}>
            + Text
          </button>
          <button data-testid="add-shape-rect-effect" onClick={handleAddShapeRect} style={btnStyle}>
            + Rect
          </button>
          <button
            data-testid="add-shape-circle-effect"
            onClick={handleAddShapeCircle}
            style={btnStyle}
          >
            + Circle
          </button>
          <button
            data-testid="add-shape-arrow-effect"
            onClick={handleAddShapeArrow}
            style={btnStyle}
          >
            + Arrow
          </button>
          <button data-testid="add-crop-effect" onClick={handleAddCrop} style={btnStyle}>
            + Crop
          </button>
          <button
            data-testid="add-intro-outro-effect"
            onClick={handleAddIntroOutro}
            style={btnStyle}
          >
            + Intro/Outro
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
          {rectEffects.map((e) => (
            <ShapeRectEditor key={e.id} clipId={clipId} effect={e} />
          ))}
          {circleEffects.map((e) => (
            <ShapeCircleEditor key={e.id} clipId={clipId} effect={e} />
          ))}
          {arrowEffects.map((e) => (
            <ShapeArrowEditor key={e.id} clipId={clipId} effect={e} />
          ))}
          {cropEffects.map((e) => (
            <CropEffectEditor key={e.id} clipId={clipId} effect={e} />
          ))}
          {introOutroEffects.map((e) => (
            <IntroOutroEffectEditor key={e.id} clipId={clipId} effect={e} />
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

      {/* Transition section */}
      <div style={{ marginBottom: '12px' }}>
        <TransitionSection clipId={clipId} />
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
