export type TrackType = 'video' | 'audio' | 'annotation'

export type TransitionType = 'cross-dissolve' | 'fade-to-black' | 'wipe-left'

export interface ClipTransition {
  type: TransitionType
  /** Duration in seconds (0.1 – 3.0) */
  duration: number
}

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export type MediaAssetType = 'video' | 'audio' | 'image'

export interface Keyframe {
  id: string
  time: number // seconds relative to clip start
  value: number
  easing: EasingType
  /** Optional channel name for multi-property keyframing (e.g. 'x', 'y', 'scaleX'). */
  channel?: string
}

export interface Effect {
  id: string
  type: string
  params: Record<string, unknown>
  keyframes: Keyframe[]
}

export interface Clip {
  id: string
  trackId: string
  sourceId: string // reference to MediaAsset id
  startTime: number // position on timeline (seconds)
  duration: number // duration on timeline (seconds)
  sourceIn: number // in point in source media (seconds)
  sourceOut: number // out point in source media (seconds)
  speed: number // 0.25–4
  effects: Effect[]
  /** Transition applied at the end of this clip (leading into the next clip on the same track) */
  transitionOut?: ClipTransition
}

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  locked: boolean
  volume: number // 0–1, default 1
  noiseReduction: boolean // high-pass filter toggle, default false
  clips: Clip[]
}

export interface MediaAsset {
  id: string
  name: string
  type: MediaAssetType
  url: string
  duration: number // seconds (0 for images)
  width?: number
  height?: number
  thumbnail?: string
}

export interface ProjectState {
  id: string
  name: string
  fps: number
  width: number
  height: number
  tracks: Track[]
  mediaAssets: MediaAsset[]
}

export interface PlaybackState {
  currentTime: number // seconds
  isPlaying: boolean
  inPoint: number | null
  outPoint: number | null
}

export interface SelectionState {
  selectedClipIds: string[]
  selectedTrackId: string | null
}

export interface UIState {
  pixelsPerSecond: number // zoom level
  scrollLeft: number // horizontal scroll in pixels
}
