/**
 * Audio waveform extraction from audio assets via Web Audio API decodeAudioData.
 * Results are cached in-memory keyed on `url@samples` to avoid redundant decoding.
 */

const cache = new Map<string, Float32Array>()

/**
 * Extract a downsampled amplitude envelope from an audio URL.
 * Returns a Float32Array of `samples` RMS amplitude values in [0, 1].
 * Results are cached keyed on `url@samples`.
 *
 * @param url            - Object URL or any URL the browser can load as audio
 * @param samples        - Number of amplitude samples to return (default 200)
 * @param contextFactory - Optional factory to inject a mock AudioContext in tests
 */
export async function extractAudioWaveform(
  url: string,
  samples = 200,
  contextFactory: () => AudioContext = () => new AudioContext(),
): Promise<Float32Array> {
  const key = `${url}@${samples}`
  if (cache.has(key)) return cache.get(key)!

  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const context = contextFactory()
  const audioBuffer = await context.decodeAudioData(arrayBuffer)

  // Mix down to mono by averaging all channels
  const channels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const mono = new Float32Array(length)
  for (let c = 0; c < channels; c++) {
    const channelData = audioBuffer.getChannelData(c)
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / channels
    }
  }

  // Downsample to `samples` values using RMS per block
  const blockSize = Math.max(1, Math.floor(length / samples))
  const waveform = new Float32Array(samples)
  for (let s = 0; s < samples; s++) {
    const start = s * blockSize
    const end = Math.min(start + blockSize, length)
    if (start >= length) break
    let sum = 0
    for (let i = start; i < end; i++) {
      sum += mono[i] * mono[i]
    }
    waveform[s] = Math.sqrt(sum / (end - start))
  }

  cache.set(key, waveform)
  return waveform
}

/**
 * Compute Konva Line points for a symmetric waveform shape.
 * Returns a flat [x0,y0, x1,y1, ...] array suitable for a closed Konva Line.
 *
 * @param data   - Float32Array of amplitude values in [0, 1]
 * @param width  - Available width in pixels
 * @param height - Available height in pixels
 */
export function computeWaveformPoints(data: Float32Array, width: number, height: number): number[] {
  const n = data.length
  if (n === 0 || width <= 0 || height <= 0) return []

  const midY = height / 2
  const halfH = height * 0.42
  const points: number[] = []

  // Top envelope: left → right
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * width
    points.push(x, midY - data[i] * halfH)
  }

  // Bottom envelope: right → left (closing the polygon)
  for (let i = n - 1; i >= 0; i--) {
    const x = (i / (n - 1)) * width
    points.push(x, midY + data[i] * halfH)
  }

  return points
}

/** Clear the waveform cache (useful in tests). */
export function clearWaveformCache(): void {
  cache.clear()
}

/** Return how many entries are in the cache (useful in tests). */
export function waveformCacheSize(): number {
  return cache.size
}
