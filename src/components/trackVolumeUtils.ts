import type { AudioRoutingGraph } from './audioEngine'

/**
 * Compute the effective gain for a track.
 *
 * - If muted, gain is 0 regardless of volume.
 * - Otherwise, gain equals the volume clamped to [0, 1].
 */
export function computeEffectiveGain(volume: number, muted: boolean): number {
  if (muted) return 0
  return Math.min(1, Math.max(0, volume))
}

/**
 * Apply the effective gain for a track to the audio routing graph.
 * No-op if the graph does not have the track connected.
 */
export function applyTrackGain(
  graph: AudioRoutingGraph,
  trackId: string,
  volume: number,
  muted: boolean,
): void {
  graph.setGain(trackId, computeEffectiveGain(volume, muted))
}
