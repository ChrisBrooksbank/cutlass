import { useEffect, useRef, useState } from 'react'
import { readAnalyserLevel, rmsToDb, clampDb, dbToFraction } from './vuMeterUtils'

const MIN_DB = -60
const MAX_DB = 0

/** Number of vertical segments in the bar display */
const SEGMENT_COUNT = 12

/** dB threshold above which segments are shown in yellow */
const YELLOW_THRESHOLD_DB = -12

/** dB threshold above which segments are shown in red */
const RED_THRESHOLD_DB = -3

function segmentColor(segmentDb: number): string {
  if (segmentDb >= RED_THRESHOLD_DB) return '#ef4444'
  if (segmentDb >= YELLOW_THRESHOLD_DB) return '#eab308'
  return '#22c55e'
}

interface VUMeterProps {
  /** The AnalyserNode to read levels from. When null/undefined, meter is inactive. */
  analyserNode?: AnalyserNode | null
  /** Width in pixels (default 6) */
  width?: number
  /** Height in pixels (default 40) */
  height?: number
}

/**
 * Visual VU meter that reads from a Web Audio API AnalyserNode.
 * Updates on every animation frame while an analyser node is connected.
 * Shows green/yellow/red segments representing the current audio level.
 */
export default function VUMeter({ analyserNode, width = 6, height = 40 }: VUMeterProps) {
  const [fraction, setFraction] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!analyserNode) return

    const tick = () => {
      const rms = readAnalyserLevel(analyserNode)
      const db = rmsToDb(rms)
      const clamped = clampDb(db, MIN_DB, MAX_DB)
      setFraction(dbToFraction(clamped, MIN_DB, MAX_DB))
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setFraction(0)
    }
  }, [analyserNode])

  return (
    <div
      aria-label="VU meter"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 1,
        flexShrink: 0,
      }}
    >
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
        // i=0 is the bottom (quietest), i=SEGMENT_COUNT-1 is the top (loudest)
        const segmentFraction = i / SEGMENT_COUNT
        const segmentDb = MIN_DB + segmentFraction * (MAX_DB - MIN_DB)
        const active = fraction > segmentFraction
        return (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 1,
              background: active ? segmentColor(segmentDb) : '#1f2937',
              transition: active ? 'none' : 'background 0.1s',
            }}
          />
        )
      })}
    </div>
  )
}
