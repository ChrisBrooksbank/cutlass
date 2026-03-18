import type { Effect } from '@/store/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntroOutroStyle = 'simple' | 'gradient' | 'minimal'

export interface IntroOutroParams {
  style: IntroOutroStyle
  title: string
  subtitle: string
  bgColor: string
  textColor: string
  accentColor: string
}

export interface IntroOutroScene {
  style: IntroOutroStyle
  title: string
  subtitle: string
  bgColor: string
  textColor: string
  accentColor: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INTRO_OUTRO_STYLES: Array<{ value: IntroOutroStyle; label: string }> = [
  { value: 'simple', label: 'Simple' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'minimal', label: 'Minimal' },
]

export const INTRO_OUTRO_DEFAULT_PARAMS: IntroOutroParams = {
  style: 'simple',
  title: 'Your Title',
  subtitle: 'Your subtitle here',
  bgColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#e94560',
}

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

/** Extract IntroOutroScene from effect params with defaults. */
export function computeIntroOutroScene(effect: Effect): IntroOutroScene {
  const p = effect.params
  return {
    style: ((p.style as IntroOutroStyle | undefined) ?? 'simple') as IntroOutroStyle,
    title: (p.title as string | undefined) ?? 'Your Title',
    subtitle: (p.subtitle as string | undefined) ?? 'Your subtitle here',
    bgColor: (p.bgColor as string | undefined) ?? '#1a1a2e',
    textColor: (p.textColor as string | undefined) ?? '#ffffff',
    accentColor: (p.accentColor as string | undefined) ?? '#e94560',
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/** Render the 'simple' template: solid background, centered title + subtitle. */
function renderSimple(
  ctx: CanvasRenderingContext2D,
  scene: IntroOutroScene,
  width: number,
  height: number,
): void {
  // Background
  ctx.fillStyle = scene.bgColor
  ctx.fillRect(0, 0, width, height)

  const cx = width / 2
  const titleY = height * 0.42
  const subtitleY = height * 0.58

  // Accent underline below title
  const underlineW = Math.min(width * 0.3, 200)
  ctx.fillStyle = scene.accentColor
  ctx.fillRect(cx - underlineW / 2, titleY + 8, underlineW, 3)

  // Title
  const titleSize = Math.round(height * 0.08)
  ctx.font = `bold ${titleSize}px sans-serif`
  ctx.fillStyle = scene.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(scene.title, cx, titleY)

  // Subtitle
  const subtitleSize = Math.round(height * 0.035)
  ctx.font = `${subtitleSize}px sans-serif`
  ctx.fillStyle = scene.textColor
  ctx.globalAlpha = 0.75
  ctx.textBaseline = 'top'
  ctx.fillText(scene.subtitle, cx, subtitleY)
  ctx.globalAlpha = 1
}

/** Render the 'gradient' template: top-to-bottom gradient background. */
function renderGradient(
  ctx: CanvasRenderingContext2D,
  scene: IntroOutroScene,
  width: number,
  height: number,
): void {
  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, height)
  grad.addColorStop(0, scene.bgColor)
  grad.addColorStop(1, scene.accentColor)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  const cx = width / 2
  const titleY = height * 0.44
  const subtitleY = height * 0.58

  // Title
  const titleSize = Math.round(height * 0.09)
  ctx.font = `bold ${titleSize}px sans-serif`
  ctx.fillStyle = scene.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(scene.title, cx, titleY)

  // Subtitle
  const subtitleSize = Math.round(height * 0.035)
  ctx.font = `${subtitleSize}px sans-serif`
  ctx.fillStyle = scene.textColor
  ctx.globalAlpha = 0.85
  ctx.textBaseline = 'top'
  ctx.fillText(scene.subtitle, cx, subtitleY)
  ctx.globalAlpha = 1
}

/** Render the 'minimal' template: dark semi-transparent overlay, title + accent line. */
function renderMinimal(
  ctx: CanvasRenderingContext2D,
  scene: IntroOutroScene,
  width: number,
  height: number,
): void {
  // Semi-transparent background
  ctx.fillStyle = scene.bgColor
  ctx.globalAlpha = 0.88
  ctx.fillRect(0, 0, width, height)
  ctx.globalAlpha = 1

  const cx = width / 2
  const cy = height / 2

  // Left vertical accent bar
  const barH = Math.round(height * 0.15)
  ctx.fillStyle = scene.accentColor
  ctx.fillRect(cx - width * 0.28 - 4, cy - barH / 2, 4, barH)

  // Title
  const titleSize = Math.round(height * 0.07)
  ctx.font = `300 ${titleSize}px sans-serif`
  ctx.fillStyle = scene.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(scene.title, cx, cy - 4)

  // Subtitle
  const subtitleSize = Math.round(height * 0.03)
  ctx.font = `${subtitleSize}px sans-serif`
  ctx.fillStyle = scene.accentColor
  ctx.textBaseline = 'top'
  ctx.fillText(scene.subtitle.toUpperCase(), cx, cy + 12)
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render an intro/outro template scene onto the canvas.
 * Saves and restores canvas state around the operation.
 */
export function renderIntroOutroScene(
  ctx: CanvasRenderingContext2D,
  scene: IntroOutroScene,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  switch (scene.style) {
    case 'gradient':
      renderGradient(ctx, scene, width, height)
      break
    case 'minimal':
      renderMinimal(ctx, scene, width, height)
      break
    case 'simple':
    default:
      renderSimple(ctx, scene, width, height)
      break
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// FFmpeg filter string for intro/outro (drawtext overlay on solid bg)
// ---------------------------------------------------------------------------

/**
 * Build an FFmpeg filter string that approximates the intro/outro template.
 * Uses color source + drawtext filters. Returns a filter string or null.
 */
export function introOutroToFFmpegFilter(
  scene: IntroOutroScene,
  width: number,
  height: number,
): string {
  const bgHex = scene.bgColor.replace('#', '')
  const fgHex = scene.textColor.replace('#', '')
  const accentHex = scene.accentColor.replace('#', '')
  const titleEsc = scene.title.replace(/'/g, "\\'")
  const subtitleEsc = scene.subtitle.replace(/'/g, "\\'")

  switch (scene.style) {
    case 'gradient': {
      const titleSize = Math.round(height * 0.09)
      const subtitleSize = Math.round(height * 0.035)
      // Canvas uses textBaseline='bottom' at 0.44*h
      const titleY = Math.round(height * 0.44) - titleSize
      const subtitleY = Math.round(height * 0.58)
      return [
        `color=c=0x${bgHex}:size=${width}x${height}`,
        `drawtext=text='${titleEsc}':x=(w-text_w)/2:y=${titleY}:fontsize=${titleSize}:fontcolor=0x${fgHex}`,
        `drawtext=text='${subtitleEsc}':x=(w-text_w)/2:y=${subtitleY}:fontsize=${subtitleSize}:fontcolor=0x${fgHex}`,
      ].join(',')
    }
    case 'minimal': {
      const titleSize = Math.round(height * 0.07)
      const subtitleSize = Math.round(height * 0.03)
      // Canvas uses textBaseline='bottom' at cy - 4
      const cy = Math.round(height / 2)
      const titleY = cy - 4 - titleSize
      const subtitleY = cy + 12
      return [
        `color=c=0x${bgHex}:size=${width}x${height}`,
        `drawtext=text='${titleEsc}':x=(w-text_w)/2:y=${titleY}:fontsize=${titleSize}:fontcolor=0x${fgHex}`,
        `drawtext=text='${subtitleEsc.toUpperCase()}':x=(w-text_w)/2:y=${subtitleY}:fontsize=${subtitleSize}:fontcolor=0x${accentHex}`,
      ].join(',')
    }
    case 'simple':
    default: {
      const titleSize = Math.round(height * 0.08)
      const subtitleSize = Math.round(height * 0.035)
      // Canvas uses textBaseline='bottom' at 0.42*h, so subtract title height
      const titleY = Math.round(height * 0.42) - titleSize
      const subtitleY = Math.round(height * 0.58)
      return [
        `color=c=0x${bgHex}:size=${width}x${height}`,
        `drawtext=text='${titleEsc}':x=(w-text_w)/2:y=${titleY}:fontsize=${titleSize}:fontcolor=0x${fgHex}`,
        `drawtext=text='${subtitleEsc}':x=(w-text_w)/2:y=${subtitleY}:fontsize=${subtitleSize}:fontcolor=0x${fgHex}`,
      ].join(',')
    }
  }
}
