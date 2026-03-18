import type { Clip, Track, TransitionType } from '@/store/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveTransition {
  /** The clip that is transitioning OUT (has transitionOut set) */
  outgoingClip: Clip
  /** The clip that is transitioning IN (immediately follows outgoingClip on the same track) */
  incomingClip: Clip
  /** Transition type */
  type: TransitionType
  /** Duration of the transition in seconds */
  duration: number
  /**
   * Progress through the transition.
   * 0 = beginning of transition (outgoing clip still fully visible),
   * 1 = end of transition (incoming clip fully visible).
   */
  progress: number
  /** Absolute timeline time when the transition window begins */
  transitionStart: number
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Find the active transition at the given playback time.
 *
 * The transition window occupies the LAST `duration` seconds of the outgoing
 * clip.  The incoming clip must start at or before the end of the outgoing
 * clip for the transition to be detected.
 *
 * Returns null when not inside any transition zone.
 */
export function findTransitionAtTime(
  tracks: Track[],
  currentTime: number,
): ActiveTransition | null {
  for (const track of tracks) {
    if (track.type !== 'video' || track.muted) continue

    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime)

    for (let i = 0; i < sorted.length - 1; i++) {
      const outgoing = sorted[i]
      const transition = outgoing.transitionOut
      if (!transition) continue

      const outgoingEnd = outgoing.startTime + outgoing.duration
      const transitionStart = outgoingEnd - transition.duration

      if (currentTime >= transitionStart && currentTime < outgoingEnd) {
        const incoming = sorted[i + 1]
        // Only apply transition if the incoming clip starts at or before the end of outgoing
        if (incoming.startTime <= outgoingEnd) {
          const progress = (currentTime - transitionStart) / transition.duration
          return {
            outgoingClip: outgoing,
            incomingClip: incoming,
            type: transition.type,
            duration: transition.duration,
            progress: Math.min(1, Math.max(0, progress)),
            transitionStart,
          }
        }
      }
    }
  }
  return null
}

/**
 * Given an active transition and the current timeline time, compute the source
 * media time for the incoming clip during the transition.
 *
 * The incoming clip plays from its `sourceIn` starting at `transitionStart`.
 */
export function incomingSourceTime(transition: ActiveTransition, currentTime: number): number {
  const elapsed = currentTime - transition.transitionStart
  return transition.incomingClip.sourceIn + elapsed * transition.incomingClip.speed
}

/**
 * Compute CSS opacity for the outgoing clip during a transition.
 */
export function outgoingOpacity(type: TransitionType, progress: number): number {
  switch (type) {
    case 'cross-dissolve':
      return 1 - progress
    case 'fade-to-black':
      // First half: fade out to black
      return progress < 0.5 ? 1 - progress * 2 : 0
    case 'wipe-left':
      // Outgoing clip stays fully visible; incoming clip wipes over it
      return 1
  }
}

/**
 * Compute CSS opacity for the incoming clip during a transition.
 */
export function incomingOpacity(type: TransitionType, progress: number): number {
  switch (type) {
    case 'cross-dissolve':
      return progress
    case 'fade-to-black':
      // Second half: fade in from black
      return progress >= 0.5 ? (progress - 0.5) * 2 : 0
    case 'wipe-left':
      return 1
  }
}

/**
 * Compute a CSS clip-path for the incoming clip during a wipe-left transition.
 * Returns null for non-wipe transitions.
 *
 * The wipe reveals the incoming clip from left to right.
 */
export function incomingClipPath(type: TransitionType, progress: number): string | null {
  if (type !== 'wipe-left') return null
  const rightPercent = (1 - progress) * 100
  // Reveal from left: clip the right portion away
  return `inset(0 ${rightPercent.toFixed(2)}% 0 0)`
}

/**
 * Clamp a transition duration to the valid range [0.1, 3.0].
 */
export function clampTransitionDuration(duration: number): number {
  return Math.min(3.0, Math.max(0.1, duration))
}

export const TRANSITION_DURATION_MIN = 0.1
export const TRANSITION_DURATION_MAX = 3.0
export const TRANSITION_DURATION_DEFAULT = 0.5

export const TRANSITION_TYPE_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'cross-dissolve', label: 'Cross Dissolve' },
  { value: 'fade-to-black', label: 'Fade to Black' },
  { value: 'wipe-left', label: 'Wipe Left' },
]
