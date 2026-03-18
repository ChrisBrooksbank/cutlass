import { describe, it, expect } from 'vitest'
import { findClipIdsAtTime, getSplitCandidates } from './splitUtils'
import type { Track } from '@/store/types'

function makeTrack(clips: { id: string; startTime: number; duration: number }[]): Track {
  return {
    id: 't1',
    type: 'video',
    name: 'Video 1',
    muted: false,
    locked: false,
    volume: 1,
    clips: clips.map((c) => ({
      ...c,
      trackId: 't1',
      sourceId: 'src',
      sourceIn: 0,
      sourceOut: c.duration,
      speed: 1,
      effects: [],
    })),
  }
}

describe('findClipIdsAtTime', () => {
  const track = makeTrack([
    { id: 'a', startTime: 0, duration: 5 },
    { id: 'b', startTime: 5, duration: 5 },
    { id: 'c', startTime: 10, duration: 5 },
  ])

  it('returns clip whose range strictly contains the time', () => {
    expect(findClipIdsAtTime([track], 2.5)).toEqual(['a'])
    expect(findClipIdsAtTime([track], 7)).toEqual(['b'])
  })

  it('returns empty array when time is at clip boundaries (not strictly inside)', () => {
    expect(findClipIdsAtTime([track], 0)).toEqual([])
    expect(findClipIdsAtTime([track], 5)).toEqual([])
    expect(findClipIdsAtTime([track], 15)).toEqual([])
  })

  it('returns empty array when no clip spans the time', () => {
    expect(findClipIdsAtTime([track], 20)).toEqual([])
  })

  it('returns multiple clips across tracks if they overlap in time', () => {
    const track2 = makeTrack([{ id: 'x', startTime: 3, duration: 4 }])
    track2.id = 't2'
    track2.clips[0].trackId = 't2'
    const result = findClipIdsAtTime([track, track2], 4)
    expect(result).toContain('a')
    expect(result).toContain('x')
  })
})

describe('getSplitCandidates', () => {
  const track = makeTrack([
    { id: 'a', startTime: 0, duration: 5 },
    { id: 'b', startTime: 5, duration: 5 },
  ])

  it('returns selected clips that span the time', () => {
    const result = getSplitCandidates([track], ['a', 'b'], 2.5)
    expect(result).toEqual(['a'])
  })

  it('returns only the spanning clip when multiple selected', () => {
    const result = getSplitCandidates([track], ['a', 'b'], 7)
    expect(result).toEqual(['b'])
  })

  it('returns empty array when selected clip does not span time', () => {
    const result = getSplitCandidates([track], ['b'], 2.5)
    expect(result).toEqual([])
  })

  it('falls back to all clips at time when nothing is selected', () => {
    const result = getSplitCandidates([track], [], 2.5)
    expect(result).toEqual(['a'])
  })

  it('returns empty when no clip spans time and nothing selected', () => {
    const result = getSplitCandidates([track], [], 20)
    expect(result).toEqual([])
  })
})
