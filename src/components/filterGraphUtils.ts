/**
 * FFmpeg filter graph builder.
 *
 * Translates a ProjectState into a set of FFmpeg arguments:
 *   - `inputs`       — ordered list of source URLs (each becomes a -i flag)
 *   - `filterComplex` — value for the -filter_complex flag
 *   - `videoMap`     — stream label to pass to -map for the video output
 *   - `audioMap`     — stream label to pass to -map for the audio output (null = no audio)
 *
 * Strategy
 * --------
 * 1. Each clip is processed individually: trim → speed → effects → scale.
 * 2. Consecutive clips on the same track that are linked by a `transitionOut` are grouped
 *    into a "chain" and connected with FFmpeg's xfade filter.
 *    All other clips form single-clip chains.
 * 3. Each chain is positioned on the timeline via `setpts=PTS+offset/TB`.
 * 4. All video chains are overlaid (bottom-to-top track order) on a black base canvas.
 * 5. Audio clips are trimmed, tempo-adjusted (atempo), delayed (adelay) to their timeline
 *    position, volume-scaled, and finally mixed together with amix.
 */

import type { ProjectState, Clip } from '@/store/types'
import { getEffectHandler } from './effectRegistry'
import type { ExportContext } from './effectRegistry'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ClipInput {
  /** Source URL that will be passed as a -i input to FFmpeg */
  url: string
  /** The clip that uses this input */
  clipId: string
}

export interface FFmpegArgs {
  /** Ordered list of source URLs passed as -i inputs */
  inputs: string[]
  /** Value for the -filter_complex flag (semicolon-separated filter chains) */
  filterComplex: string
  /** Stream label for the -map of the video output (e.g. "[vout]" or "0:v") */
  videoMap: string
  /** Stream label for the -map of the audio output, or null when the project is silent */
  audioMap: string | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Round a dimension to the nearest even number (required by libx264/libvpx-vp9). */
export function ensureEven(n: number): number {
  return Math.round(n / 2) * 2
}

/** Sanitize an arbitrary string for use as an FFmpeg stream label. */
function sanitizeLabel(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '_')
}

// ---------------------------------------------------------------------------
// Exported pure helpers (individually testable)
// ---------------------------------------------------------------------------

/**
 * Build a chain of atempo filters that together apply `speed` to audio.
 *
 * FFmpeg's atempo filter accepts values in [0.5, 2.0] only.  For speeds
 * outside that range we stack multiple atempo filters.
 *
 * Examples:
 *   buildAtempoChain(1.0)  → ['atempo=1.000000']
 *   buildAtempoChain(4.0)  → ['atempo=2.0', 'atempo=2.0', 'atempo=1.000000']
 *   buildAtempoChain(0.25) → ['atempo=0.5', 'atempo=0.5', 'atempo=1.000000']
 */
export function buildAtempoChain(speed: number): string[] {
  if (speed <= 0) throw new Error('speed must be > 0')
  const filters: string[] = []
  let s = speed
  while (s > 2.0 + 1e-9) {
    filters.push('atempo=2.0')
    s /= 2.0
  }
  while (s < 0.5 - 1e-9) {
    filters.push('atempo=0.5')
    s /= 0.5
  }
  filters.push(`atempo=${s.toFixed(6)}`)
  return filters
}

/**
 * Map a project TransitionType to the corresponding FFmpeg xfade transition name.
 */
export function transitionTypeToXfade(type: string): string {
  switch (type) {
    case 'cross-dissolve':
      return 'dissolve'
    case 'fade-to-black':
      return 'fade'
    case 'wipe-left':
      return 'wipeleft'
    default:
      return 'dissolve'
  }
}

/**
 * Build a video filter chain string for a single clip.
 *
 * Input stream:  `[${inputIdx}:v]`
 * Output stream: `[${outputLabel}]`
 *
 * Applied filters (in order):
 *   trim  → setpts (normalize to 0)  → setpts (speed)  → per-effect filters  → scale
 *
 * The clip is NOT positioned on the timeline here; call setpts separately.
 */
export function buildClipVideoFilter(
  clip: Clip,
  inputIdx: number,
  outputLabel: string,
  project: { width: number; height: number; fps: number },
): string {
  const filters: string[] = []

  // 1. Trim to the clip's in/out points within the source media
  filters.push(`trim=start=${clip.sourceIn}:end=${clip.sourceOut}`)
  filters.push('setpts=PTS-STARTPTS')

  // 2. Speed adjustment
  if (clip.speed !== 1) {
    filters.push(`setpts=PTS/${clip.speed}`)
  }

  // 3. Per-effect FFmpeg filters
  const exportCtx: ExportContext = {
    clipIndex: inputIdx,
    width: project.width,
    height: project.height,
    fps: project.fps,
  }
  for (const effect of clip.effects) {
    const handler = getEffectHandler(effect.type)
    if (!handler) continue
    const f = handler.toFFmpegFilter(effect, exportCtx)
    if (f) filters.push(f)
  }

  // 4. Scale to project canvas dimensions (ensure even for codec compatibility)
  filters.push(`scale=${ensureEven(project.width)}:${ensureEven(project.height)}`)

  return `[${inputIdx}:v]${filters.join(',')}[${outputLabel}]`
}

/**
 * Build an audio filter chain string for a single clip.
 *
 * Input stream:  `[${inputIdx}:a]`
 * Output stream: `[${outputLabel}]`
 *
 * Applied filters (in order):
 *   atrim  → asetpts (normalize to 0)  → atempo chain (speed)  → adelay (timeline position)
 */
export function buildClipAudioFilter(clip: Clip, inputIdx: number, outputLabel: string): string {
  const filters: string[] = []

  // 1. Trim to the clip's in/out points
  filters.push(`atrim=start=${clip.sourceIn}:end=${clip.sourceOut}`)
  filters.push('asetpts=PTS-STARTPTS')

  // 2. Speed adjustment via chained atempo
  if (clip.speed !== 1) {
    filters.push(...buildAtempoChain(clip.speed))
  }

  // 3. Delay to timeline position (adelay takes milliseconds)
  if (clip.startTime > 0) {
    const delayMs = Math.round(clip.startTime * 1000)
    filters.push(`adelay=${delayMs}:all=1`)
  }

  return `[${inputIdx}:a]${filters.join(',')}[${outputLabel}]`
}

/**
 * Build an xfade transition filter between two video streams.
 *
 * @param aLabel       - Label of the first (outgoing) stream (without brackets)
 * @param bLabel       - Label of the second (incoming) stream (without brackets)
 * @param outputLabel  - Label for the resulting blended stream (without brackets)
 * @param type         - TransitionType from the project model
 * @param duration     - Transition duration in seconds
 * @param offset       - Seconds into the first stream where the transition begins
 */
export function buildXfadeFilter(
  aLabel: string,
  bLabel: string,
  outputLabel: string,
  type: string,
  duration: number,
  offset: number,
): string {
  const xfadeType = transitionTypeToXfade(type)
  return `[${aLabel}][${bLabel}]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[${outputLabel}]`
}

/**
 * Collect all clip-to-asset input pairs from a project in track/clip order.
 *
 * The returned array matches the -i input indices used throughout the filter graph.
 */
export function collectInputs(project: ProjectState): ClipInput[] {
  const assetMap = new Map(project.mediaAssets.map((a) => [a.id, a]))
  const inputs: ClipInput[] = []
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (!assetMap.has(clip.sourceId)) continue
      inputs.push({ url: assetMap.get(clip.sourceId)!.url, clipId: clip.id })
    }
  }
  return inputs
}

/**
 * Find clips whose sourceId references an asset that no longer exists.
 * Returns an array of { trackIndex, clipId } for each orphaned clip.
 */
export function findOrphanedClips(project: ProjectState): { trackIndex: number; clipId: string }[] {
  const assetIds = new Set(project.mediaAssets.map((a) => a.id))
  const orphaned: { trackIndex: number; clipId: string }[] = []
  for (let ti = 0; ti < project.tracks.length; ti++) {
    for (const clip of project.tracks[ti].clips) {
      if (!assetIds.has(clip.sourceId)) {
        orphaned.push({ trackIndex: ti, clipId: clip.id })
      }
    }
  }
  return orphaned
}

// ---------------------------------------------------------------------------
// Chain grouping (internal)
// ---------------------------------------------------------------------------

/**
 * Group a sorted clip array into "chains":
 * a chain is a maximal run of clips where every clip except the last has
 * `transitionOut` set (implying a xfade to the next clip).
 */
function groupClipsIntoChains(clips: Clip[]): Clip[][] {
  const chains: Clip[][] = []
  let current: Clip[] = []
  for (let i = 0; i < clips.length; i++) {
    current.push(clips[i])
    const hasTransitionToNext = !!clips[i].transitionOut && i < clips.length - 1
    if (!hasTransitionToNext) {
      chains.push(current)
      current = []
    }
  }
  return chains
}

// ---------------------------------------------------------------------------
// Main export builder
// ---------------------------------------------------------------------------

/**
 * Build the complete FFmpeg args for exporting a project.
 *
 * Returns inputs (in order) and a filter_complex string along with the
 * stream labels to use for the final video and audio outputs.
 *
 * When `outputSize` is provided, clips and the canvas are scaled directly to
 * that resolution, avoiding a wasteful intermediate upscale to project dims.
 */
export function buildFFmpegArgs(
  project: ProjectState,
  options?: { skipAudio?: boolean; outputSize?: { width: number; height: number } },
): FFmpegArgs {
  const assetMap = new Map(project.mediaAssets.map((a) => [a.id, a]))

  // --- Assign a stable FFmpeg input index to every clip ---
  const inputs: string[] = []
  const clipInputIdx = new Map<string, number>()

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (!assetMap.has(clip.sourceId)) continue
      clipInputIdx.set(clip.id, inputs.length)
      inputs.push(assetMap.get(clip.sourceId)!.url)
    }
  }

  if (inputs.length === 0) {
    return { inputs: [], filterComplex: '', videoMap: '', audioMap: null }
  }

  const fragments: string[] = []

  // -----------------------------------------------------------------------
  // VIDEO
  // -----------------------------------------------------------------------

  const videoTracks = project.tracks.filter((t) => t.type === 'video' && !t.muted)

  // All positioned video stream labels (one per chain, across all tracks)
  const positionedVideoLabels: string[] = []

  for (const track of videoTracks) {
    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime)
    if (sorted.length === 0) continue

    const chains = groupClipsIntoChains(sorted)

    for (let chainIdx = 0; chainIdx < chains.length; chainIdx++) {
      const chain = chains[chainIdx]
      const firstClip = chain[0]
      const tkId = sanitizeLabel(track.id)

      // 1. Process each clip in the chain individually
      const clipLabels: string[] = []
      const renderSize = options?.outputSize ?? { width: project.width, height: project.height }
      for (const clip of chain) {
        const inputIdx = clipInputIdx.get(clip.id)
        if (inputIdx === undefined) continue
        const asset = assetMap.get(clip.sourceId)
        if (!asset || asset.type === 'audio') continue

        const label = `vp_${sanitizeLabel(clip.id)}`
        fragments.push(
          buildClipVideoFilter(clip, inputIdx, label, {
            width: renderSize.width,
            height: renderSize.height,
            fps: project.fps,
          }),
        )
        clipLabels.push(label)
      }

      if (clipLabels.length === 0) continue

      // 2. Connect clips within the chain via xfade
      let currentLabel = clipLabels[0]
      let cumulativeDuration = chain[0].duration

      for (let i = 1; i < chain.length; i++) {
        const prevClip = chain[i - 1]
        const clip = chain[i]
        if (i >= clipLabels.length) continue // no processed stream for this clip

        const td = prevClip.transitionOut!
        const offset = Math.max(0, cumulativeDuration - td.duration)
        const outLabel = `vxf_${tkId}_${chainIdx}_${i}`

        fragments.push(
          buildXfadeFilter(currentLabel, clipLabels[i], outLabel, td.type, td.duration, offset),
        )

        cumulativeDuration += clip.duration - td.duration
        currentLabel = outLabel
      }

      // 3. Position the chain on the timeline
      const posLabel = `vpos_${tkId}_${chainIdx}`
      const startOffset = firstClip.startTime

      if (startOffset > 0) {
        fragments.push(`[${currentLabel}]setpts=PTS+${startOffset}/TB[${posLabel}]`)
      } else {
        // No shift needed — just rename for uniform downstream labeling
        fragments.push(`[${currentLabel}]setpts=PTS[${posLabel}]`)
      }

      positionedVideoLabels.push(posLabel)
    }
  }

  // Composite all positioned video streams onto a black base (bottom track first)
  let videoMap: string

  if (positionedVideoLabels.length === 0) {
    videoMap = '0:v'
  } else if (positionedVideoLabels.length === 1) {
    videoMap = `[${positionedVideoLabels[0]}]`
  } else {
    // Compute total project duration for the base canvas
    let totalDuration = 0
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration
        if (end > totalDuration) totalDuration = end
      }
    }
    const baseDuration = Math.max(1, Math.ceil(totalDuration))

    const renderSize2 = options?.outputSize ?? { width: project.width, height: project.height }
    const baseLabel = 'vbase'
    fragments.push(
      `color=black:size=${renderSize2.width}x${renderSize2.height}:rate=${project.fps}:d=${baseDuration}[${baseLabel}]`,
    )
    let current = baseLabel
    for (let i = 0; i < positionedVideoLabels.length; i++) {
      const isLast = i === positionedVideoLabels.length - 1
      const outLabel = isLast ? 'vout' : `vcomp_${i}`
      fragments.push(
        `[${current}][${positionedVideoLabels[i]}]overlay=eof_action=pass[${outLabel}]`,
      )
      current = outLabel
    }
    videoMap = '[vout]'
  }

  // -----------------------------------------------------------------------
  // AUDIO
  // -----------------------------------------------------------------------

  const processedAudioLabels: string[] = []

  if (options?.skipAudio) {
    // Skip audio processing entirely (e.g. when inputs have no audio streams)
    return {
      inputs,
      filterComplex: fragments.join(';'),
      videoMap,
      audioMap: null,
    }
  }

  for (const track of project.tracks) {
    if (track.muted) continue
    if (track.type !== 'audio') continue

    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime)

    for (const clip of sorted) {
      const inputIdx = clipInputIdx.get(clip.id)
      if (inputIdx === undefined) continue
      const asset = assetMap.get(clip.sourceId)
      if (!asset || asset.type !== 'audio') continue

      const baseLabel = `ap_${sanitizeLabel(clip.id)}`

      if (track.volume !== 1) {
        // Chain: audio processing → pre-label → volume → final label
        const preLabel = `${baseLabel}_pre`
        const audioFilter = buildClipAudioFilter(clip, inputIdx, preLabel)
        fragments.push(audioFilter)
        fragments.push(`[${preLabel}]volume=${track.volume}[${baseLabel}]`)
      } else {
        fragments.push(buildClipAudioFilter(clip, inputIdx, baseLabel))
      }

      processedAudioLabels.push(baseLabel)
    }
  }

  let audioMap: string | null = null

  if (processedAudioLabels.length === 1) {
    audioMap = `[${processedAudioLabels[0]}]`
  } else if (processedAudioLabels.length > 1) {
    const inputPart = processedAudioLabels.map((l) => `[${l}]`).join('')
    fragments.push(`${inputPart}amix=inputs=${processedAudioLabels.length}:normalize=0[aout]`)
    audioMap = '[aout]'
  }

  return {
    inputs,
    filterComplex: fragments.join(';'),
    videoMap,
    audioMap,
  }
}
