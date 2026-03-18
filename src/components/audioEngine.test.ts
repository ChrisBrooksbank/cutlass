import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAudioRoutingGraph } from './audioEngine'

// ---------------------------------------------------------------------------
// Minimal AudioContext mock
// ---------------------------------------------------------------------------

function makeGainNode() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function makeMediaElementSource() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function makeAudioContext() {
  const destination = {}
  const context = {
    destination,
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => makeGainNode()),
    createMediaElementSource: vi.fn(() => makeMediaElementSource()),
  }
  return context
}

type MockContext = ReturnType<typeof makeAudioContext>

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAudioRoutingGraph', () => {
  let mockCtx: MockContext

  beforeEach(() => {
    mockCtx = makeAudioContext()
  })

  function makeGraph() {
    return createAudioRoutingGraph(() => mockCtx as unknown as AudioContext)
  }

  function makeElement() {
    return {} as HTMLMediaElement
  }

  it('exposes the AudioContext', () => {
    const graph = makeGraph()
    expect(graph.context).toBe(mockCtx)
  })

  it('connectTrack creates source and gain nodes wired together', () => {
    const graph = makeGraph()
    const el = makeElement()

    graph.connectTrack('t1', el)

    expect(mockCtx.createMediaElementSource).toHaveBeenCalledWith(el)
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1)

    // Source should connect to gain
    const source = mockCtx.createMediaElementSource.mock.results[0].value
    const gain = mockCtx.createGain.mock.results[0].value
    expect(source.connect).toHaveBeenCalledWith(gain)
    // Gain should connect to destination
    expect(gain.connect).toHaveBeenCalledWith(mockCtx.destination)
  })

  it('getGainNode returns the GainNode after connectTrack', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    const gainNode = graph.getGainNode('t1')
    expect(gainNode).toBeDefined()
    expect(gainNode).toBe(mockCtx.createGain.mock.results[0].value)
  })

  it('getGainNode returns undefined for unknown trackId', () => {
    const graph = makeGraph()
    expect(graph.getGainNode('unknown')).toBeUndefined()
  })

  it('setGain updates gain.gain.value', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    graph.setGain('t1', 0.5)

    const gainNode = mockCtx.createGain.mock.results[0].value
    expect(gainNode.gain.value).toBe(0.5)
  })

  it('setGain is a no-op for unconnected tracks', () => {
    const graph = makeGraph()
    // Should not throw
    expect(() => graph.setGain('ghost', 0.5)).not.toThrow()
  })

  it('disconnectTrack removes nodes and disconnects them', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    const source = mockCtx.createMediaElementSource.mock.results[0].value
    const gain = mockCtx.createGain.mock.results[0].value

    graph.disconnectTrack('t1')

    expect(source.disconnect).toHaveBeenCalled()
    expect(gain.disconnect).toHaveBeenCalled()
    expect(graph.getGainNode('t1')).toBeUndefined()
  })

  it('disconnectTrack is a no-op for unconnected tracks', () => {
    const graph = makeGraph()
    expect(() => graph.disconnectTrack('ghost')).not.toThrow()
  })

  it('connectTrack replaces previous nodes when called twice for same track', () => {
    const graph = makeGraph()
    const el1 = makeElement()
    const el2 = makeElement()

    graph.connectTrack('t1', el1)

    const source1 = mockCtx.createMediaElementSource.mock.results[0].value
    const gain1 = mockCtx.createGain.mock.results[0].value

    graph.connectTrack('t1', el2)

    // Old nodes should be disconnected
    expect(source1.disconnect).toHaveBeenCalled()
    expect(gain1.disconnect).toHaveBeenCalled()

    // New nodes created
    expect(mockCtx.createMediaElementSource).toHaveBeenCalledTimes(2)
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2)

    // getGainNode returns the new gain
    const gain2 = mockCtx.createGain.mock.results[1].value
    expect(graph.getGainNode('t1')).toBe(gain2)
  })

  it('dispose disconnects all tracks and closes the context', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())
    graph.connectTrack('t2', makeElement())

    const sources = mockCtx.createMediaElementSource.mock.results.map((r) => r.value)
    const gains = mockCtx.createGain.mock.results.map((r) => r.value)

    graph.dispose()

    for (const s of sources) expect(s.disconnect).toHaveBeenCalled()
    for (const g of gains) expect(g.disconnect).toHaveBeenCalled()
    expect(mockCtx.close).toHaveBeenCalled()

    // All tracks should be gone after dispose
    expect(graph.getGainNode('t1')).toBeUndefined()
    expect(graph.getGainNode('t2')).toBeUndefined()
  })

  it('supports multiple independent tracks', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())
    graph.connectTrack('t2', makeElement())

    graph.setGain('t1', 0.3)
    graph.setGain('t2', 0.8)

    const [gain1, gain2] = mockCtx.createGain.mock.results.map((r) => r.value)
    expect(gain1.gain.value).toBe(0.3)
    expect(gain2.gain.value).toBe(0.8)
  })
})
