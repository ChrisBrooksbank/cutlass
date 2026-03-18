import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAudioRoutingGraph } from './audioEngine'

// ---------------------------------------------------------------------------
// Minimal AudioContext mock
// ---------------------------------------------------------------------------

function makeAnalyserNode() {
  return {
    fftSize: 2048,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  }
}

function makeGainNode() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function makeBiquadFilterNode() {
  return {
    type: 'allpass' as BiquadFilterType,
    frequency: { value: 0 },
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
    createAnalyser: vi.fn(() => makeAnalyserNode()),
    createBiquadFilter: vi.fn(() => makeBiquadFilterNode()),
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

  it('connectTrack creates source, filter, gain, and analyser nodes wired together', () => {
    const graph = makeGraph()
    const el = makeElement()

    graph.connectTrack('t1', el)

    expect(mockCtx.createMediaElementSource).toHaveBeenCalledWith(el)
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1)
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1)
    expect(mockCtx.createAnalyser).toHaveBeenCalledTimes(1)

    const source = mockCtx.createMediaElementSource.mock.results[0].value
    const filter = mockCtx.createBiquadFilter.mock.results[0].value
    const gain = mockCtx.createGain.mock.results[0].value
    const analyser = mockCtx.createAnalyser.mock.results[0].value

    // Signal chain: source → filter → gain → analyser → destination
    expect(source.connect).toHaveBeenCalledWith(filter)
    expect(filter.connect).toHaveBeenCalledWith(gain)
    expect(gain.connect).toHaveBeenCalledWith(analyser)
    expect(analyser.connect).toHaveBeenCalledWith(mockCtx.destination)
  })

  it('connectTrack initialises filter as allpass (disabled) at 80 Hz', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    const filter = mockCtx.createBiquadFilter.mock.results[0].value
    expect(filter.type).toBe('allpass')
    expect(filter.frequency.value).toBe(80)
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

  it('getAnalyserNode returns the AnalyserNode after connectTrack', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    const analyserNode = graph.getAnalyserNode('t1')
    expect(analyserNode).toBeDefined()
    expect(analyserNode).toBe(mockCtx.createAnalyser.mock.results[0].value)
  })

  it('getAnalyserNode returns undefined for unknown trackId', () => {
    const graph = makeGraph()
    expect(graph.getAnalyserNode('unknown')).toBeUndefined()
  })

  it('getFilterNode returns the BiquadFilterNode after connectTrack', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    const filterNode = graph.getFilterNode('t1')
    expect(filterNode).toBeDefined()
    expect(filterNode).toBe(mockCtx.createBiquadFilter.mock.results[0].value)
  })

  it('getFilterNode returns undefined for unknown trackId', () => {
    const graph = makeGraph()
    expect(graph.getFilterNode('unknown')).toBeUndefined()
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

  it('setNoiseReduction enables highpass filter', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    graph.setNoiseReduction('t1', true)

    const filter = mockCtx.createBiquadFilter.mock.results[0].value
    expect(filter.type).toBe('highpass')
  })

  it('setNoiseReduction disables filter by switching to allpass', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    graph.setNoiseReduction('t1', true)
    graph.setNoiseReduction('t1', false)

    const filter = mockCtx.createBiquadFilter.mock.results[0].value
    expect(filter.type).toBe('allpass')
  })

  it('setNoiseReduction is a no-op for unconnected tracks', () => {
    const graph = makeGraph()
    expect(() => graph.setNoiseReduction('ghost', true)).not.toThrow()
  })

  it('disconnectTrack removes nodes and disconnects them', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())

    const source = mockCtx.createMediaElementSource.mock.results[0].value
    const filter = mockCtx.createBiquadFilter.mock.results[0].value
    const gain = mockCtx.createGain.mock.results[0].value
    const analyser = mockCtx.createAnalyser.mock.results[0].value

    graph.disconnectTrack('t1')

    expect(source.disconnect).toHaveBeenCalled()
    expect(filter.disconnect).toHaveBeenCalled()
    expect(gain.disconnect).toHaveBeenCalled()
    expect(analyser.disconnect).toHaveBeenCalled()
    expect(graph.getGainNode('t1')).toBeUndefined()
    expect(graph.getAnalyserNode('t1')).toBeUndefined()
    expect(graph.getFilterNode('t1')).toBeUndefined()
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
    const filter1 = mockCtx.createBiquadFilter.mock.results[0].value
    const gain1 = mockCtx.createGain.mock.results[0].value
    const analyser1 = mockCtx.createAnalyser.mock.results[0].value

    graph.connectTrack('t1', el2)

    // Old nodes should be disconnected
    expect(source1.disconnect).toHaveBeenCalled()
    expect(filter1.disconnect).toHaveBeenCalled()
    expect(gain1.disconnect).toHaveBeenCalled()
    expect(analyser1.disconnect).toHaveBeenCalled()

    // New nodes created
    expect(mockCtx.createMediaElementSource).toHaveBeenCalledTimes(2)
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(2)
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2)
    expect(mockCtx.createAnalyser).toHaveBeenCalledTimes(2)

    // getGainNode and getAnalyserNode return the new nodes
    const gain2 = mockCtx.createGain.mock.results[1].value
    const analyser2 = mockCtx.createAnalyser.mock.results[1].value
    expect(graph.getGainNode('t1')).toBe(gain2)
    expect(graph.getAnalyserNode('t1')).toBe(analyser2)
  })

  it('dispose disconnects all tracks and closes the context', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())
    graph.connectTrack('t2', makeElement())

    const sources = mockCtx.createMediaElementSource.mock.results.map((r) => r.value)
    const filters = mockCtx.createBiquadFilter.mock.results.map((r) => r.value)
    const gains = mockCtx.createGain.mock.results.map((r) => r.value)
    const analysers = mockCtx.createAnalyser.mock.results.map((r) => r.value)

    graph.dispose()

    for (const s of sources) expect(s.disconnect).toHaveBeenCalled()
    for (const f of filters) expect(f.disconnect).toHaveBeenCalled()
    for (const g of gains) expect(g.disconnect).toHaveBeenCalled()
    for (const a of analysers) expect(a.disconnect).toHaveBeenCalled()
    expect(mockCtx.close).toHaveBeenCalled()

    // All tracks should be gone after dispose
    expect(graph.getGainNode('t1')).toBeUndefined()
    expect(graph.getGainNode('t2')).toBeUndefined()
    expect(graph.getAnalyserNode('t1')).toBeUndefined()
    expect(graph.getAnalyserNode('t2')).toBeUndefined()
    expect(graph.getFilterNode('t1')).toBeUndefined()
    expect(graph.getFilterNode('t2')).toBeUndefined()
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

  it('noise reduction can be toggled independently per track', () => {
    const graph = makeGraph()
    graph.connectTrack('t1', makeElement())
    graph.connectTrack('t2', makeElement())

    graph.setNoiseReduction('t1', true)
    graph.setNoiseReduction('t2', false)

    const [filter1, filter2] = mockCtx.createBiquadFilter.mock.results.map((r) => r.value)
    expect(filter1.type).toBe('highpass')
    expect(filter2.type).toBe('allpass')
  })
})
