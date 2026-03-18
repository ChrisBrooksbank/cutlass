/**
 * Utility functions for VU (volume unit) meter level computation.
 *
 * All functions are pure and work with the byte data returned by
 * AnalyserNode.getByteTimeDomainData().
 */

/**
 * Compute the RMS (root-mean-square) level from a time-domain byte buffer.
 * The buffer uses the Web Audio API convention: 128 = silence, 0/255 = peak.
 * Returns a value in [0, 1] where 0 is silence and 1 is maximum amplitude.
 */
export function computeRms(data: Uint8Array): number {
  if (data.length === 0) return 0
  let sumOfSquares = 0
  for (let i = 0; i < data.length; i++) {
    // Normalize byte value to [-1, 1]
    const sample = (data[i] - 128) / 128
    sumOfSquares += sample * sample
  }
  return Math.sqrt(sumOfSquares / data.length)
}

/**
 * Convert a linear RMS value [0, 1] to decibels.
 * Returns -Infinity for rms = 0.
 */
export function rmsToDb(rms: number): number {
  if (rms <= 0) return -Infinity
  return 20 * Math.log10(rms)
}

/**
 * Clamp a dB value to a [minDb, maxDb] range.
 */
export function clampDb(db: number, minDb: number, maxDb: number): number {
  if (!isFinite(db)) return minDb
  return Math.min(maxDb, Math.max(minDb, db))
}

/**
 * Convert a clamped dB value to a fraction [0, 1] for display.
 * minDb maps to 0, maxDb maps to 1.
 */
export function dbToFraction(db: number, minDb: number, maxDb: number): number {
  if (maxDb <= minDb) return 0
  return (db - minDb) / (maxDb - minDb)
}

/**
 * Read the current RMS level from an AnalyserNode as a fraction [0, 1].
 * Convenience wrapper for use in animation frames.
 */
export function readAnalyserLevel(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(data)
  return computeRms(data)
}
