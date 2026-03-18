export type TrackType = 'video' | 'audio' | 'annotation'

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export type MediaAssetType = 'video' | 'audio' | 'image'

export interface Keyframe {
  id: string
  time: number // seconds relative to clip start
  value: number
  easing: EasingType
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
}

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  locked: boolean
  volume: number // 0–1, default 1
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
