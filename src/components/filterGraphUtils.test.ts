import { describe, it, expect } from 'vitest'
import {
  buildAtempoChain,
  transitionTypeToXfade,
  buildClipVideoFilter,
  buildClipAudioFilter,
  buildXfadeFilter,
  collectInputs,
  buildFFmpegArgs,
} from './filterGraphUtils'
import type { Clip, ProjectState, Track, MediaAsset } from '@/store/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    trackId: 'track-1',
    sourceId: 'asset-1',
    startTime: 0,
    duration: 5,
    sourceIn: 0,
    sourceOut: 5,
    speed: 1,
    effects: [],
    ...overrides,
  }
}

function makeVideoAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'asset-1',
    name: 'clip.mp4',
    type: 'video',
    url: 'blob:file1',
    duration: 10,
    ...overrides,
  }
}

function makeProject(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    id: 'proj-1',
    name: 'Test',
    fps: 30,
    width: 1920,
    height: 1080,
    tracks: [],
    mediaAssets: [],
    ...overrides,
  }
}

const PROJECT_DIMS = { width: 1920, height: 1080, fps: 30 }

// ---------------------------------------------------------------------------
// buildAtempoChain
// ---------------------------------------------------------------------------

describe('buildAtempoChain', () => {
  it('returns a single atempo for speed=1', () => {
    const chain = buildAtempoChain(1)
    expect(chain).toHaveLength(1)
    expect(chain[0]).toMatch(/^atempo=1\./)
  })

  it('returns a single atempo for speed=2 (boundary)', () => {
    const chain = buildAtempoChain(2)
    expect(chain).toHaveLength(1)
    expect(chain[0]).toMatch(/^atempo=2\./)
  })

  it('chains two atempo=2.0 filters for speed=4', () => {
    const chain = buildAtempoChain(4)
    // 4x speed = atempo=2.0 (first) × atempo=2.0 (remainder) → length 2
    expect(chain).toHaveLength(2)
    expect(chain[0]).toBe('atempo=2.0')
    expect(chain[1]).toMatch(/^atempo=2\./)
  })

  it('returns a single atempo for speed=0.5 (boundary)', () => {
    const chain = buildAtempoChain(0.5)
    expect(chain).toHaveLength(1)
    expect(chain[0]).toMatch(/^atempo=0\.5/)
  })

  it('chains two atempo=0.5 filters for speed=0.25', () => {
    const chain = buildAtempoChain(0.25)
    // 0.25x speed = atempo=0.5 (first) × atempo=0.5 (remainder) → length 2
    expect(chain).toHaveLength(2)
    expect(chain[0]).toBe('atempo=0.5')
    expect(chain[1]).toMatch(/^atempo=0\.5/)
  })

  it('throws for speed <= 0', () => {
    expect(() => buildAtempoChain(0)).toThrow()
    expect(() => buildAtempoChain(-1)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// transitionTypeToXfade
// ---------------------------------------------------------------------------

describe('transitionTypeToXfade', () => {
  it('maps cross-dissolve to dissolve', () => {
    expect(transitionTypeToXfade('cross-dissolve')).toBe('dissolve')
  })

  it('maps fade-to-black to fade', () => {
    expect(transitionTypeToXfade('fade-to-black')).toBe('fade')
  })

  it('maps wipe-left to wipeleft', () => {
    expect(transitionTypeToXfade('wipe-left')).toBe('wipeleft')
  })

  it('defaults to dissolve for unknown types', () => {
    expect(transitionTypeToXfade('unknown')).toBe('dissolve')
  })
})

// ---------------------------------------------------------------------------
// buildClipVideoFilter
// ---------------------------------------------------------------------------

describe('buildClipVideoFilter', () => {
  it('starts with correct input stream label', () => {
    const clip = makeClip({ sourceIn: 1, sourceOut: 6 })
    const f = buildClipVideoFilter(clip, 2, 'vp_clip', PROJECT_DIMS)
    expect(f).toMatch(/^\[2:v\]/)
  })

  it('ends with the specified output label', () => {
    const clip = makeClip()
    const f = buildClipVideoFilter(clip, 0, 'my_out', PROJECT_DIMS)
    expect(f).toMatch(/\[my_out\]$/)
  })

  it('includes trim with sourceIn/sourceOut', () => {
    const clip = makeClip({ sourceIn: 2, sourceOut: 8 })
    const f = buildClipVideoFilter(clip, 0, 'out', PROJECT_DIMS)
    expect(f).toContain('trim=start=2:end=8')
  })

  it('normalizes PTS after trim', () => {
    const clip = makeClip()
    const f = buildClipVideoFilter(clip, 0, 'out', PROJECT_DIMS)
    expect(f).toContain('setpts=PTS-STARTPTS')
  })

  it('adds setpts for speed > 1', () => {
    const clip = makeClip({ speed: 2 })
    const f = buildClipVideoFilter(clip, 0, 'out', PROJECT_DIMS)
    expect(f).toContain('setpts=PTS/2')
  })

  it('adds setpts for speed < 1', () => {
    const clip = makeClip({ speed: 0.5 })
    const f = buildClipVideoFilter(clip, 0, 'out', PROJECT_DIMS)
    expect(f).toContain('setpts=PTS/0.5')
  })

  it('does NOT add speed setpts when speed=1', () => {
    const clip = makeClip({ speed: 1 })
    const f = buildClipVideoFilter(clip, 0, 'out', PROJECT_DIMS)
    // Should have exactly one setpts (PTS-STARTPTS), not a second one for speed
    const count = (f.match(/setpts=/g) ?? []).length
    expect(count).toBe(1)
  })

  it('scales to project dimensions', () => {
    const clip = makeClip()
    const f = buildClipVideoFilter(clip, 0, 'out', { width: 1280, height: 720, fps: 25 })
    expect(f).toContain('scale=1280:720')
  })

  it('appends effect filters when clip has effects', () => {
    const clip = makeClip({
      effects: [
        {
          id: 'e1',
          type: 'text',
          params: {
            text: 'Hello',
            x: 10,
            y: 20,
            fontSize: 24,
            color: '#ff0000',
            fontFamily: 'sans-serif',
          },
          keyframes: [],
        },
      ],
    })
    const f = buildClipVideoFilter(clip, 0, 'out', PROJECT_DIMS)
    expect(f).toContain('drawtext=')
  })
})

// ---------------------------------------------------------------------------
// buildClipAudioFilter
// ---------------------------------------------------------------------------

describe('buildClipAudioFilter', () => {
  it('starts with correct input stream label', () => {
    const clip = makeClip()
    const f = buildClipAudioFilter(clip, 3, 'ap_out')
    expect(f).toMatch(/^\[3:a\]/)
  })

  it('ends with the specified output label', () => {
    const clip = makeClip()
    const f = buildClipAudioFilter(clip, 0, 'audio_out')
    expect(f).toMatch(/\[audio_out\]$/)
  })

  it('includes atrim with sourceIn/sourceOut', () => {
    const clip = makeClip({ sourceIn: 1.5, sourceOut: 7 })
    const f = buildClipAudioFilter(clip, 0, 'out')
    expect(f).toContain('atrim=start=1.5:end=7')
  })

  it('normalizes PTS after atrim', () => {
    const clip = makeClip()
    const f = buildClipAudioFilter(clip, 0, 'out')
    expect(f).toContain('asetpts=PTS-STARTPTS')
  })

  it('adds atempo chain for speed=2', () => {
    const clip = makeClip({ speed: 2 })
    const f = buildClipAudioFilter(clip, 0, 'out')
    expect(f).toContain('atempo=')
  })

  it('adds adelay for startTime > 0', () => {
    const clip = makeClip({ startTime: 3 })
    const f = buildClipAudioFilter(clip, 0, 'out')
    expect(f).toContain('adelay=3000:all=1')
  })

  it('does NOT add adelay when startTime=0', () => {
    const clip = makeClip({ startTime: 0 })
    const f = buildClipAudioFilter(clip, 0, 'out')
    expect(f).not.toContain('adelay')
  })

  it('rounds adelay to nearest millisecond', () => {
    const clip = makeClip({ startTime: 1.5 })
    const f = buildClipAudioFilter(clip, 0, 'out')
    expect(f).toContain('adelay=1500:all=1')
  })
})

// ---------------------------------------------------------------------------
// buildXfadeFilter
// ---------------------------------------------------------------------------

describe('buildXfadeFilter', () => {
  it('wraps stream labels in brackets', () => {
    const f = buildXfadeFilter('a', 'b', 'out', 'cross-dissolve', 0.5, 4.5)
    expect(f).toContain('[a][b]')
    expect(f).toContain('[out]')
  })

  it('uses dissolve for cross-dissolve', () => {
    const f = buildXfadeFilter('a', 'b', 'out', 'cross-dissolve', 0.5, 4.5)
    expect(f).toContain('transition=dissolve')
  })

  it('uses fade for fade-to-black', () => {
    const f = buildXfadeFilter('a', 'b', 'out', 'fade-to-black', 0.5, 4.5)
    expect(f).toContain('transition=fade')
  })

  it('uses wipeleft for wipe-left', () => {
    const f = buildXfadeFilter('a', 'b', 'out', 'wipe-left', 0.5, 4.5)
    expect(f).toContain('transition=wipeleft')
  })

  it('includes duration and offset', () => {
    const f = buildXfadeFilter('a', 'b', 'out', 'cross-dissolve', 0.75, 3.25)
    expect(f).toContain('duration=0.75')
    expect(f).toContain('offset=3.25')
  })
})

// ---------------------------------------------------------------------------
// collectInputs
// ---------------------------------------------------------------------------

describe('collectInputs', () => {
  it('returns empty array for empty project', () => {
    const project = makeProject()
    expect(collectInputs(project)).toEqual([])
  })

  it('returns one entry per clip with resolved URL', () => {
    const asset = makeVideoAsset({ id: 'a1', url: 'blob:video1' })
    const clip = makeClip({ id: 'c1', sourceId: 'a1' })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const result = collectInputs(project)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      url: 'blob:video1',
      clipId: 'c1',
      name: 'clip.mp4',
      type: 'video',
    })
  })

  it('includes image asset type so exports can loop stills', () => {
    const asset = makeVideoAsset({ id: 'a1', url: 'blob:image1', type: 'image', duration: 0 })
    const clip = makeClip({ id: 'c1', sourceId: 'a1' })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    expect(collectInputs(project)[0].type).toBe('image')
  })

  it('skips clips whose asset is missing', () => {
    const clip = makeClip({ id: 'c1', sourceId: 'missing-asset' })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track] })
    expect(collectInputs(project)).toEqual([])
  })

  it('returns inputs in track then clip order', () => {
    const a1 = makeVideoAsset({ id: 'a1', url: 'blob:a1' })
    const a2 = makeVideoAsset({ id: 'a2', url: 'blob:a2' })
    const c1 = makeClip({ id: 'c1', sourceId: 'a1', startTime: 0 })
    const c2 = makeClip({ id: 'c2', sourceId: 'a2', startTime: 5 })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [c1, c2],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [a1, a2] })
    const result = collectInputs(project)
    expect(result.map((r) => r.url)).toEqual(['blob:a1', 'blob:a2'])
  })
})

// ---------------------------------------------------------------------------
// buildFFmpegArgs
// ---------------------------------------------------------------------------

describe('buildFFmpegArgs', () => {
  it('returns empty args when project has no tracks', () => {
    const project = makeProject()
    const args = buildFFmpegArgs(project)
    expect(args.inputs).toEqual([])
    expect(args.filterComplex).toBe('')
    expect(args.videoMap).toBe('')
    expect(args.audioMap).toBeNull()
  })

  it('includes source URL in inputs list', () => {
    const asset = makeVideoAsset({ id: 'a1', url: 'blob:myvideo' })
    const clip = makeClip({ id: 'c1', sourceId: 'a1' })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.inputs).toContain('blob:myvideo')
  })

  it('videoMap is a stream label string for a project with video clips', () => {
    const asset = makeVideoAsset()
    const clip = makeClip()
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.videoMap).toMatch(/^\[.+\]$/)
  })

  it('composites a single video clip onto a finite canvas', () => {
    const asset = makeVideoAsset()
    const clip = makeClip({ duration: 5 })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.filterComplex).toContain('color=black')
    expect(args.filterComplex).toContain('d=5')
    expect(args.filterComplex).toContain('overlay=eof_action=pass:shortest=1')
    expect(args.videoMap).toBe('[vout]')
  })

  it('filterComplex contains trim filter for the clip sourceIn/sourceOut', () => {
    const asset = makeVideoAsset()
    const clip = makeClip({ sourceIn: 2, sourceOut: 7 })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.filterComplex).toContain('trim=start=2:end=7')
  })

  it('muted video tracks are excluded from the filter graph', () => {
    const asset = makeVideoAsset()
    const clip = makeClip({ sourceIn: 0, sourceOut: 5 })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: true,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.inputs).toHaveLength(1) // input still registered
    expect(args.filterComplex).not.toContain('trim=') // but not processed
  })

  it('audio clips are processed and audioMap is set', () => {
    const asset: MediaAsset = {
      id: 'a1',
      name: 'vo.mp3',
      type: 'audio',
      url: 'blob:audio1',
      duration: 5,
    }
    const clip = makeClip({ id: 'c1', sourceId: 'a1' })
    const track: Track = {
      id: 't1',
      type: 'audio',
      name: 'Audio',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.audioMap).not.toBeNull()
    expect(args.filterComplex).toContain('atrim=')
  })

  it('video clips do not create audio filters because their audio stream may be absent', () => {
    const asset = makeVideoAsset()
    const clip = makeClip()
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.audioMap).toBeNull()
    expect(args.filterComplex).not.toContain('[0:a]')
    expect(args.filterComplex).not.toContain('atrim=')
  })

  it('two audio clips produce amix in filterComplex', () => {
    const a1: MediaAsset = { id: 'a1', name: 'a.mp3', type: 'audio', url: 'blob:a1', duration: 5 }
    const a2: MediaAsset = { id: 'a2', name: 'b.mp3', type: 'audio', url: 'blob:a2', duration: 5 }
    const c1 = makeClip({ id: 'c1', sourceId: 'a1', startTime: 0 })
    const c2 = makeClip({ id: 'c2', sourceId: 'a2', startTime: 5 })
    const track: Track = {
      id: 't1',
      type: 'audio',
      name: 'Audio',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [c1, c2],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [a1, a2] })
    const args = buildFFmpegArgs(project)
    expect(args.filterComplex).toContain('amix=inputs=2')
    expect(args.audioMap).toBe('[aout]')
  })

  it('volume != 1 adds volume filter for audio track', () => {
    const asset: MediaAsset = {
      id: 'a1',
      name: 'vo.mp3',
      type: 'audio',
      url: 'blob:audio1',
      duration: 5,
    }
    const clip = makeClip({ id: 'c1', sourceId: 'a1' })
    const track: Track = {
      id: 't1',
      type: 'audio',
      name: 'Audio',
      muted: false,
      locked: false,
      volume: 0.5,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.filterComplex).toContain('volume=0.5')
  })

  it('image assets are excluded from audio processing', () => {
    const asset: MediaAsset = {
      id: 'a1',
      name: 'img.png',
      type: 'image',
      url: 'blob:img1',
      duration: 0,
    }
    const clip = makeClip({ id: 'c1', sourceId: 'a1' })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.audioMap).toBeNull()
    expect(args.filterComplex).not.toContain('atrim=')
  })

  it('two video tracks produce overlay and black base in filterComplex', () => {
    const a1 = makeVideoAsset({ id: 'a1', url: 'blob:v1' })
    const a2 = makeVideoAsset({ id: 'a2', url: 'blob:v2' })
    const c1 = makeClip({ id: 'c1', sourceId: 'a1' })
    const c2 = makeClip({ id: 'c2', sourceId: 'a2' })
    const t1: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [c1],
    }
    const t2: Track = {
      id: 't2',
      type: 'video',
      name: 'V2',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [c2],
    }
    const project = makeProject({ tracks: [t1, t2], mediaAssets: [a1, a2] })
    const args = buildFFmpegArgs(project)
    expect(args.filterComplex).toContain('color=black')
    expect(args.filterComplex).toContain('overlay=')
    expect(args.videoMap).toBe('[vout]')
  })

  it('clip with transitionOut uses xfade between consecutive clips', () => {
    const asset = makeVideoAsset()
    const c1 = makeClip({
      id: 'c1',
      sourceId: 'asset-1',
      startTime: 0,
      duration: 5,
      sourceIn: 0,
      sourceOut: 5,
      transitionOut: { type: 'cross-dissolve', duration: 0.5 },
    })
    const c2 = makeClip({
      id: 'c2',
      sourceId: 'asset-1',
      startTime: 4.5,
      duration: 5,
      sourceIn: 0,
      sourceOut: 5,
    })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [c1, c2],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.filterComplex).toContain('xfade=transition=dissolve')
    expect(args.filterComplex).toContain('duration=0.5')
  })

  it('clip with startTime > 0 gets setpts offset in filterComplex', () => {
    const asset = makeVideoAsset()
    const clip = makeClip({ startTime: 10, duration: 5 })
    const track: Track = {
      id: 't1',
      type: 'video',
      name: 'V1',
      muted: false,
      locked: false,
      volume: 1,
      noiseReduction: false,
      clips: [clip],
    }
    const project = makeProject({ tracks: [track], mediaAssets: [asset] })
    const args = buildFFmpegArgs(project)
    expect(args.filterComplex).toContain('setpts=PTS+10/TB')
  })
})
