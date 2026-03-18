import { describe, it, expect, vi } from 'vitest'
import { computeEffectiveGain, applyTrackGain } from './trackVolumeUtils'
import type { AudioRoutingGraph } from './audioEngine'

// ---------------------------------------------------------------------------
// computeEffectiveGain
// ---------------------------------------------------------------------------

describe('computeEffectiveGain', () => {
  it('returns volume when not muted', () => {
    expect(computeEffectiveGain(0.8, false)).toBe(0.8)
  })

  it('returns 0 when muted regardless of volume', () => {
    expect(computeEffectiveGain(0.8, true)).toBe(0)
    expect(computeEffectiveGain(1, true)).toBe(0)
    expect(computeEffectiveGain(0, true)).toBe(0)
  })

  it('clamps volume above 1 to 1', () => {
    expect(computeEffectiveGain(1.5, false)).toBe(1)
  })

  it('clamps volume below 0 to 0', () => {
    expect(computeEffectiveGain(-0.2, false)).toBe(0)
  })

  it('returns 0 for volume 0 when not muted', () => {
    expect(computeEffectiveGain(0, false)).toBe(0)
  })

  it('returns 1 for volume 1 when not muted', () => {
    expect(computeEffectiveGain(1, false)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// applyTrackGain
// ---------------------------------------------------------------------------

describe('applyTrackGain', () => {
  function makeGraph(): AudioRoutingGraph & { setGain: ReturnType<typeof vi.fn> } {
    return {
      context: {} as AudioContext,
      connectTrack: vi.fn(),
      disconnectTrack: vi.fn(),
      setGain: vi.fn(),
      getGainNode: vi.fn(),
      dispose: vi.fn(),
    }
  }

  it('calls graph.setGain with effective gain (not muted)', () => {
    const graph = makeGraph()
    applyTrackGain(graph, 't1', 0.6, false)
    expect(graph.setGain).toHaveBeenCalledWith('t1', 0.6)
  })

  it('calls graph.setGain with 0 when muted', () => {
    const graph = makeGraph()
    applyTrackGain(graph, 't1', 0.9, true)
    expect(graph.setGain).toHaveBeenCalledWith('t1', 0)
  })

  it('passes the correct trackId to graph.setGain', () => {
    const graph = makeGraph()
    applyTrackGain(graph, 'track-abc', 0.5, false)
    expect(graph.setGain).toHaveBeenCalledWith('track-abc', 0.5)
  })
})
