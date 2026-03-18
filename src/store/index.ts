import { create, useStore } from 'zustand'
import { temporal } from 'zundo'
import type { TemporalState } from 'zundo'
import type {
  Clip,
  MediaAsset,
  PlaybackState,
  ProjectState,
  SelectionState,
  Track,
  TrackType,
  UIState,
} from './types'

export type {
  Clip,
  EasingType,
  Effect,
  Keyframe,
  MediaAsset,
  MediaAssetType,
  Track,
  TrackType,
} from './types'

interface EditorActions {
  // Project
  setProjectName: (name: string) => void

  // Tracks
  addTrack: (type: TrackType, name?: string) => void
  removeTrack: (trackId: string) => void
  reorderTracks: (trackIds: string[]) => void
  setTrackMuted: (trackId: string, muted: boolean) => void
  setTrackLocked: (trackId: string, locked: boolean) => void
  setTrackVolume: (trackId: string, volume: number) => void
  setTrackNoiseReduction: (trackId: string, enabled: boolean) => void
  renameTrack: (trackId: string, name: string) => void

  // Clips
  addClip: (trackId: string, clip: Omit<Clip, 'id' | 'trackId'>) => void
  removeClip: (clipId: string) => void
  removeClips: (clipIds: string[]) => void
  moveClip: (clipId: string, targetTrackId: string, startTime: number) => void
  trimClip: (
    clipId: string,
    startTime: number,
    duration: number,
    sourceIn: number,
    sourceOut: number,
  ) => void
  setClipSpeed: (clipId: string, speed: number) => void
  splitClip: (clipId: string, splitTime: number) => string[] | null

  // Media assets
  addMediaAsset: (asset: Omit<MediaAsset, 'id'>) => MediaAsset
  removeMediaAsset: (assetId: string) => void

  // Playback
  setCurrentTime: (time: number) => void
  setIsPlaying: (isPlaying: boolean) => void
  setInPoint: (time: number | null) => void
  setOutPoint: (time: number | null) => void

  // Selection
  selectClip: (clipId: string, addToSelection?: boolean) => void
  selectTrack: (trackId: string | null) => void
  clearSelection: () => void

  // UI
  setPixelsPerSecond: (pps: number) => void
  setScrollLeft: (scroll: number) => void
}

export interface EditorStore extends EditorActions {
  project: ProjectState
  playback: PlaybackState
  selection: SelectionState
  ui: UIState
}

const DEFAULT_PROJECT: ProjectState = {
  id: crypto.randomUUID(),
  name: 'Untitled Project',
  fps: 30,
  width: 1920,
  height: 1080,
  tracks: [],
  mediaAssets: [],
}

const DEFAULT_PLAYBACK: PlaybackState = {
  currentTime: 0,
  isPlaying: false,
  inPoint: null,
  outPoint: null,
}

const DEFAULT_SELECTION: SelectionState = {
  selectedClipIds: [],
  selectedTrackId: null,
}

const DEFAULT_UI: UIState = {
  pixelsPerSecond: 100,
  scrollLeft: 0,
}

function updateTrackInProject(
  tracks: Track[],
  trackId: string,
  updater: (track: Track) => Track,
): Track[] {
  return tracks.map((t) => (t.id === trackId ? updater(t) : t))
}

function updateClipInTracks(
  tracks: Track[],
  clipId: string,
  updater: (clip: Clip) => Clip,
): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((c) => (c.id === clipId ? updater(c) : c)),
  }))
}

function findClip(tracks: Track[], clipId: string): Clip | undefined {
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId)
    if (clip) return clip
  }
  return undefined
}

function defaultTrackName(type: TrackType, index: number): string {
  const labels: Record<TrackType, string> = {
    video: 'Video',
    audio: 'Audio',
    annotation: 'Annotation',
  }
  return `${labels[type]} ${index}`
}

function countTracksOfType(tracks: Track[], type: TrackType): number {
  return tracks.filter((t) => t.type === type).length
}

export const useEditorStore = create<EditorStore>()(
  temporal(
    (set, get) => ({
      project: DEFAULT_PROJECT,
      playback: DEFAULT_PLAYBACK,
      selection: DEFAULT_SELECTION,
      ui: DEFAULT_UI,

      // --- Project ---

      setProjectName: (name) => set((state) => ({ project: { ...state.project, name } })),

      // --- Tracks ---

      addTrack: (type, name) => {
        set((state) => {
          const index = countTracksOfType(state.project.tracks, type) + 1
          const track: Track = {
            id: crypto.randomUUID(),
            type,
            name: name ?? defaultTrackName(type, index),
            muted: false,
            locked: false,
            volume: 1,
            noiseReduction: false,
            clips: [],
          }
          return {
            project: {
              ...state.project,
              tracks: [...state.project.tracks, track],
            },
          }
        })
      },

      removeTrack: (trackId) => {
        set((state) => {
          const removedClipIds = new Set(
            state.project.tracks.find((t) => t.id === trackId)?.clips.map((c) => c.id) ?? [],
          )
          return {
            project: {
              ...state.project,
              tracks: state.project.tracks.filter((t) => t.id !== trackId),
            },
            selection: {
              ...state.selection,
              selectedClipIds: state.selection.selectedClipIds.filter(
                (id) => !removedClipIds.has(id),
              ),
              selectedTrackId:
                state.selection.selectedTrackId === trackId
                  ? null
                  : state.selection.selectedTrackId,
            },
          }
        })
      },

      reorderTracks: (trackIds) => {
        set((state) => {
          const trackMap = new Map(state.project.tracks.map((t) => [t.id, t]))
          const reordered = trackIds.flatMap((id) => {
            const t = trackMap.get(id)
            return t ? [t] : []
          })
          return { project: { ...state.project, tracks: reordered } }
        })
      },

      setTrackMuted: (trackId, muted) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: updateTrackInProject(state.project.tracks, trackId, (t) => ({
              ...t,
              muted,
            })),
          },
        }))
      },

      setTrackLocked: (trackId, locked) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: updateTrackInProject(state.project.tracks, trackId, (t) => ({
              ...t,
              locked,
            })),
          },
        }))
      },

      setTrackVolume: (trackId, volume) => {
        const clamped = Math.min(1, Math.max(0, volume))
        set((state) => ({
          project: {
            ...state.project,
            tracks: updateTrackInProject(state.project.tracks, trackId, (t) => ({
              ...t,
              volume: clamped,
            })),
          },
        }))
      },

      setTrackNoiseReduction: (trackId, enabled) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: updateTrackInProject(state.project.tracks, trackId, (t) => ({
              ...t,
              noiseReduction: enabled,
            })),
          },
        }))
      },

      renameTrack: (trackId, name) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: updateTrackInProject(state.project.tracks, trackId, (t) => ({
              ...t,
              name,
            })),
          },
        }))
      },

      // --- Clips ---

      addClip: (trackId, clip) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: updateTrackInProject(state.project.tracks, trackId, (t) => ({
              ...t,
              clips: [...t.clips, { ...clip, id: crypto.randomUUID(), trackId }],
            })),
          },
        }))
      },

      removeClip: (clipId) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: state.project.tracks.map((t) => ({
              ...t,
              clips: t.clips.filter((c) => c.id !== clipId),
            })),
          },
          selection: {
            ...state.selection,
            selectedClipIds: state.selection.selectedClipIds.filter((id) => id !== clipId),
          },
        }))
      },

      removeClips: (clipIds) => {
        const ids = new Set(clipIds)
        set((state) => ({
          project: {
            ...state.project,
            tracks: state.project.tracks.map((t) => ({
              ...t,
              clips: t.clips.filter((c) => !ids.has(c.id)),
            })),
          },
          selection: {
            ...state.selection,
            selectedClipIds: state.selection.selectedClipIds.filter((id) => !ids.has(id)),
          },
        }))
      },

      moveClip: (clipId, targetTrackId, startTime) => {
        set((state) => {
          const clip = findClip(state.project.tracks, clipId)
          if (!clip) return state

          const updatedClip: Clip = { ...clip, trackId: targetTrackId, startTime }
          const tracks = state.project.tracks.map((t) => {
            if (t.id === clip.trackId && t.id !== targetTrackId) {
              return { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
            }
            if (t.id === targetTrackId && t.id !== clip.trackId) {
              return { ...t, clips: [...t.clips, updatedClip] }
            }
            if (t.id === clip.trackId && t.id === targetTrackId) {
              return {
                ...t,
                clips: t.clips.map((c) => (c.id === clipId ? updatedClip : c)),
              }
            }
            return t
          })
          return { project: { ...state.project, tracks } }
        })
      },

      trimClip: (clipId, startTime, duration, sourceIn, sourceOut) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: updateClipInTracks(state.project.tracks, clipId, (c) => ({
              ...c,
              startTime,
              duration,
              sourceIn,
              sourceOut,
            })),
          },
        }))
      },

      setClipSpeed: (clipId, speed) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: updateClipInTracks(state.project.tracks, clipId, (c) => {
              const clamped = Math.min(4, Math.max(0.25, speed))
              const duration = (c.sourceOut - c.sourceIn) / clamped
              return { ...c, speed: clamped, duration }
            }),
          },
        }))
      },

      splitClip: (clipId, splitTime) => {
        const state = get()
        const clip = findClip(state.project.tracks, clipId)
        if (!clip) return null

        const clipEnd = clip.startTime + clip.duration
        if (splitTime <= clip.startTime || splitTime >= clipEnd) return null

        const leftDuration = splitTime - clip.startTime
        const rightDuration = clip.duration - leftDuration
        const splitSourceTime = clip.sourceIn + leftDuration * clip.speed

        const leftId = crypto.randomUUID()
        const rightId = crypto.randomUUID()

        const leftClip: Clip = {
          ...clip,
          id: leftId,
          duration: leftDuration,
          sourceOut: splitSourceTime,
        }
        const rightClip: Clip = {
          ...clip,
          id: rightId,
          startTime: splitTime,
          duration: rightDuration,
          sourceIn: splitSourceTime,
        }

        set((prev) => ({
          project: {
            ...prev.project,
            tracks: prev.project.tracks.map((t) => {
              if (t.id !== clip.trackId) return t
              return {
                ...t,
                clips: t.clips.flatMap((c) => (c.id === clipId ? [leftClip, rightClip] : [c])),
              }
            }),
          },
          selection: {
            ...prev.selection,
            selectedClipIds: prev.selection.selectedClipIds
              .filter((id) => id !== clipId)
              .concat([leftId, rightId]),
          },
        }))

        return [leftId, rightId]
      },

      // --- Media assets ---

      addMediaAsset: (asset) => {
        const newAsset: MediaAsset = { ...asset, id: crypto.randomUUID() }
        set((state) => ({
          project: {
            ...state.project,
            mediaAssets: [...state.project.mediaAssets, newAsset],
          },
        }))
        return newAsset
      },

      removeMediaAsset: (assetId) => {
        set((state) => ({
          project: {
            ...state.project,
            mediaAssets: state.project.mediaAssets.filter((a) => a.id !== assetId),
          },
        }))
      },

      // --- Playback ---

      setCurrentTime: (time) =>
        set((state) => ({ playback: { ...state.playback, currentTime: time } })),

      setIsPlaying: (isPlaying) => set((state) => ({ playback: { ...state.playback, isPlaying } })),

      setInPoint: (time) => set((state) => ({ playback: { ...state.playback, inPoint: time } })),

      setOutPoint: (time) => set((state) => ({ playback: { ...state.playback, outPoint: time } })),

      // --- Selection ---

      selectClip: (clipId, addToSelection = false) => {
        set((state) => ({
          selection: {
            ...state.selection,
            selectedClipIds: addToSelection
              ? state.selection.selectedClipIds.includes(clipId)
                ? state.selection.selectedClipIds.filter((id) => id !== clipId)
                : [...state.selection.selectedClipIds, clipId]
              : [clipId],
          },
        }))
      },

      selectTrack: (trackId) => {
        set((state) => ({
          selection: { ...state.selection, selectedTrackId: trackId },
        }))
      },

      clearSelection: () => {
        set({ selection: DEFAULT_SELECTION })
      },

      // --- UI ---

      setPixelsPerSecond: (pps) => {
        set((state) => ({ ui: { ...state.ui, pixelsPerSecond: pps } }))
      },

      setScrollLeft: (scroll) => {
        set((state) => ({ ui: { ...state.ui, scrollLeft: scroll } }))
      },
    }),
    {
      // Only track project state changes for undo/redo (not playback, selection, or ui)
      partialize: (state) => ({ project: state.project }),
      // Use referential equality on project to avoid recording non-project changes
      equality: (a, b) => a.project === b.project,
    },
  ),
)

export type UndoRedoState = TemporalState<Pick<EditorStore, 'project'>>

export const useUndoRedo = () => useStore(useEditorStore.temporal)
