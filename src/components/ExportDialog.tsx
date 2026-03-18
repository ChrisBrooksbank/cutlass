import { useState, useCallback } from 'react'
import type { ExportFormat, ResolutionPreset } from '@/components/exportFormatUtils'
import { FORMAT_LABELS } from '@/components/exportFormatUtils'
import type { QualityPreset } from '@/components/exportDialogUtils'
import {
  QUALITY_PRESETS,
  estimateVideoFileSizeBytes,
  estimateGifFileSizeBytes,
  formatFileSize,
  getResolutionLabel,
  buildExportFilename,
} from '@/components/exportDialogUtils'
import { GIF_DEFAULT_FPS, GIF_DEFAULT_WIDTH } from '@/components/gifExportUtils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportDialogProps {
  /** Total project duration in seconds. */
  durationSec: number
  onClose: () => void
}

type ExportType = 'video' | 'gif'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const dialogStyle: React.CSSProperties = {
  background: '#242424',
  border: '1px solid #3a3a3a',
  borderRadius: 8,
  width: 420,
  maxWidth: '95vw',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  color: '#e0e0e0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#888',
  marginBottom: 6,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
}

const chipBase: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  border: '1px solid #3a3a3a',
  borderRadius: 4,
  cursor: 'pointer',
  background: '#1a1a1a',
  color: '#e0e0e0',
  fontSize: 13,
  textAlign: 'center' as const,
  transition: 'border-color 0.15s, background 0.15s',
}

const chipActiveStyle: React.CSSProperties = {
  ...chipBase,
  borderColor: '#60a5fa',
  background: '#1d3557',
  color: '#60a5fa',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a1a1a',
  border: '1px solid #3a3a3a',
  borderRadius: 4,
  color: '#e0e0e0',
  padding: '6px 8px',
  fontSize: 13,
}

const estimateBoxStyle: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #2e2e2e',
  borderRadius: 4,
  padding: '10px 14px',
  fontSize: 13,
  color: '#aaa',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const actionRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 4,
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '7px 18px',
  background: 'transparent',
  border: '1px solid #3a3a3a',
  borderRadius: 4,
  color: '#aaa',
  cursor: 'pointer',
  fontSize: 13,
}

const exportBtnStyle: React.CSSProperties = {
  padding: '7px 18px',
  background: '#2563eb',
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
}

const VIDEO_FORMATS: ExportFormat[] = ['mp4', 'webm']
const RESOLUTION_PRESETS: ResolutionPreset[] = ['1080p', '720p', '480p', 'custom']
const QUALITY_PRESET_KEYS: QualityPreset[] = ['high', 'medium', 'low']

export default function ExportDialog({ durationSec, onClose }: ExportDialogProps) {
  const [exportType, setExportType] = useState<ExportType>('video')
  const [format, setFormat] = useState<ExportFormat>('mp4')
  const [preset, setPreset] = useState<ResolutionPreset>('1080p')
  const [quality, setQuality] = useState<QualityPreset>('medium')
  const [customWidth, setCustomWidth] = useState(1920)
  const [customHeight, setCustomHeight] = useState(1080)
  const [gifFps, setGifFps] = useState(GIF_DEFAULT_FPS)
  const [gifWidth, setGifWidth] = useState(GIF_DEFAULT_WIDTH)

  const estimatedBytes =
    exportType === 'gif'
      ? estimateGifFileSizeBytes(durationSec, { fps: gifFps, width: gifWidth })
      : estimateVideoFileSizeBytes(durationSec, quality)

  const filename =
    exportType === 'gif' ? `export-${gifWidth}px.gif` : buildExportFilename(format, preset)

  const handleDownload = useCallback(() => {
    // Build a minimal placeholder blob download to demonstrate the trigger.
    // In a real implementation this would receive the encoded buffer from the
    // FFmpeg export pipeline.
    const mimeType =
      exportType === 'gif' ? 'image/gif' : format === 'mp4' ? 'video/mp4' : 'video/webm'
    const blob = new Blob([], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    onClose()
  }, [exportType, format, filename, onClose])

  function chip(label: string, active: boolean, onClick: () => void) {
    return (
      <button key={label} style={active ? chipActiveStyle : chipBase} onClick={onClick}>
        {label}
      </button>
    )
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Export</span>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
            onClick={onClose}
            aria-label="Close export dialog"
          >
            ×
          </button>
        </div>

        {/* Export type */}
        <div>
          <div style={sectionLabelStyle}>Type</div>
          <div style={rowStyle}>
            {chip('Video', exportType === 'video', () => setExportType('video'))}
            {chip('GIF', exportType === 'gif', () => setExportType('gif'))}
          </div>
        </div>

        {exportType === 'video' && (
          <>
            {/* Format */}
            <div>
              <div style={sectionLabelStyle}>Format</div>
              <div style={rowStyle}>
                {VIDEO_FORMATS.map((f) => chip(FORMAT_LABELS[f], format === f, () => setFormat(f)))}
              </div>
            </div>

            {/* Resolution */}
            <div>
              <div style={sectionLabelStyle}>Resolution</div>
              <div style={rowStyle}>
                {RESOLUTION_PRESETS.map((p) =>
                  chip(p.toUpperCase(), preset === p, () => setPreset(p)),
                )}
              </div>
              {preset !== 'custom' && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                  {getResolutionLabel(preset)}
                </div>
              )}
              {preset === 'custom' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Width</div>
                    <input
                      type="number"
                      min={160}
                      max={7680}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Height</div>
                    <input
                      type="number"
                      min={90}
                      max={4320}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quality */}
            <div>
              <div style={sectionLabelStyle}>Quality</div>
              <div style={rowStyle}>
                {QUALITY_PRESET_KEYS.map((q) =>
                  chip(QUALITY_PRESETS[q].label, quality === q, () => setQuality(q)),
                )}
              </div>
            </div>
          </>
        )}

        {exportType === 'gif' && (
          <>
            {/* GIF width */}
            <div>
              <div style={sectionLabelStyle}>Width (px)</div>
              <input
                type="number"
                min={120}
                max={1920}
                value={gifWidth}
                onChange={(e) => setGifWidth(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            {/* GIF fps */}
            <div>
              <div style={sectionLabelStyle}>Frame Rate (fps)</div>
              <div style={rowStyle}>
                {[10, 15, 24].map((fps) => chip(`${fps}`, gifFps === fps, () => setGifFps(fps)))}
              </div>
            </div>
          </>
        )}

        {/* Estimated file size */}
        <div style={estimateBoxStyle}>
          <span>Estimated size</span>
          <span style={{ color: '#e0e0e0', fontWeight: 600 }}>
            {durationSec > 0 ? formatFileSize(estimatedBytes) : '—'}
          </span>
        </div>

        {/* Actions */}
        <div style={actionRowStyle}>
          <button style={cancelBtnStyle} onClick={onClose}>
            Cancel
          </button>
          <button style={exportBtnStyle} onClick={handleDownload}>
            Download {filename}
          </button>
        </div>
      </div>
    </div>
  )
}
