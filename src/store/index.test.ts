import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store'
import type { EditorStore } from '@/store'

function getStore(): EditorStore {
  return useEditorStore.getState()
}

function reset() {
  useEditorStore.setState({
    project: {
      id: crypto.randomUUID(),
      name: 'Untitled Project',
      fps: 30,
      width: 1920,
      height: 1080,
      tracks: [],
      mediaAssets: [],
    },
    playback: { currentTime: 0, isPlaying: false, inPoint: null, outPoint: null },
    selection: { selectedClipIds: [], selectedTrackId: null },
    ui: { pixelsPerSecond: 100, scrollLeft: 0 },
  })
}

beforeEach(reset)

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

describe('project', () => {
  it('renames project', () => {
    getStore().setProjectName('My Video')
    expect(getStore().project.name).toBe('My Video')
  })
})

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

describe('tracks', () => {
  it('adds a video track', () => {
    getStore().addTrack('video')
    const { tracks } = getStore().project
    expect(tracks).toHaveLength(1)
    expect(tracks[0].type).toBe('video')
    expect(tracks[0].muted).toBe(false)
    expect(tracks[0].locked).toBe(false)
  })

  it('auto-names tracks by type and count', () => {
    getStore().addTrack('video')
    getStore().addTrack('video')
    getStore().addTrack('audio')
    const { tracks } = getStore().project
    expect(tracks[0].name).toBe('Video 1')
    expect(tracks[1].name).toBe('Video 2')
    expect(tracks[2].name).toBe('Audio 1')
  })

  it('accepts a custom name', () => {
    getStore().addTrack('annotation', 'My Annotations')
    expect(getStore().project.tracks[0].name).toBe('My Annotations')
  })

  it('removes a track and clears its clips from selection', () => {
    getStore().addTrack('video')
    const trackId = getStore().project.tracks[0].id

    // Add a clip and select it
    getStore().addClip(trackId, {
      sourceId: 'src1',
      startTime: 0,
      duration: 5,
      sourceIn: 0,
      sourceOut: 5,
      speed: 1,
      effects: [],
    })
    const clipId = getStore().project.tracks[0].clips[0].id
    getStore().selectClip(clipId)

    getStore().removeTrack(trackId)
    expect(getStore().project.tracks).toHaveLength(0)
    expect(getStore().selection.selectedClipIds).toHaveLength(0)
  })

  it('reorders tracks', () => {
    getStore().addTrack('video')
    getStore().addTrack('audio')
    getStore().addTrack('annotation')
    const ids = getStore().project.tracks.map((t) => t.id)
    getStore().reorderTracks([ids[2], ids[0], ids[1]])
    const newOrder = getStore().project.tracks.map((t) => t.id)
    expect(newOrder).toEqual([ids[2], ids[0], ids[1]])
  })

  it('mutes and locks tracks', () => {
    getStore().addTrack('audio')
    const trackId = getStore().project.tracks[0].id
    getStore().setTrackMuted(trackId, true)
    getStore().setTrackLocked(trackId, true)
    const track = getStore().project.tracks[0]
    expect(track.muted).toBe(true)
    expect(track.locked).toBe(true)
  })

  it('renames a track', () => {
    getStore().addTrack('video')
    const trackId = getStore().project.tracks[0].id
    getStore().renameTrack(trackId, 'Main Camera')
    expect(getStore().project.tracks[0].name).toBe('Main Camera')
  })
})

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

describe('clips', () => {
  function addTrackAndClip() {
    getStore().addTrack('video')
    const trackId = getStore().project.tracks[0].id
    getStore().addClip(trackId, {
      sourceId: 'source1',
      startTime: 2,
      duration: 10,
      sourceIn: 0,
      sourceOut: 10,
      speed: 1,
      effects: [],
    })
    const clipId = getStore().project.tracks[0].clips[0].id
    return { trackId, clipId }
  }

  it('adds a clip to a track', () => {
    const { trackId, clipId } = addTrackAndClip()
    const track = getStore().project.tracks.find((t) => t.id === trackId)!
    expect(track.clips).toHaveLength(1)
    expect(clipId).toBeTruthy()
    expect(track.clips[0].startTime).toBe(2)
  })

  it('removes a clip', () => {
    const { clipId } = addTrackAndClip()
    getStore().removeClip(clipId)
    expect(getStore().project.tracks[0].clips).toHaveLength(0)
  })

  it('removes multiple clips', () => {
    getStore().addTrack('video')
    const trackId = getStore().project.tracks[0].id
    const clipData = {
      sourceId: 'src',
      startTime: 0,
      duration: 5,
      sourceIn: 0,
      sourceOut: 5,
      speed: 1,
      effects: [],
    }
    getStore().addClip(trackId, clipData)
    getStore().addClip(trackId, { ...clipData, startTime: 5 })
    const ids = getStore().project.tracks[0].clips.map((c) => c.id)
    getStore().removeClips(ids)
    expect(getStore().project.tracks[0].clips).toHaveLength(0)
  })

  it('moves a clip within the same track', () => {
    const { trackId, clipId } = addTrackAndClip()
    getStore().moveClip(clipId, trackId, 20)
    expect(getStore().project.tracks[0].clips[0].startTime).toBe(20)
  })

  it('moves a clip to a different track', () => {
    const { clipId } = addTrackAndClip()
    getStore().addTrack('audio')
    const audioTrackId = getStore().project.tracks[1].id
    getStore().moveClip(clipId, audioTrackId, 0)
    expect(getStore().project.tracks[0].clips).toHaveLength(0)
    expect(getStore().project.tracks[1].clips).toHaveLength(1)
    expect(getStore().project.tracks[1].clips[0].trackId).toBe(audioTrackId)
  })

  it('trims a clip', () => {
    const { clipId } = addTrackAndClip()
    getStore().trimClip(clipId, 3, 6, 1, 7)
    const clip = getStore().project.tracks[0].clips[0]
    expect(clip.startTime).toBe(3)
    expect(clip.duration).toBe(6)
    expect(clip.sourceIn).toBe(1)
    expect(clip.sourceOut).toBe(7)
  })

  it('sets clip speed clamped to [0.25, 4]', () => {
    const { clipId } = addTrackAndClip()
    getStore().setClipSpeed(clipId, 2)
    expect(getStore().project.tracks[0].clips[0].speed).toBe(2)
    getStore().setClipSpeed(clipId, 0)
    expect(getStore().project.tracks[0].clips[0].speed).toBe(0.25)
    getStore().setClipSpeed(clipId, 10)
    expect(getStore().project.tracks[0].clips[0].speed).toBe(4)
  })

  it('splits a clip at a given time', () => {
    const { clipId } = addTrackAndClip()
    // clip: startTime=2, duration=10, sourceIn=0, sourceOut=10, speed=1
    const newIds = getStore().splitClip(clipId, 7)
    expect(newIds).toHaveLength(2)

    const clips = getStore().project.tracks[0].clips
    expect(clips).toHaveLength(2)

    const left = clips.find((c) => c.id === newIds![0])!
    const right = clips.find((c) => c.id === newIds![1])!

    expect(left.startTime).toBe(2)
    expect(left.duration).toBe(5)
    expect(left.sourceIn).toBe(0)
    expect(left.sourceOut).toBeCloseTo(5)

    expect(right.startTime).toBe(7)
    expect(right.duration).toBe(5)
    expect(right.sourceIn).toBeCloseTo(5)
    expect(right.sourceOut).toBe(10)
  })

  it('returns null for split outside clip bounds', () => {
    const { clipId } = addTrackAndClip()
    expect(getStore().splitClip(clipId, 1)).toBeNull() // before clip
    expect(getStore().splitClip(clipId, 20)).toBeNull() // after clip
    expect(getStore().splitClip(clipId, 2)).toBeNull() // at start edge
    expect(getStore().splitClip(clipId, 12)).toBeNull() // at end edge
  })
})

// ---------------------------------------------------------------------------
// Media assets
// ---------------------------------------------------------------------------

describe('mediaAssets', () => {
  it('adds and removes a media asset', () => {
    const asset = getStore().addMediaAsset({
      name: 'clip.mp4',
      type: 'video',
      url: 'blob:fake',
      duration: 30,
    })
    expect(asset.id).toBeTruthy()
    expect(getStore().project.mediaAssets).toHaveLength(1)

    getStore().removeMediaAsset(asset.id)
    expect(getStore().project.mediaAssets).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

describe('playback', () => {
  it('sets current time', () => {
    getStore().setCurrentTime(5.5)
    expect(getStore().playback.currentTime).toBe(5.5)
  })

  it('toggles playing state', () => {
    getStore().setIsPlaying(true)
    expect(getStore().playback.isPlaying).toBe(true)
    getStore().setIsPlaying(false)
    expect(getStore().playback.isPlaying).toBe(false)
  })

  it('sets in/out points', () => {
    getStore().setInPoint(2)
    getStore().setOutPoint(8)
    expect(getStore().playback.inPoint).toBe(2)
    expect(getStore().playback.outPoint).toBe(8)
    getStore().setInPoint(null)
    expect(getStore().playback.inPoint).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('selection', () => {
  function setupClips() {
    getStore().addTrack('video')
    const trackId = getStore().project.tracks[0].id
    const clipData = {
      sourceId: 'src',
      startTime: 0,
      duration: 5,
      sourceIn: 0,
      sourceOut: 5,
      speed: 1,
      effects: [],
    }
    getStore().addClip(trackId, clipData)
    getStore().addClip(trackId, { ...clipData, startTime: 5 })
    return getStore().project.tracks[0].clips.map((c) => c.id)
  }

  it('selects a single clip', () => {
    const [id1, id2] = setupClips()
    getStore().selectClip(id1)
    expect(getStore().selection.selectedClipIds).toEqual([id1])
    getStore().selectClip(id2)
    expect(getStore().selection.selectedClipIds).toEqual([id2])
  })

  it('adds to selection with multi flag', () => {
    const [id1, id2] = setupClips()
    getStore().selectClip(id1)
    getStore().selectClip(id2, true)
    expect(getStore().selection.selectedClipIds).toContain(id1)
    expect(getStore().selection.selectedClipIds).toContain(id2)
  })

  it('deselects already-selected clip with multi flag', () => {
    const [id1] = setupClips()
    getStore().selectClip(id1)
    getStore().selectClip(id1, true)
    expect(getStore().selection.selectedClipIds).toHaveLength(0)
  })

  it('selects and clears track selection', () => {
    getStore().addTrack('video')
    const trackId = getStore().project.tracks[0].id
    getStore().selectTrack(trackId)
    expect(getStore().selection.selectedTrackId).toBe(trackId)
    getStore().selectTrack(null)
    expect(getStore().selection.selectedTrackId).toBeNull()
  })

  it('clears all selection', () => {
    const [id1] = setupClips()
    getStore().addTrack('audio')
    const audioTrackId = getStore().project.tracks[1].id
    getStore().selectClip(id1)
    getStore().selectTrack(audioTrackId)
    getStore().clearSelection()
    expect(getStore().selection.selectedClipIds).toHaveLength(0)
    expect(getStore().selection.selectedTrackId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

describe('ui', () => {
  it('sets pixels per second', () => {
    getStore().setPixelsPerSecond(200)
    expect(getStore().ui.pixelsPerSecond).toBe(200)
  })

  it('sets scroll left', () => {
    getStore().setScrollLeft(500)
    expect(getStore().ui.scrollLeft).toBe(500)
  })
})
