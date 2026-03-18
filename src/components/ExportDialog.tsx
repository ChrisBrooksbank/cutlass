import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import type { ExportFormat, ResolutionPreset } from '@/components/exportFormatUtils'
import {
  FORMAT_LABELS,
  RESOLUTION_PRESETS as RESOLUTION_PRESET_VALUES,
  getFormatCodecArgs,
  getFormatMimeType,
} from '@/components/exportFormatUtils'
import type { QualityPreset } from '@/components/exportDialogUtils'
import {
  QUALITY_PRESETS,
  estimateVideoFileSizeBytes,
  estimateGifFileSizeBytes,
  formatFileSize,
  getResolutionLabel,
  buildExportFilename,
} from '@/components/exportDialogUtils'
import {
  GIF_DEFAULT_FPS,
  GIF_DEFAULT_WIDTH,
  buildGifPalettegenArgs,
  buildGifPaletteUseArgs,
} from '@/components/gifExportUtils'
import type { GifExportSettings } from '@/components/gifExportUtils'
import { loadFFmpeg } from '@/components/ffmpegLoader'
import { buildFFmpegArgs, collectInputs, findOrphanedClips } from '@/components/filterGraphUtils'
import { progressRatioToPercent } from '@/components/exportProgressUtils'
import { getEffectHandler } from '@/components/effectRegistry'
import { useEditorStore } from '@/store'
import { fetchFile } from '@ffmpeg/util'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportDialogProps {
  /** Total project duration in seconds. */
  durationSec: number
  onClose: () => void
}

type ExportType = 'video' | 'gif'
type ExportStatus = 'idle' | 'loading' | 'exporting' | 'done' | 'error'

// ---------------------------------------------------------------------------
// Canvas-only effect detection
// ---------------------------------------------------------------------------

const CANVAS_ONLY_EFFECTS = new Set(['cursor', 'shape-circle', 'shape-arrow', 'blur'])

function detectCanvasOnlyEffects(project: { tracks: { clips: { effects: { type: string }[] }[] }[] }): string[] {
  const found = new Set<string>()
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      for (const effect of clip.effects) {
        const handler = getEffectHandler(effect.type)
        if (CANVAS_ONLY_EFFECTS.has(effect.type) || (handler && handler.toFFmpegFilter(effect as never, { clipIndex: 0, width: 0, height: 0, fps: 0 }) === null)) {
          found.add(handler?.displayName ?? effect.type)
        }
      }
    }
  }
  return [...found]
}

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

const progressBarOuter: React.CSSProperties = {
  width: '100%',
  height: 6,
  background: '#1a1a1a',
  borderRadius: 3,
  overflow: 'hidden',
}

const warningBoxStyle: React.CSSProperties = {
  background: '#2a2000',
  border: '1px solid #6b5b00',
  borderRadius: 4,
  padding: '8px 12px',
  fontSize: 12,
  color: '#e0c040',
}

const errorBoxStyle: React.CSSProperties = {
  background: '#2a0000',
  border: '1px solid #6b0000',
  borderRadius: 4,
  padding: '8px 12px',
  fontSize: 12,
  color: '#ff6060',
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

  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortRef = useRef(false)
  const ffmpegRef = useRef<Awaited<ReturnType<typeof loadFFmpeg>> | null>(null)

  const project = useEditorStore((s) => s.project)

  // Cleanup FFmpeg worker on unmount (bug fix: prevents leaked workers/WASM memory)
  useEffect(() => {
    return () => {
      abortRef.current = true
      if (ffmpegRef.current) {
        try {
          ffmpegRef.current.terminate()
        } catch {
          // Already terminated
        }
        ffmpegRef.current = null
      }
    }
  }, [])

  const canvasOnlyEffects = useMemo(() => detectCanvasOnlyEffects(project), [project])
  const orphanedClips = useMemo(() => findOrphanedClips(project), [project])

  const estimatedBytes =
    exportType === 'gif'
      ? estimateGifFileSizeBytes(durationSec, { fps: gifFps, width: gifWidth })
      : estimateVideoFileSizeBytes(durationSec, quality)

  const filename =
    exportType === 'gif' ? `export-${gifWidth}px.gif` : buildExportFilename(format, preset)

  const isExporting = exportStatus === 'loading' || exportStatus === 'exporting'

  const handleDownload = useCallback(async () => {
    abortRef.current = false
    setExportStatus('loading')
    setProgress(0)
    setErrorMessage(null)

    try {
      // Load FFmpeg
      const ffmpeg = await loadFFmpeg({
        onProgress: (event) => {
          if (!abortRef.current) {
            setProgress(progressRatioToPercent(event.progress))
          }
        },
      })

      ffmpegRef.current = ffmpeg

      if (abortRef.current) return

      setExportStatus('exporting')

      // Write source media files to FFmpeg's virtual FS
      const inputs = collectInputs(project)
      for (let i = 0; i < inputs.length; i++) {
        const inputName = `input${i}${getExtFromUrl(inputs[i].url)}`
        const data = await fetchFile(inputs[i].url)
        await ffmpeg.writeFile(inputName, data)
      }

      if (abortRef.current) return

      if (exportType === 'gif') {
        // GIF two-pass pipeline
        const gifSettings: GifExportSettings = {
          fps: gifFps,
          width: gifWidth,
          duration: durationSec > 0 ? durationSec : undefined,
        }

        // Pass 1: palettegen
        const paletteArgs = [
          ...inputs.flatMap((_, i) => ['-i', `input${i}${getExtFromUrl(inputs[i].url)}`]),
          ...buildGifPalettegenArgs(gifSettings, inputs.length),
          'palette.png',
        ]
        await ffmpeg.exec(paletteArgs)

        if (abortRef.current) return

        // Pass 2: paletteuse — palette.png is the last input (index = inputs.length)
        const paletteInputIndex = inputs.length
        const gifArgs = [
          ...inputs.flatMap((_, i) => ['-i', `input${i}${getExtFromUrl(inputs[i].url)}`]),
          '-i', 'palette.png',
          ...buildGifPaletteUseArgs(gifSettings, paletteInputIndex),
          'output.gif',
        ]
        await ffmpeg.exec(gifArgs)

        if (abortRef.current) return

        const outputData = await ffmpeg.readFile('output.gif')
        const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: 'image/gif' })
        triggerDownload(blob, filename)
      } else {
        // Video export (MP4/WebM)
        const ffmpegArgs = buildFFmpegArgs(project)

        // Build the full command
        const args: string[] = []

        // Input files
        for (let i = 0; i < inputs.length; i++) {
          args.push('-i', `input${i}${getExtFromUrl(inputs[i].url)}`)
        }

        // Scale to target resolution
        const targetRes =
          preset === 'custom'
            ? { width: customWidth, height: customHeight }
            : RESOLUTION_PRESET_VALUES[preset]
        const scaleFilter = `scale=${targetRes.width}:${targetRes.height}`

        // When a filter_complex is present, appending -vf would conflict.
        // Instead, fold the scale into the filter graph as an extra stage.
        if (ffmpegArgs.filterComplex) {
          // videoMap is e.g. "[vout]" or "[vpos_xxx_0]"
          const mapLabel = ffmpegArgs.videoMap.replace(/^\[|\]$/g, '')
          const scaledLabel = `${mapLabel}_scaled`
          const extendedFC = `${ffmpegArgs.filterComplex};[${mapLabel}]${scaleFilter}[${scaledLabel}]`
          args.push('-filter_complex', extendedFC)
          args.push('-map', `[${scaledLabel}]`)
        } else {
          // Simple single-input: use -vf directly
          if (ffmpegArgs.videoMap) {
            args.push('-map', ffmpegArgs.videoMap)
          }
          args.push('-vf', scaleFilter)
        }

        // Map audio output
        if (ffmpegArgs.audioMap) {
          args.push('-map', ffmpegArgs.audioMap)
        }

        // Codec args with quality preset CRF
        const qp = QUALITY_PRESETS[quality]
        const codecArgs = getFormatCodecArgs(format, qp.crfH264, qp.crfVP9)
        args.push(...codecArgs)

        // Duration limit
        if (durationSec > 0) {
          args.push('-t', String(durationSec))
        }

        const outputFilename = `output.${format}`
        args.push('-y', outputFilename)

        await ffmpeg.exec(args)

        if (abortRef.current) return

        const outputData = await ffmpeg.readFile(outputFilename)
        const mimeType = getFormatMimeType(format)
        const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: mimeType })
        triggerDownload(blob, filename)
      }

      setExportStatus('done')
      setProgress(100)
    } catch (err) {
      if (abortRef.current) return
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(msg)
      setExportStatus('error')
    } finally {
      // Terminate FFmpeg worker + free ~32MB WASM memory after every export
      if (ffmpegRef.current) {
        try {
          ffmpegRef.current.terminate()
        } catch {
          // Already terminated
        }
        ffmpegRef.current = null
      }
    }
  }, [exportType, format, filename, project, durationSec, gifFps, gifWidth, quality, preset, customWidth, customHeight])

  const handleCancel = useCallback(() => {
    if (isExporting) {
      abortRef.current = true
      // Terminate the running FFmpeg process to free resources
      if (ffmpegRef.current) {
        try {
          ffmpegRef.current.terminate()
        } catch {
          // Already terminated
        }
        ffmpegRef.current = null
      }
      setExportStatus('idle')
      setProgress(0)
    } else {
      onClose()
    }
  }, [isExporting, onClose])

  function chip(label: string, active: boolean, onClick: () => void) {
    return (
      <button
        key={label}
        style={active ? chipActiveStyle : chipBase}
        onClick={onClick}
        disabled={isExporting}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={overlayStyle} onClick={isExporting ? undefined : onClose}>
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
            onClick={handleCancel}
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
                      disabled={isExporting}
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
                      disabled={isExporting}
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
                disabled={isExporting}
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

        {/* Orphaned clips warning */}
        {orphanedClips.length > 0 && (
          <div style={warningBoxStyle}>
            {orphanedClips.length} clip{orphanedClips.length > 1 ? 's' : ''} reference deleted
            media and will be skipped in the export.
          </div>
        )}

        {/* Canvas-only effect warning */}
        {canvasOnlyEffects.length > 0 && (
          <div style={warningBoxStyle}>
            The following effects are preview-only and will not appear in the export:{' '}
            {canvasOnlyEffects.join(', ')}
          </div>
        )}

        {/* Estimated file size */}
        <div style={estimateBoxStyle}>
          <span>Estimated size</span>
          <span style={{ color: '#e0e0e0', fontWeight: 600 }}>
            {durationSec > 0 ? formatFileSize(estimatedBytes) : '—'}
          </span>
        </div>

        {/* Progress bar */}
        {isExporting && (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              {exportStatus === 'loading' ? 'Loading FFmpeg...' : `Exporting... ${Math.round(progress)}%`}
            </div>
            <div style={progressBarOuter}>
              <div
                style={{
                  width: `${exportStatus === 'loading' ? 100 : progress}%`,
                  height: '100%',
                  background: '#2563eb',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                  animation: exportStatus === 'loading' ? 'pulse 1.5s infinite' : undefined,
                  opacity: exportStatus === 'loading' ? 0.5 : 1,
                }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {exportStatus === 'error' && errorMessage && (
          <div style={errorBoxStyle}>{errorMessage}</div>
        )}

        {/* Done message */}
        {exportStatus === 'done' && (
          <div style={{ fontSize: 13, color: '#60d060' }}>Export complete!</div>
        )}

        {/* Actions */}
        <div style={actionRowStyle}>
          <button style={cancelBtnStyle} onClick={handleCancel}>
            {isExporting ? 'Cancel' : 'Close'}
          </button>
          <button
            style={{
              ...exportBtnStyle,
              opacity: isExporting ? 0.6 : 1,
              cursor: isExporting ? 'not-allowed' : 'pointer',
            }}
            onClick={handleDownload}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : `Download ${filename}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExtFromUrl(url: string): string {
  // Blob URLs have no meaningful file extension — default to .webm since
  // all browser-recorded media (screen capture, voiceover) uses WebM.
  if (url.startsWith('blob:')) return '.webm'
  try {
    const pathname = new URL(url, 'http://localhost').pathname
    const ext = pathname.substring(pathname.lastIndexOf('.'))
    return ext || '.mp4'
  } catch {
    return '.mp4'
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
