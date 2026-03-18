/**
 * GIF export utilities.
 *
 * Implements the two-pass FFmpeg GIF pipeline:
 *   Pass 1 – palettegen: generate an optimised 256-colour palette from the input.
 *   Pass 2 – paletteuse: dither the video using the palette to produce the GIF.
 *
 * This approach yields significantly better quality than a single-pass conversion
 * because the palette is tuned to the actual colours present in the clip.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GifExportSettings {
  /** Output frames-per-second (e.g. 10, 15, 24). */
  fps: number
  /**
   * Output width in pixels.  Height is derived automatically using the
   * lanczos filter with aspect-ratio preservation (-1 sentinel).
   */
  width: number
  /** Optional duration in seconds to limit encoding length. */
  duration?: number
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const GIF_DEFAULT_FPS = 10
export const GIF_DEFAULT_WIDTH = 480

// ---------------------------------------------------------------------------
// Pass 1 – palettegen
// ---------------------------------------------------------------------------

/**
 * Build the FFmpeg filter string for the palette-generation pass.
 *
 * The filter chain:
 *   fps=<fps>  → limit frame rate
 *   scale=<width>:-1:flags=lanczos  → resize, preserve aspect ratio
 *   palettegen  → derive optimal 256-colour palette
 */
export function buildGifPalettegenFilter(settings: GifExportSettings): string {
  const { fps, width } = settings
  return `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`
}

/**
 * Build the complete set of FFmpeg arguments for pass 1 (palettegen).
 *
 * @param settings - GIF export settings (fps, width, duration).
 * @param inputCount - Number of media inputs (default 1). When > 1,
 *   `-filter_complex` with an explicit `[0:v]` label is used instead of
 *   `-vf` to avoid ambiguity.
 *
 * The caller must:
 *   1. Prepend `-i <input>` input arguments.
 *   2. Append the palette output filename (e.g. `palette.png`).
 */
export function buildGifPalettegenArgs(settings: GifExportSettings, inputCount = 1): string[] {
  const args: string[] = []
  if (settings.duration != null) {
    args.push('-t', String(settings.duration))
  }
  if (inputCount > 1) {
    // Use -filter_complex with explicit stream label to avoid -vf ambiguity
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
 * Build the FFmpeg `-lavfi` filter graph for the palette-use pass.
 *
 * @param settings - GIF export settings.
 * @param paletteInputIndex - The FFmpeg input index for palette.png
 *   (= number of media inputs, since palette is appended last).
 *   Defaults to 1 for single-input projects.
 *
 * The filter graph:
 *   [0:v] fps=<fps>,scale=<width>:-1:flags=lanczos [x]
 *   [x][<paletteIndex>:v] paletteuse
 */
export function buildGifPaletteUseFilter(settings: GifExportSettings, paletteInputIndex = 1): string {
  const { fps, width } = settings
  return `[0:v] fps=${fps},scale=${width}:-1:flags=lanczos [x]; [x][${paletteInputIndex}:v] paletteuse`
}

/**
 * Build the complete set of FFmpeg arguments for pass 2 (paletteuse).
 *
 * @param settings - GIF export settings.
 * @param paletteInputIndex - The FFmpeg input index for palette.png
 *   (= number of media inputs). Defaults to 1.
 *
 * The caller must:
 *   1. Prepend `-i <input>` for all source media files.
 *   2. Prepend `-i <palette.png>` for the palette (last input).
 *   3. Append the GIF output filename (e.g. `output.gif`).
 */
export function buildGifPaletteUseArgs(settings: GifExportSettings, paletteInputIndex = 1): string[] {
  const args: string[] = []
  if (settings.duration != null) {
    args.push('-t', String(settings.duration))
  }
  args.push('-lavfi', buildGifPaletteUseFilter(settings, paletteInputIndex), '-y')
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
