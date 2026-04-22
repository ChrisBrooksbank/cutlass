/**
 * GIF export utilities.
 *
 * Implements the two-pass FFmpeg GIF pipeline:
 *   Pass 1 – palettegen: generate an optimised 256-colour palette from the input.
 *   Pass 2 – paletteuse: dither the video using the palette to produce the GIF.
 *
 * This approach yields significantly better quality than a single-pass conversion
 * because the palette is tuned to the actual colours present in the clip.
 *
 * When a project filter graph is provided (multi-clip, effects, transitions),
 * the GIF filters are appended to that graph so the output matches the preview.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GifExportSettings {
  /** Output frames-per-second (e.g. 10, 15, 24). */
  fps: number
  /**
   * Output width in pixels.  Height is derived automatically using the
   * lanczos filter with aspect-ratio preservation (-2 sentinel for even height).
   */
  width: number
  /** Optional duration in seconds to limit encoding length. */
  duration?: number
}

/**
 * Optional project filter graph context.
 * When provided, GIF filters are chained onto the existing filter graph
 * instead of operating on raw `[0:v]`.
 */
export interface GifFilterGraphContext {
  /** The full filter_complex string from buildFFmpegArgs (semicolon-separated). */
  filterComplex: string
  /** The video output label from the filter graph (e.g. "[vout]" or "[vpos_track1_0]"). */
  videoMapLabel: string
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const GIF_DEFAULT_FPS = 10
export const GIF_DEFAULT_WIDTH = 480

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip surrounding brackets from a stream label: "[vout]" → "vout" */
export function stripBrackets(label: string): string {
  return label.replace(/^\[|\]$/g, '')
}

/** Core GIF filter chain: fps → scale → (terminal filter added by caller) */
function gifScaleChain(fps: number, width: number): string {
  return `fps=${fps},scale=${width}:-2:flags=lanczos`
}

// ---------------------------------------------------------------------------
// Pass 1 – palettegen
// ---------------------------------------------------------------------------

/**
 * Build the FFmpeg filter string for the palette-generation pass.
 */
export function buildGifPalettegenFilter(settings: GifExportSettings): string {
  return `${gifScaleChain(settings.fps, settings.width)},palettegen`
}

/**
 * Build the complete set of FFmpeg arguments for pass 1 (palettegen).
 *
 * @param settings - GIF export settings (fps, width, duration).
 * @param inputCount - Number of media inputs (default 1).
 * @param filterGraph - Optional project filter graph to prefix.
 */
export function buildGifPalettegenArgs(
  settings: GifExportSettings,
  inputCount = 1,
  filterGraph?: GifFilterGraphContext,
): string[] {
  const args: string[] = []
  if (settings.duration != null) {
    args.push('-t', String(settings.duration))
  }

  if (filterGraph) {
    // Chain GIF filters onto the project's filter graph
    const srcLabel = stripBrackets(filterGraph.videoMapLabel)
    const fc = `${filterGraph.filterComplex};[${srcLabel}]${gifScaleChain(settings.fps, settings.width)},palettegen[palout]`
    args.push('-filter_complex', fc)
    args.push('-map', '[palout]')
  } else if (inputCount > 1) {
    args.push('-filter_complex', `[0:v]${buildGifPalettegenFilter(settings)}[palout]`)
    args.push('-map', '[palout]')
  } else {
    args.push('-vf', buildGifPalettegenFilter(settings))
  }

  args.push('-y')
  return args
}

// ---------------------------------------------------------------------------
// Pass 2 – paletteuse
// ---------------------------------------------------------------------------

/**
 * Build the FFmpeg `-lavfi` filter graph for the palette-use pass (simple mode).
 */
export function buildGifPaletteUseFilter(settings: GifExportSettings, paletteInputIndex = 1): string {
  const { fps, width } = settings
  return `[0:v] ${gifScaleChain(fps, width)} [x]; [x][${paletteInputIndex}:v] paletteuse`
}

/**
 * Build the complete set of FFmpeg arguments for pass 2 (paletteuse).
 *
 * @param settings - GIF export settings.
 * @param paletteInputIndex - The FFmpeg input index for palette.png.
 * @param filterGraph - Optional project filter graph to prefix.
 */
export function buildGifPaletteUseArgs(
  settings: GifExportSettings,
  paletteInputIndex = 1,
  filterGraph?: GifFilterGraphContext,
): string[] {
  const args: string[] = []
  if (settings.duration != null) {
    args.push('-t', String(settings.duration))
  }

  if (filterGraph) {
    const srcLabel = stripBrackets(filterGraph.videoMapLabel)
    const fc = `${filterGraph.filterComplex};[${srcLabel}]${gifScaleChain(settings.fps, settings.width)}[x];[x][${paletteInputIndex}:v]paletteuse[gifout]`
    args.push('-filter_complex', fc)
    args.push('-map', '[gifout]')
  } else {
    args.push('-lavfi', buildGifPaletteUseFilter(settings, paletteInputIndex))
  }

  args.push('-y')
  return args
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

/**
 * Return default GifExportSettings using the library defaults.
 */
export function defaultGifExportSettings(): GifExportSettings {
  return { fps: GIF_DEFAULT_FPS, width: GIF_DEFAULT_WIDTH }
}
