/**
 * Export format and resolution utilities.
 *
 * Provides types, presets, and helpers for building FFmpeg output arguments
 * for MP4 (H.264) and WebM (VP9) exports at standard or custom resolutions.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'mp4' | 'webm'

export type ResolutionPreset = '1080p' | '720p' | '480p' | 'custom'

export interface Resolution {
  width: number
  height: number
}

export interface ExportSettings {
  format: ExportFormat
  preset: ResolutionPreset
  /** Required when preset is 'custom'. */
  customResolution?: Resolution
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const RESOLUTION_PRESETS: Record<Exclude<ResolutionPreset, 'custom'>, Resolution> = {
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
}

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  mp4: 'MP4 (H.264)',
  webm: 'WebM (VP9)',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the file extension (without leading dot) for the given format.
 */
export function getFormatExtension(format: ExportFormat): string {
  return format === 'mp4' ? 'mp4' : 'webm'
}

/**
 * Return the MIME type for the given format.
 */
export function getFormatMimeType(format: ExportFormat): string {
  return format === 'mp4' ? 'video/mp4' : 'video/webm'
}

/**
 * Return FFmpeg codec flags for the given format.
 *
 * MP4:  libx264 with a browser-friendly preset and AAC audio
 * WebM: libvpx-vp9 with realtime-oriented settings and Opus audio
 */
export function getFormatCodecArgs(format: ExportFormat, crfH264 = 23, crfVP9 = 33): string[] {
  if (format === 'mp4') {
    return [
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      String(crfH264),
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
    ]
  }
  // webm / VP9
  return [
    '-c:v',
    'libvpx-vp9',
    '-deadline',
    'realtime',
    '-cpu-used',
    '8',
    '-row-mt',
    '1',
    '-crf',
    String(crfVP9),
    '-b:v',
    '0',
    '-c:a',
    'libopus',
    '-b:a',
    '128k',
  ]
}

/**
 * Resolve the output resolution from ExportSettings.
 *
 * Throws if preset is 'custom' and no customResolution is provided.
 */
export function resolveResolution(settings: ExportSettings): Resolution {
  if (settings.preset === 'custom') {
    if (!settings.customResolution) {
      throw new Error('customResolution is required when preset is "custom"')
    }
    return settings.customResolution
  }
  return RESOLUTION_PRESETS[settings.preset]
}

/**
 * Build the complete set of FFmpeg output arguments for the given settings.
 *
 * Includes codec flags and a scale filter for the target resolution.
 * The caller is responsible for appending the output filename.
 *
 * Example output for 720p MP4:
 *   ['-vf', 'scale=1280:720', '-c:v', 'libx264', '-preset', 'fast',
 *    '-crf', '23', '-c:a', 'aac', '-b:a', '128k']
 */
export function buildExportOutputArgs(settings: ExportSettings): string[] {
  const { width, height } = resolveResolution(settings)
  const codecArgs = getFormatCodecArgs(settings.format)
  return ['-vf', `scale=${width}:${height}`, ...codecArgs]
}
