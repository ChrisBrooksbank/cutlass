/**
 * Export dialog utilities.
 *
 * Provides quality presets and estimated file size calculations
 * for the export dialog UI.
 */

import type { ExportFormat, ResolutionPreset } from '@/components/exportFormatUtils'
import { RESOLUTION_PRESETS } from '@/components/exportFormatUtils'
import type { GifExportSettings } from '@/components/gifExportUtils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QualityPreset = 'high' | 'medium' | 'low'

export interface QualityPresetConfig {
  label: string
  /** CRF for H.264 (lower = better quality). */
  crfH264: number
  /** CRF for VP9 (lower = better quality). */
  crfVP9: number
  /** Approximate bitrate in Mbps used for file size estimation. */
  estimatedBitrateMbps: number
}

// ---------------------------------------------------------------------------
// Quality presets
// ---------------------------------------------------------------------------

export const QUALITY_PRESETS: Record<QualityPreset, QualityPresetConfig> = {
  high: {
    label: 'High',
    crfH264: 18,
    crfVP9: 24,
    estimatedBitrateMbps: 8,
  },
  medium: {
    label: 'Medium',
    crfH264: 23,
    crfVP9: 33,
    estimatedBitrateMbps: 4,
  },
  low: {
    label: 'Low',
    crfH264: 28,
    crfVP9: 40,
    estimatedBitrateMbps: 2,
  },
}

// ---------------------------------------------------------------------------
// File size estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the output file size in bytes for a video export (MP4 or WebM).
 *
 * Uses an approximate video bitrate from the quality preset plus a fixed
 * 128 kbps audio track.
 */
export function estimateVideoFileSizeBytes(durationSec: number, quality: QualityPreset): number {
  const audioBitrateMbps = 0.128 // 128 kbps
  const videoBitrateMbps = QUALITY_PRESETS[quality].estimatedBitrateMbps
  const totalBitrateMbps = videoBitrateMbps + audioBitrateMbps
  // bits → bytes: multiply by 1_000_000 / 8
  return (durationSec * totalBitrateMbps * 1_000_000) / 8
}

/**
 * Estimate the output file size in bytes for a GIF export.
 *
 * GIF uses ~4 bits per pixel per frame (post-palette dithering).
 * Width is given; height is computed preserving a 16:9 aspect ratio.
 */
export function estimateGifFileSizeBytes(
  durationSec: number,
  gifSettings: GifExportSettings,
): number {
  const { fps, width } = gifSettings
  // Assume 16:9 for height estimation
  const height = Math.round((width * 9) / 16)
  const totalFrames = durationSec * fps
  // ~0.5 bytes per pixel per frame (palette-optimised GIF)
  return totalFrames * width * height * 0.5
}

/**
 * Format a byte count as a human-readable string (KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.round(bytes / 1_000)} KB`
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Return the pixel dimensions label for a preset (e.g. "1920 × 1080").
 */
export function getResolutionLabel(preset: ResolutionPreset): string {
  if (preset === 'custom') return 'Custom'
  const { width, height } = RESOLUTION_PRESETS[preset]
  return `${width} × ${height}`
}

/**
 * Return a suggested filename for the export based on format and preset.
 */
export function buildExportFilename(format: ExportFormat, preset: ResolutionPreset): string {
  const suffix = preset === 'custom' ? 'custom' : preset
  return `export-${suffix}.${format}`
}
