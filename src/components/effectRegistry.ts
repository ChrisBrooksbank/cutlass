import type { Effect } from '@/store/types'
import { computeKenBurnsTransform, applyKenBurnsTransform } from './kenBurnsUtils'
import { computeBlurRegion, renderBlurRegion } from './blurUtils'
import { computeCursorPosition, renderCursorHighlight } from './cursorHighlightUtils'
import {
  computeShapeRect,
  computeShapeCircle,
  computeShapeArrow,
  renderShapeRect,
  renderShapeCircle,
  renderShapeArrow,
} from './shapeAnnotationUtils'
import { computeCropRegion } from './cropUtils'
import {
  computeIntroOutroScene,
  renderIntroOutroScene,
  introOutroToFFmpegFilter,
  INTRO_OUTRO_DEFAULT_PARAMS,
} from './introOutroUtils'

/** Escape a string for use in FFmpeg's drawtext filter value. */
function escapeDrawtext(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/;/g, '\\;')
}

/** Expand a 3-digit hex (e.g. '#fff') to 6-digit ('0xffffff'), or convert 6-digit '#rrggbb' to '0xrrggbb'. */
function hexToFFmpegColor(hex: string): string {
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length === 3) {
    const expanded = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    return `0x${expanded}`
  }
  return `0x${h}`
}

// ---------------------------------------------------------------------------
// Context types passed to each handler
// ---------------------------------------------------------------------------

export interface RenderContext {
  /** 2D canvas context for drawing overlays */
  ctx: CanvasRenderingContext2D
  /** Canvas / project width in pixels */
  width: number
  /** Canvas / project height in pixels */
  height: number
  /** Playback time relative to clip start (seconds) */
  clipTime: number
}

export interface ExportContext {
  /** Zero-based clip index in the FFmpeg input list */
  clipIndex: number
  /** Project width */
  width: number
  /** Project height */
  height: number
  /** Project frame rate */
  fps: number
}

// ---------------------------------------------------------------------------
// Handler interface
// ---------------------------------------------------------------------------

export interface EffectHandler {
  /** Unique string key matching Effect.type */
  type: string
  /** Human-readable label for the UI */
  displayName: string
  /** Initial params when the effect is first created */
  defaultParams: Record<string, unknown>
  /**
   * Draw the effect onto the preview canvas.
   * Called once per frame during playback.
   * Return value is ignored; mutate `renderCtx.ctx` directly.
   */
  render(renderCtx: RenderContext, effect: Effect): void
  /**
   * Return an FFmpeg filter-graph fragment for this effect, or null if
   * the effect produces no filter output (e.g. data-only effects).
   */
  toFFmpegFilter(effect: Effect, exportCtx: ExportContext): string | null
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry = new Map<string, EffectHandler>()

/** Register an effect handler. Overwrites any existing handler for the same type. */
export function registerEffect(handler: EffectHandler): void {
  registry.set(handler.type, handler)
}

/** Look up a handler by effect type. Returns null if not found. */
export function getEffectHandler(type: string): EffectHandler | null {
  return registry.get(type) ?? null
}

/** Return all registered effect-type keys. */
export function getAllEffectTypes(): string[] {
  return [...registry.keys()]
}

// ---------------------------------------------------------------------------
// Built-in effect: zoom (Ken Burns — keyframed scaleX/Y + x/y)
// ---------------------------------------------------------------------------

registerEffect({
  type: 'zoom',
  displayName: 'Zoom / Pan',
  defaultParams: { scaleX: 1, scaleY: 1, x: 0, y: 0 },
  render(renderCtx, effect) {
    const { ctx, width, height, clipTime } = renderCtx
    const transform = computeKenBurnsTransform(effect, clipTime)
    // Apply transform without save/restore so that subsequent drawImage calls
    // (e.g. video frame compositing) are rendered with the zoom/pan applied.
    // The frame rendering loop is responsible for ctx.save() / ctx.restore().
    applyKenBurnsTransform(ctx, transform, width, height)
  },
  toFFmpegFilter(effect, { width, height, fps }) {
    const scaleX = (effect.params.scaleX as number | undefined) ?? 1
    const scaleY = (effect.params.scaleY as number | undefined) ?? 1
    const x = (effect.params.x as number | undefined) ?? 0
    const y = (effect.params.y as number | undefined) ?? 0
    // Use average scale for the zoompan z parameter; separate scaleX/Y panning
    // via x/y expressions. Static values used here; keyframe expressions would
    // require building FFmpeg timeline expressions.
    const scale = (scaleX + scaleY) / 2
    // d=1 produces one output frame per input frame, preserving frame count.
    // Static values used here; keyframe expressions would require building
    // FFmpeg timeline expressions.
    return `zoompan=z='${scale}':x='${x}':y='${y}':d=1:s=${width}x${height}:fps=${fps}`
  },
})

// ---------------------------------------------------------------------------
// Built-in effect: blur (redact region)
// ---------------------------------------------------------------------------

registerEffect({
  type: 'blur',
  displayName: 'Blur / Redact',
  defaultParams: { x: 0, y: 0, width: 100, height: 60, strength: 10 },
  render(renderCtx, effect) {
    const { ctx, clipTime } = renderCtx
    const region = computeBlurRegion(effect, clipTime)
    renderBlurRegion(ctx, region)
  },
  toFFmpegFilter() {
    // Region-specific blur requires a split/crop/blur/overlay pipeline which
    // cannot be expressed as a single filter in the current filter graph builder.
    // Returning null so this effect is reported as canvas-only in the export dialog.
    return null
  },
})

// ---------------------------------------------------------------------------
// Built-in effect: cursor highlight
// ---------------------------------------------------------------------------

registerEffect({
  type: 'cursor',
  displayName: 'Cursor Highlight',
  defaultParams: { radius: 30, color: 'rgba(255,255,0,0.4)' },
  render(renderCtx, effect) {
    const { ctx, clipTime } = renderCtx
    const pos = computeCursorPosition(effect, clipTime)
    if (!pos) return

    const radius = (effect.params.radius as number | undefined) ?? 30
    const color = (effect.params.color as string | undefined) ?? 'rgba(255,255,0,0.4)'

    renderCursorHighlight(ctx, pos.x, pos.y, radius, color)
  },
  toFFmpegFilter() {
    // Cursor highlight is a canvas overlay; no FFmpeg filter equivalent
    return null
  },
})

// ---------------------------------------------------------------------------
// Built-in effect: text overlay
// ---------------------------------------------------------------------------

registerEffect({
  type: 'text',
  displayName: 'Text Overlay',
  defaultParams: {
    text: 'Label',
    x: 50,
    y: 50,
    fontSize: 32,
    color: '#ffffff',
    fontFamily: 'sans-serif',
  },
  render(renderCtx, effect) {
    const { ctx } = renderCtx
    const text = (effect.params.text as string | undefined) ?? 'Label'
    const x = (effect.params.x as number | undefined) ?? 50
    const y = (effect.params.y as number | undefined) ?? 50
    const fontSize = (effect.params.fontSize as number | undefined) ?? 32
    const color = (effect.params.color as string | undefined) ?? '#ffffff'
    const fontFamily = (effect.params.fontFamily as string | undefined) ?? 'sans-serif'

    ctx.save()
    ctx.font = `${fontSize}px ${fontFamily}`
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
    ctx.restore()
  },
  toFFmpegFilter(effect) {
    const text = escapeDrawtext((effect.params.text as string | undefined) ?? 'Label')
    const x = (effect.params.x as number | undefined) ?? 50
    const y = (effect.params.y as number | undefined) ?? 50
    const fontSize = (effect.params.fontSize as number | undefined) ?? 32
    const color = hexToFFmpegColor((effect.params.color as string | undefined) ?? '#ffffff')
    const fontFamily = escapeDrawtext((effect.params.fontFamily as string | undefined) ?? 'sans-serif')
    return `drawtext=text='${text}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${color}:fontfamily='${fontFamily}'`
  },
})

// ---------------------------------------------------------------------------
// Built-in effect: shape-rect (rectangle annotation)
// ---------------------------------------------------------------------------

registerEffect({
  type: 'shape-rect',
  displayName: 'Rectangle',
  defaultParams: {
    x: 100,
    y: 100,
    width: 200,
    height: 120,
    strokeColor: '#ff4444',
    strokeWidth: 3,
    fillColor: 'rgba(255,68,68,0.1)',
  },
  render(renderCtx, effect) {
    const shape = computeShapeRect(effect)
    renderShapeRect(renderCtx.ctx, shape)
  },
  toFFmpegFilter(effect) {
    const { x, y, width, height, strokeColor } = computeShapeRect(effect)
    const color = strokeColor.replace('#', '')
    return `drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${color}:t=3`
  },
})

// ---------------------------------------------------------------------------
// Built-in effect: shape-circle (circle/ellipse annotation)
// ---------------------------------------------------------------------------

registerEffect({
  type: 'shape-circle',
  displayName: 'Circle',
  defaultParams: {
    x: 200,
    y: 200,
    radiusX: 80,
    radiusY: 60,
    strokeColor: '#44aaff',
    strokeWidth: 3,
    fillColor: 'rgba(68,170,255,0.1)',
  },
  render(renderCtx, effect) {
    const shape = computeShapeCircle(effect)
    renderShapeCircle(renderCtx.ctx, shape)
  },
  toFFmpegFilter() {
    // FFmpeg has no native ellipse filter; canvas-only
    return null
  },
})

// ---------------------------------------------------------------------------
// Built-in effect: shape-arrow (arrow annotation)
// ---------------------------------------------------------------------------

registerEffect({
  type: 'shape-arrow',
  displayName: 'Arrow',
  defaultParams: {
    x1: 100,
    y1: 200,
    x2: 400,
    y2: 300,
    color: '#ffdd00',
    strokeWidth: 4,
  },
  render(renderCtx, effect) {
    const shape = computeShapeArrow(effect)
    renderShapeArrow(renderCtx.ctx, shape)
  },
  toFFmpegFilter() {
    // Arrow overlay is canvas-only
    return null
  },
})

// ---------------------------------------------------------------------------
// Built-in effect: crop
// ---------------------------------------------------------------------------

registerEffect({
  type: 'crop',
  displayName: 'Crop',
  defaultParams: { x: 0, y: 0, width: 1920, height: 1080 },
  render(renderCtx, effect) {
    const { ctx, width, height } = renderCtx
    const { x, y, width: cw, height: ch } = computeCropRegion(effect, width, height)

    // Apply clip path to constrain rendering to the crop region.
    // The frame rendering loop is responsible for save()/restore().
    ctx.beginPath()
    ctx.rect(x, y, cw, ch)
    ctx.clip()
  },
  toFFmpegFilter(effect, exportCtx) {
    const { x, y, width, height } = computeCropRegion(effect, exportCtx.width, exportCtx.height)
    return `crop=${width}:${height}:${x}:${y}`
  },
})

// ---------------------------------------------------------------------------
// Built-in effect: intro-outro (pre-designed title scene)
// ---------------------------------------------------------------------------

registerEffect({
  type: 'intro-outro',
  displayName: 'Intro / Outro',
  defaultParams: { ...INTRO_OUTRO_DEFAULT_PARAMS },
  render(renderCtx, effect) {
    const { ctx, width, height } = renderCtx
    const scene = computeIntroOutroScene(effect)
    renderIntroOutroScene(ctx, scene, width, height)
  },
  toFFmpegFilter(effect, { width, height }) {
    const scene = computeIntroOutroScene(effect)
    return introOutroToFFmpegFilter(scene, width, height)
  },
})
