import { useRef, useCallback, useEffect, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import { useEditorStore } from '@/store'
import { zoomAroundPoint } from './timelineUtils'

export const TRACK_HEADER_WIDTH = 160

export default function TimelinePanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 200 })

  const pixelsPerSecond = useEditorStore((s) => s.ui.pixelsPerSecond)
  const scrollLeft = useEditorStore((s) => s.ui.scrollLeft)
  const setPixelsPerSecond = useEditorStore((s) => s.setPixelsPerSecond)
  const setScrollLeft = useEditorStore((s) => s.setScrollLeft)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Zoom around the cursor's horizontal position
        const scaleFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1
        const focalPx = e.nativeEvent.offsetX - TRACK_HEADER_WIDTH
        const result = zoomAroundPoint(pixelsPerSecond, scrollLeft, focalPx, scaleFactor)
        setPixelsPerSecond(result.pps)
        setScrollLeft(result.scrollLeft)
      } else {
        // Pan: prefer horizontal delta, fall back to vertical
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY
        setScrollLeft(Math.max(0, scrollLeft + delta))
      }
    },
    [pixelsPerSecond, scrollLeft, setPixelsPerSecond, setScrollLeft],
  )

  return (
    <div className="panel timeline-panel">
      <div className="panel-header">Timeline</div>
      <div
        ref={containerRef}
        className="panel-body"
        onWheel={handleWheel}
        style={{ overflow: 'hidden' }}
      >
        <Stage width={size.width} height={size.height}>
          <Layer />
        </Stage>
      </div>
    </div>
  )
}
