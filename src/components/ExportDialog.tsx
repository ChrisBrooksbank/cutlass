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
import type { GifExportSettings, GifFilterGraphContext } from '@/components/gifExportUtils'
import { loadFFmpeg } from '@/components/ffmpegLoader'
import {
  buildFFmpegArgs,
  collectInputs,
  findOrphanedClips,
  ensureEven,
} from '@/components/filterGraphUtils'
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

function detectCanvasOnlyEffects(project: {
  tracks: { clips: { effects: { type: string }[] }[] }[]
}): string[] {
  const found = new Set<string>()
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      for (const effect of clip.effects) {
        const handler = getEffectHandler(effect.type)
        if (
          CANVAS_ONLY_EFFECTS.has(effect.type) ||
          (handler &&
            handler.toFFmpegFilter(effect as never, {
              clipIndex: 0,
              width: 0,
              height: 0,
              fps: 0,
            }) === null)
        ) {
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
  border: '1px solid #60a5fa',
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
  const [exportPhase, setExportPhase] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [frameCount, setFrameCount] = useState<number | null>(null)
  const [ffmpegCommands, setFfmpegCommands] = useState<{ label: string; cmd: string }[]>([])
  const [showCommands, setShowCommands] = useState(false)
  const abortRef = useRef(false)
  const ffmpegRef = useRef<Awaited<ReturnType<typeof loadFFmpeg>> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const project = useEditorStore((s) => s.project)

  // Cleanup FFmpeg worker and elapsed timer on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current)
        elapsedTimerRef.current = null
      }
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
    setExportPhase('Loading FFmpeg...')
    setElapsedSec(0)
    setFrameCount(null)
    setFfmpegCommands([])
    setShowCommands(false)

    // Start elapsed timer
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    elapsedTimerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000)

    try {
      // Capture FFmpeg log lines so we can surface meaningful errors
      const ffmpegLogs: string[] = []

      // Load FFmpeg
      const ffmpeg = await loadFFmpeg({
        onLog: (event) => {
          if (ffmpegLogs.length > 500) ffmpegLogs.splice(0, ffmpegLogs.length - 500)
          ffmpegLogs.push(event.message)
          // Parse frame count from FFmpeg output
          const frameMatch = event.message.match(/frame=\s*(\d+)/)
          if (frameMatch) {
            setFrameCount(Number(frameMatch[1]))
          }
        },
        onProgress: (event) => {
          if (!abortRef.current) {
            setProgress(progressRatioToPercent(event.progress))
          }
        },
      })

      ffmpegRef.current = ffmpeg

      if (abortRef.current) return

      setExportStatus('exporting')
      setExportPhase('Writing input files...')

      // Write source media files to FFmpeg's virtual FS
      const inputs = collectInputs(project)
      const inputFilenames = inputs.map((input, i) => `input${i}${getExtFromInput(input)}`)

      if (inputs.length === 0) {
        throw new Error(
          'No valid media clips to export. Add media to your project before exporting.',
        )
      }

      for (let i = 0; i < inputs.length; i++) {
        const data = await fetchFile(inputs[i].url)
        await ffmpeg.writeFile(inputFilenames[i], data)
      }

      if (abortRef.current) return

      const capturedCommands: { label: string; cmd: string }[] = []
      const inputArgs = inputs.flatMap((input, i) => {
        const filename = inputFilenames[i]
        if (input.type === 'image') {
          return ['-loop', '1', '-framerate', String(project.fps), '-i', filename]
        }
        return ['-i', filename]
      })

      if (exportType === 'gif') {
        // GIF two-pass pipeline
        const gifSettings: GifExportSettings = {
          fps: gifFps,
          width: gifWidth,
          duration: durationSec > 0 ? durationSec : undefined,
        }

        // Build project filter graph so GIF output matches the preview
        // (includes trim, speed, effects, transitions, multi-clip composition)
        const ffmpegArgs = buildFFmpegArgs(project, { skipAudio: true })
        const filterGraph: GifFilterGraphContext | undefined = ffmpegArgs.filterComplex
          ? { filterComplex: ffmpegArgs.filterComplex, videoMapLabel: ffmpegArgs.videoMap }
          : undefined

        // Pass 1: palettegen
        setExportPhase('Pass 1/2: Generating palette...')
        const paletteArgs = [
          ...inputArgs,
          ...buildGifPalettegenArgs(gifSettings, inputs.length, filterGraph),
          'palette.png',
        ]
        capturedCommands.push({
          label: 'Pass 1: palettegen',
          cmd: `ffmpeg ${paletteArgs.join(' ')}`,
        })
        setFfmpegCommands([...capturedCommands])

        const paletteExit = await ffmpeg.exec(paletteArgs)
        if (paletteExit !== 0) {
          throw new Error(
            'FFmpeg palettegen failed' +
              (ffmpegLogs.length ? ': ' + ffmpegLogs.slice(-5).join(' | ') : ''),
          )
        }

        if (abortRef.current) return

        // Pass 2: paletteuse — palette.png is the last input (index = inputs.length)
        setExportPhase('Pass 2/2: Encoding GIF...')
        const paletteInputIndex = inputs.length
        const gifArgs = [
          ...inputArgs,
          '-i',
          'palette.png',
          ...buildGifPaletteUseArgs(gifSettings, paletteInputIndex, filterGraph),
          'output.gif',
        ]
        capturedCommands.push({ label: 'Pass 2: paletteuse', cmd: `ffmpeg ${gifArgs.join(' ')}` })
        setFfmpegCommands([...capturedCommands])

        const gifExit = await ffmpeg.exec(gifArgs)
        if (gifExit !== 0) {
          throw new Error(
            'FFmpeg GIF export failed' +
              (ffmpegLogs.length ? ': ' + ffmpegLogs.slice(-5).join(' | ') : ''),
          )
        }

        if (abortRef.current) return

        setExportPhase('Finalizing...')
        const outputData = await ffmpeg.readFile('output.gif')
        if (!outputData || (outputData as Uint8Array).length === 0) {
          throw new Error('Export produced an empty file. Check that your media files are valid.')
        }
        const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: 'image/gif' })
        triggerDownload(blob, filename)
      } else {
        // Video export (MP4/WebM)
        const outputFilename = `output.${format}`

        // Target resolution for this export
        const targetRes =
          preset === 'custom'
            ? { width: ensureEven(customWidth), height: ensureEven(customHeight) }
            : RESOLUTION_PRESET_VALUES[preset]

        const buildVideoExportArgs = (skipAudio: boolean): string[] => {
          // Pass outputSize so buildFFmpegArgs scales clips directly to the export
          // resolution instead of intermediate project dimensions (e.g. 1920×1080).
          const ffmpegArgs = buildFFmpegArgs(project, { skipAudio, outputSize: targetRes })
          const a: string[] = []

          // Input files
          a.push(...inputArgs)

          // The filter_complex already scales clips to targetRes.
          // Just wire up the map labels without an extra scale stage.
          if (ffmpegArgs.filterComplex) {
            a.push('-filter_complex', ffmpegArgs.filterComplex)
            a.push('-map', ffmpegArgs.videoMap)
          } else {
            if (ffmpegArgs.videoMap) {
              a.push('-map', ffmpegArgs.videoMap)
            }
            // No filter_complex — apply scale via -vf
            a.push('-vf', `scale=${targetRes.width}:${targetRes.height}`)
          }

          // Map audio output
          if (ffmpegArgs.audioMap) {
            a.push('-map', ffmpegArgs.audioMap)
          }

          // Codec args with quality preset CRF
          const qp = QUALITY_PRESETS[quality]
          const codecArgs = getFormatCodecArgs(format, qp.crfH264, qp.crfVP9)
          if (ffmpegArgs.audioMap) {
            a.push(...codecArgs)
          } else {
            // No audio mapped — strip audio codec args (-c:a, -b:a, -c:a value, -b:a value)
            const AUDIO_ARG_KEYS = new Set(['-c:a', '-b:a'])
            for (let ai = 0; ai < codecArgs.length; ai++) {
              if (AUDIO_ARG_KEYS.has(codecArgs[ai])) {
                ai++ // skip value too
              } else {
                a.push(codecArgs[ai])
              }
            }
          }

          // Duration limit
          if (durationSec > 0) {
            a.push('-t', String(durationSec))
          }

          a.push('-y', outputFilename)
          return a
        }

        // Try with audio first; if it fails because an input lacks audio
        // streams, retry video-only.
        setExportPhase('Encoding video...')
        const firstArgs = buildVideoExportArgs(false)
        capturedCommands.push({ label: 'Video encode', cmd: `ffmpeg ${firstArgs.join(' ')}` })
        setFfmpegCommands([...capturedCommands])

        let videoExit = await ffmpeg.exec(firstArgs)
        if (videoExit !== 0) {
          const lastLogs = ffmpegLogs.slice(-10).join('\n')
          if (lastLogs.includes('matches no streams') || lastLogs.includes('does not contain')) {
            // Input(s) have no audio stream — retry without audio mapping
            const retryArgs = buildVideoExportArgs(true)
            capturedCommands.push({
              label: 'Video encode (retry, no audio)',
              cmd: `ffmpeg ${retryArgs.join(' ')}`,
            })
            setFfmpegCommands([...capturedCommands])
            videoExit = await ffmpeg.exec(retryArgs)
          }
        }

        if (videoExit !== 0) {
          throw new Error(
            'FFmpeg export failed' +
              (ffmpegLogs.length ? ': ' + ffmpegLogs.slice(-5).join(' | ') : ''),
          )
        }

        if (abortRef.current) return

        setExportPhase('Finalizing...')
        const outputData = await ffmpeg.readFile(outputFilename)
        if (!outputData || (outputData as Uint8Array).length === 0) {
          throw new Error('Export produced an empty file. Check that your media files are valid.')
        }
        const mimeType = getFormatMimeType(format)
        const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: mimeType })
        triggerDownload(blob, filename)
      }

      setExportStatus('done')
      setProgress(100)
      setExportPhase('')
    } catch (err) {
      if (abortRef.current) return
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(msg)
      setExportStatus('error')
    } finally {
      // Clear elapsed timer
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current)
        elapsedTimerRef.current = null
      }
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
  }, [
    exportType,
    format,
    filename,
    project,
    durationSec,
    gifFps,
    gifWidth,
    quality,
    preset,
    customWidth,
    customHeight,
  ])

  const handleCancel = useCallback(() => {
    if (isExporting) {
      abortRef.current = true
      // Clear elapsed timer
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current)
        elapsedTimerRef.current = null
      }
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
      setExportPhase('')
      setFrameCount(null)
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
                      step={2}
                      value={customWidth}
                      onChange={(e) =>
                        setCustomWidth(Math.max(160, ensureEven(Number(e.target.value) || 1920)))
                      }
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
                      step={2}
                      value={customHeight}
                      onChange={(e) =>
                        setCustomHeight(Math.max(90, ensureEven(Number(e.target.value) || 1080)))
                      }
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
                step={1}
                value={gifWidth}
                onChange={(e) => setGifWidth(Math.round(Number(e.target.value)))}
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
            {orphanedClips.length} clip{orphanedClips.length > 1 ? 's' : ''} reference deleted media
            and will be skipped in the export.
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
              {exportPhase}
              {exportStatus === 'exporting' ? ` ${Math.round(progress)}%` : ''} — {elapsedSec}s
              {frameCount !== null ? ` (${frameCount} frames)` : ''}
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

        {/* FFmpeg command(s) */}
        {ffmpegCommands.length > 0 && (
          <div>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 11,
                padding: 0,
                textDecoration: 'underline',
              }}
              onClick={() => setShowCommands((v) => !v)}
            >
              {showCommands ? 'Hide' : 'Show'} FFmpeg Command{ffmpegCommands.length > 1 ? 's' : ''}
            </button>
            {showCommands && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                  Note: filenames refer to the in-browser virtual filesystem.
                </div>
                {ffmpegCommands.map((c, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>
                        {c.label}
                      </span>
                      <button
                        style={{
                          background: '#1a1a1a',
                          border: '1px solid #3a3a3a',
                          borderRadius: 3,
                          color: '#888',
                          cursor: 'pointer',
                          fontSize: 10,
                          padding: '2px 6px',
                        }}
                        onClick={() => navigator.clipboard.writeText(c.cmd)}
                      >
                        Copy
                      </button>
                    </div>
                    <pre
                      style={{
                        background: '#1a1a1a',
                        border: '1px solid #2e2e2e',
                        borderRadius: 4,
                        padding: '6px 8px',
                        fontSize: 10,
                        color: '#ccc',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        margin: 0,
                        maxHeight: 120,
                        overflow: 'auto',
                      }}
                    >
                      {c.cmd}
                    </pre>
                  </div>
                ))}
              </div>
            )}
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

function getExtFromInput(input: { name?: string; type: string; url: string }): string {
  const nameExt = getExtFromPath(input.name ?? '')
  if (nameExt) return nameExt

  const urlExt = input.url.startsWith('blob:') ? '' : getExtFromPath(input.url)
  if (urlExt) return urlExt

  if (input.type === 'image') return '.png'
  if (input.type === 'audio') return '.webm'
  return '.webm'
}

function getExtFromPath(path: string): string {
  try {
    const pathname = new URL(path, 'http://localhost').pathname
    const filename = pathname.split('/').pop() ?? ''
    const dotIndex = filename.lastIndexOf('.')
    if (dotIndex <= 0 || dotIndex === filename.length - 1) return ''
    return filename.slice(dotIndex).toLowerCase()
  } catch {
    const filename = path.split(/[\\/]/).pop() ?? ''
    const dotIndex = filename.lastIndexOf('.')
    if (dotIndex <= 0 || dotIndex === filename.length - 1) return ''
    return filename.slice(dotIndex).toLowerCase()
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
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
