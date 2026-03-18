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
 * Build the FFmpeg `-vf` filter string for the palette-generation pass.
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
 * The caller must:
 *   1. Prepend `-i <input>` input arguments.
 *   2. Append the palette output filename (e.g. `palette.png`).
 *
 * Example (480px wide, 10 fps):
 *   ['-vf', 'fps=10,scale=480:-1:flags=lanczos,palettegen', '-y']
 */
export function buildGifPalettegenArgs(settings: GifExportSettings): string[] {
  const args: string[] = []
  if (settings.duration != null) {
    args.push('-t', String(settings.duration))
  }
  args.push('-vf', buildGifPalettegenFilter(settings), '-y')
  return args
}

// ---------------------------------------------------------------------------
// Pass 2 – paletteuse
// ---------------------------------------------------------------------------

/**
 * Build the FFmpeg `-lavfi` filter graph for the palette-use pass.
 *
 * The filter graph:
 *   [0:v] fps=<fps>,scale=<width>:-1:flags=lanczos [x]
 *   [x][1:v] paletteuse
 *
 * Input 0 is the source video; input 1 is the palette PNG from pass 1.
 */
export function buildGifPaletteUseFilter(settings: GifExportSettings): string {
  const { fps, width } = settings
  return `[0:v] fps=${fps},scale=${width}:-1:flags=lanczos [x]; [x][1:v] paletteuse`
}

/**
 * Build the complete set of FFmpeg arguments for pass 2 (paletteuse).
 *
 * The caller must:
 *   1. Prepend `-i <input>` for the source video.
 *   2. Prepend `-i <palette.png>` for the palette (input index 1).
 *   3. Append the GIF output filename (e.g. `output.gif`).
 *
 * Example (480px wide, 10 fps):
 *   ['-lavfi', 'fps=10,scale=480:-1:flags=lanczos [x]; [x][1:v] paletteuse', '-y']
 */
export function buildGifPaletteUseArgs(settings: GifExportSettings): string[] {
  const args: string[] = []
  if (settings.duration != null) {
    args.push('-t', String(settings.duration))
  }
  args.push('-lavfi', buildGifPaletteUseFilter(settings), '-y')
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
