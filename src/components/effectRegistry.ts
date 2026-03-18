import type { Effect } from '@/store/types'
import { interpolateKeyframes } from './keyframeUtils'
import { computeKenBurnsTransform, applyKenBurnsTransform } from './kenBurnsUtils'
import { computeBlurRegion, renderBlurRegion } from './blurUtils'

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
  toFFmpegFilter(effect) {
    const bx = (effect.params.x as number | undefined) ?? 0
    const by = (effect.params.y as number | undefined) ?? 0
    const bw = (effect.params.width as number | undefined) ?? 100
    const bh = (effect.params.height as number | undefined) ?? 60
    const strength = (effect.params.strength as number | undefined) ?? 10
    return `boxblur=luma_radius=${strength}:luma_power=1:enable='between(x,${bx},${bx + bw})*between(y,${by},${by + bh})'`
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
    // Cursor positions stored as keyframes on 'x' and 'y' channels
    const kfX = effect.keyframes.filter((k) => (k as { channel?: string }).channel === 'x')
    const kfY = effect.keyframes.filter((k) => (k as { channel?: string }).channel === 'y')
    if (!kfX.length || !kfY.length) return

    const cx = interpolateKeyframes(kfX, clipTime)
    const cy = interpolateKeyframes(kfY, clipTime)
    if (cx === null || cy === null) return

    const radius = (effect.params.radius as number | undefined) ?? 30
    const color = (effect.params.color as string | undefined) ?? 'rgba(255,255,0,0.4)'

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
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
    const text = ((effect.params.text as string | undefined) ?? 'Label').replace(/'/g, "\\'")
    const x = (effect.params.x as number | undefined) ?? 50
    const y = (effect.params.y as number | undefined) ?? 50
    const fontSize = (effect.params.fontSize as number | undefined) ?? 32
    const color = ((effect.params.color as string | undefined) ?? '#ffffff').replace('#', '')
    const fontFamily = (effect.params.fontFamily as string | undefined) ?? 'sans-serif'
    return `drawtext=text='${text}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${color}:fontfamily=${fontFamily}`
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
    const { ctx } = renderCtx
    const cx = (effect.params.x as number | undefined) ?? 0
    const cy = (effect.params.y as number | undefined) ?? 0
    const cw = (effect.params.width as number | undefined) ?? renderCtx.width
    const ch = (effect.params.height as number | undefined) ?? renderCtx.height

    ctx.save()
    // Apply clip path to constrain rendering to the crop region
    ctx.beginPath()
    ctx.rect(cx, cy, cw, ch)
    ctx.clip()
    ctx.restore()
  },
  toFFmpegFilter(effect) {
    const cx = (effect.params.x as number | undefined) ?? 0
    const cy = (effect.params.y as number | undefined) ?? 0
    const cw = (effect.params.width as number | undefined) ?? 1920
    const ch = (effect.params.height as number | undefined) ?? 1080
    return `crop=${cw}:${ch}:${cx}:${cy}`
  },
})
