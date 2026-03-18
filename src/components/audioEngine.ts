/**
 * Web Audio API routing graph.
 *
 * Each audio-producing track gets its own GainNode connected to the
 * AudioContext destination:
 *
 *   HTMLMediaElement → MediaElementSourceNode → GainNode → destination
 *
 * This allows per-track volume and mute control.
 */

export interface TrackAudioNodes {
  source: MediaElementAudioSourceNode
  gain: GainNode
  analyser: AnalyserNode
}

export interface AudioRoutingGraph {
  /** The underlying AudioContext. */
  readonly context: AudioContext

  /**
   * Connect an HTMLMediaElement to the routing graph for the given track.
   * Creates a MediaElementSourceNode and GainNode if not already present.
   * If the track was already connected with a different element, it is
   * disconnected first.
   */
  connectTrack(trackId: string, element: HTMLMediaElement): void

  /**
   * Disconnect and destroy nodes for the given track.
   * No-op if the track was never connected.
   */
  disconnectTrack(trackId: string): void

  /**
   * Set the gain (volume) for a track in the range [0, 1].
   * No-op if the track is not connected.
   */
  setGain(trackId: string, gain: number): void

  /**
   * Get the GainNode for a connected track, or undefined if not connected.
   */
  getGainNode(trackId: string): GainNode | undefined

  /**
   * Get the AnalyserNode for a connected track, or undefined if not connected.
   * The AnalyserNode sits after the GainNode and can be used for VU metering.
   */
  getAnalyserNode(trackId: string): AnalyserNode | undefined

  /**
   * Disconnect all tracks and close the AudioContext.
   */
  dispose(): void
}

/**
 * Create a new AudioRoutingGraph backed by a fresh AudioContext.
 *
 * @param contextFactory - optional factory used to inject a mock AudioContext
 *   in tests (defaults to `new AudioContext()`).
 */
export function createAudioRoutingGraph(
  contextFactory: () => AudioContext = () => new AudioContext(),
): AudioRoutingGraph {
  const context = contextFactory()
  const trackNodes = new Map<string, TrackAudioNodes>()

  return {
    get context() {
      return context
    },

    connectTrack(trackId: string, element: HTMLMediaElement): void {
      // Disconnect existing nodes for this track if any
      const existing = trackNodes.get(trackId)
      if (existing) {
        existing.source.disconnect()
        existing.gain.disconnect()
        existing.analyser.disconnect()
        trackNodes.delete(trackId)
      }

      const source = context.createMediaElementSource(element)
      const gain = context.createGain()
      const analyser = context.createAnalyser()
      analyser.fftSize = 256

      source.connect(gain)
      gain.connect(analyser)
      analyser.connect(context.destination)

      trackNodes.set(trackId, { source, gain, analyser })
    },

    disconnectTrack(trackId: string): void {
      const nodes = trackNodes.get(trackId)
      if (!nodes) return

      nodes.source.disconnect()
      nodes.gain.disconnect()
      nodes.analyser.disconnect()
      trackNodes.delete(trackId)
    },

    setGain(trackId: string, gain: number): void {
      const nodes = trackNodes.get(trackId)
      if (!nodes) return
      nodes.gain.gain.value = gain
    },

    getGainNode(trackId: string): GainNode | undefined {
      return trackNodes.get(trackId)?.gain
    },

    getAnalyserNode(trackId: string): AnalyserNode | undefined {
      return trackNodes.get(trackId)?.analyser
    },

    dispose(): void {
      for (const nodes of trackNodes.values()) {
        nodes.source.disconnect()
        nodes.gain.disconnect()
        nodes.analyser.disconnect()
      }
      trackNodes.clear()
      void context.close()
    },
  }
}
