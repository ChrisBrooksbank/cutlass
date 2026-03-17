# Web-Based Screen Recording Video Editor — Implementation Plan

## Context

Build a browser-only screen recording editor for trimming, annotating, and polishing screen captures and tutorials. No server required — all processing happens client-side using FFmpeg.wasm. Stack: React + TypeScript + Vite.

---

## Technology Stack

| Category | Library | Rationale |
|---|---|---|
| Framework | React 19 + TypeScript 5.x | Mature ecosystem |
| Build Tool | Vite 6 | Fast HMR, excellent WASM support |
| Video Processing | `@ffmpeg/ffmpeg` 0.12.x + `@ffmpeg/core-mt` | Multi-threaded client-side export |
| Canvas Rendering | Konva.js + react-konva | High-perf layered canvas for preview + timeline |
| State Management | Zustand + temporal middleware | Single store with slices, built-in undo/redo |
| UI Components | Radix UI + Tailwind CSS 4 | Accessible primitives, full design control |
| Icons | Lucide React | Clean, consistent |
| Audio | Web Audio API (native) | No library needed for mixing/gain/analysis |
| Keyboard Shortcuts | tinykeys | Tiny (~400B), composable |
| Drag & Drop | @dnd-kit | Accessible DnD for clip rearrangement |

---

## Feature Viability Assessment

### Core Features (Must-Have)

| Feature | Complexity | APIs/Libraries | Notes |
|---|---|---|---|
| Screen recording capture | **Low** | `getDisplayMedia()` + `MediaRecorder` | Chrome/Edge also capture system audio |
| Timeline with playback | **High** | Custom Konva canvas + `requestAnimationFrame` | Heart of the editor; must be custom |
| Trim/split/cut | **Medium** | In-memory clip model + FFmpeg.wasm export | Non-destructive: store in/out points |
| Export via FFmpeg.wasm | **Medium** | `@ffmpeg/ffmpeg` + `@ffmpeg/core-mt` | Requires `Cross-Origin-Isolation` headers |

### Editing Features

| Feature | Complexity | Notes |
|---|---|---|
| Multi-track timeline | **High** | Multiple video + audio lanes with independent timing |
| Text overlays / annotations | **Medium** | Konva Text/Arrow/Rect; FFmpeg `drawtext` for export |
| Zoom/pan (Ken Burns) | **Medium** | Animate scaleX/Y and x/y between keyframes; great for screen recordings |
| Cursor highlighting | **Medium** | Record pointer events alongside video; replay as animated overlay |
| Blur/redact regions | **Medium** | Konva blur filter for preview; FFmpeg `boxblur` for export |
| Crop and resize | **Low** | Simple transform parameters |
| Speed control (0.25x–4x) | **Low** | `playbackRate` for preview; FFmpeg `setpts`/`atempo` for export |

### Audio Features

| Feature | Complexity | Notes |
|---|---|---|
| Voiceover recording | **Low** | `getUserMedia({ audio: true })` + `MediaRecorder` |
| Background music track | **Low** | User uploads or built-in options |
| Audio level per track | **Low** | Web Audio `GainNode` per track |
| Noise reduction | **High** | Basic: `BiquadFilterNode` high-pass; Real: RNNoise WASM (deferred) |

### Polish Features

| Feature | Complexity | Notes |
|---|---|---|
| Intro/outro templates | **Medium** | Pre-built Konva scenes with editable text/colors |
| Transitions | **High** | WebGL/Canvas blend for preview; FFmpeg `xfade` for export |
| Thumbnail generation | **Low** | `canvas.toDataURL()` from seeked frame |
| Keyboard shortcuts | **Low** | Standard NLE: J/K/L, Space, I/O, S, Del, Ctrl+Z/Y |
| Undo/redo | **Medium** | Zustand temporal middleware |

### Export Features

| Feature | Complexity | Notes |
|---|---|---|
| Multiple resolutions | **Low** | Presets: 1080p, 720p, 480p |
| GIF export | **Medium** | Two-pass FFmpeg (`palettegen` + `paletteuse`) |
| Format selection (MP4/WebM) | **Low** | FFmpeg output format flag |

---

## Architecture

### Core Data Model

```typescript
interface Project {
  id: string;
  name: string;
  resolution: { width: number; height: number };
  frameRate: number;
  tracks: Track[];
  duration: number; // computed
}

interface Track {
  id: string;
  type: 'video' | 'audio' | 'annotation';
  label: string;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  volume: number; // 0–1
}

interface Clip {
  id: string;
  trackId: string;
  sourceId: string;        // reference to MediaAsset
  startTime: number;       // position on timeline (seconds)
  duration: number;        // visible duration
  sourceInPoint: number;   // trim start within source
  sourceOutPoint: number;  // trim end within source
  speed: number;           // playback rate
  effects: Effect[];
}

interface Effect {
  id: string;
  type: 'blur' | 'zoom' | 'text' | 'cursor-highlight' | 'crop' | 'transition';
  keyframes: Keyframe[];
  params: Record<string, unknown>;
}

interface Keyframe {
  time: number;            // relative to clip start
  value: Record<string, number | string>;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  blob: Blob;
  duration: number;
  thumbnail?: string;
  waveform?: Float32Array;
}
```

### Rendering Pipeline (Preview)

1. **Frame Clock** — `PlaybackEngine` class driven by `requestAnimationFrame`, maintains `currentTime`
2. **Video Decode** — Hidden `<video>` elements per source; WebCodecs `VideoDecoder` for scrubbing
3. **Canvas Compositing** (bottom to top per frame tick):
   - Background (solid/checkerboard)
   - Video track frames → `Konva.Image`
   - Effects (zoom, blur regions) as Konva transforms/filters
   - Annotation layer (text, shapes, arrows)
   - Cursor highlight layer
4. **Audio Mixing** — Web Audio API graph: each track → `GainNode` → `destination`
5. **Export** — Serialize project to FFmpeg filter graph → run in Web Worker → output blob

### Timeline UI (Custom Konva Canvas)

Canvas-based (not DOM) for performance with many clips + waveform rendering:

- **TimeRuler** — zoom-dependent markers (frames/seconds/minutes)
- **Playhead** — draggable vertical line, snaps to boundaries
- **TrackLane** — horizontal lane per track
- **ClipBlock** — colored rect with thumbnail, drag to move, edge handles to trim
- **WaveformView** — pre-computed audio waveform inside audio clips

Zoom = `pixelsPerSecond` value. Pan = horizontal scroll offset.

### FFmpeg.wasm in Web Worker

FFmpeg blocks the thread — must run in a Worker:
- Main thread sends project JSON + media references
- Worker writes to FFmpeg virtual FS, constructs filter graph, executes
- Worker posts progress events (parsed from stderr)
- Worker sends final output blob

**Requires** `SharedArrayBuffer` → page must be cross-origin isolated:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Fallback: single-threaded `@ffmpeg/core` if SharedArrayBuffer unavailable.

### State Management (Zustand Slices)

| Slice | Purpose |
|---|---|
| `projectSlice` | Tracks, clips, effects, media assets (the "document") |
| `playbackSlice` | currentTime, isPlaying, playbackRate, loopRegion |
| `selectionSlice` | Selected clips/tracks/effects, active tool |
| `uiSlice` | Panel sizes, modals, timeline zoom |
| `historySlice` | Undo/redo via temporal middleware |

---

## Project Structure

```
src/
├── main.tsx
├── App.tsx
├── vite-env.d.ts
│
├── app/
│   ├── store.ts                      # Zustand store (compose slices)
│   ├── slices/
│   │   ├── projectSlice.ts
│   │   ├── playbackSlice.ts
│   │   ├── selectionSlice.ts
│   │   ├── uiSlice.ts
│   │   └── historySlice.ts
│   └── types.ts                      # All TypeScript interfaces
│
├── components/
│   ├── layout/
│   │   ├── EditorLayout.tsx          # Main 3-panel layout
│   │   ├── Toolbar.tsx
│   │   └── StatusBar.tsx
│   │
│   ├── preview/
│   │   ├── PreviewPanel.tsx
│   │   ├── PreviewCanvas.tsx         # Konva Stage for compositing
│   │   ├── PlaybackControls.tsx
│   │   └── layers/
│   │       ├── VideoLayer.tsx
│   │       ├── AnnotationLayer.tsx
│   │       ├── CursorLayer.tsx
│   │       └── BlurLayer.tsx
│   │
│   ├── timeline/
│   │   ├── TimelinePanel.tsx
│   │   ├── TimelineCanvas.tsx        # Konva Stage for timeline
│   │   ├── TimeRuler.tsx
│   │   ├── Playhead.tsx
│   │   ├── TrackLane.tsx
│   │   ├── ClipBlock.tsx
│   │   ├── WaveformRenderer.tsx
│   │   ├── TransitionHandle.tsx
│   │   └── TimelineToolbar.tsx
│   │
│   ├── properties/
│   │   ├── PropertiesPanel.tsx       # Right sidebar
│   │   ├── ClipProperties.tsx
│   │   ├── EffectProperties.tsx
│   │   ├── TextProperties.tsx
│   │   └── KeyframeEditor.tsx
│   │
│   ├── media/
│   │   ├── MediaBin.tsx
│   │   ├── MediaThumbnail.tsx
│   │   └── ImportDialog.tsx
│   │
│   └── export/
│       ├── ExportDialog.tsx
│       ├── ExportProgress.tsx
│       └── ThumbnailPicker.tsx
│
├── engine/
│   ├── PlaybackEngine.ts            # Central frame clock + sync
│   ├── VideoDecoderPool.ts          # WebCodecs decoder management
│   ├── AudioMixer.ts                # Web Audio graph builder
│   ├── FrameRenderer.ts             # Composites frame to canvas
│   └── CursorTracker.ts             # Records/replays cursor data
│
├── recording/
│   ├── ScreenRecorder.ts            # getDisplayMedia + MediaRecorder
│   ├── AudioRecorder.ts             # getUserMedia for voiceover
│   └── CursorCapture.ts             # Pointer event recording
│
├── export/
│   ├── FFmpegExporter.ts            # FFmpeg.wasm orchestration
│   ├── FilterGraphBuilder.ts        # Project → FFmpeg filter graph
│   ├── GifExporter.ts
│   └── worker/
│       └── ffmpeg.worker.ts          # Web Worker for FFmpeg
│
├── effects/
│   ├── EffectRegistry.ts
│   ├── ZoomPanEffect.ts
│   ├── BlurEffect.ts
│   ├── CursorHighlight.ts
│   ├── TextOverlay.ts
│   └── TransitionEffect.ts
│
├── hooks/
│   ├── usePlayback.ts
│   ├── useTimeline.ts
│   ├── useShortcuts.ts
│   ├── useMediaImport.ts
│   └── useUndoRedo.ts
│
├── utils/
│   ├── time.ts                      # Time formatting, frame math
│   ├── waveform.ts                  # Audio waveform extraction
│   ├── thumbnails.ts                # Video thumbnail generation
│   ├── interpolation.ts             # Keyframe easing functions
│   └── ffmpegHelpers.ts             # FFmpeg command builders
│
└── styles/
    └── globals.css                   # Tailwind + custom theme

# Root files
index.html
package.json
tsconfig.json
vite.config.ts                       # COOP/COEP headers config
tailwind.config.ts
public/
  ffmpeg/                            # FFmpeg WASM core (served statically)
```

---

## Phased Build Order

### Phase 1 — MVP: Record, Trim, Export

**Goal:** Record screen → trim the clip → export MP4.

1. Project scaffolding: Vite + React + TS + Tailwind + Zustand skeleton
2. Screen recording: `getDisplayMedia` + `MediaRecorder` → WebM blob
3. Basic preview: `<video>` element with play/pause/seek
4. Simple timeline: single track, one clip, draggable trim handles, playhead
5. FFmpeg.wasm integration: load core-mt in Web Worker, configure COOP/COEP, trim export
6. Export dialog: resolution picker, format (MP4/WebM), download + progress

**Deliverable:** Functional screen recorder + trimmer that exports MP4/WebM.

### Phase 2 — Multi-Track & Basic Editing

**Goal:** Multiple clips, audio tracks, annotations.

1. Multi-track timeline: multiple lanes, drag clips, snap-to-playhead/clip-edge
2. Split/cut tool: split at playhead → two clips with adjusted in/out
3. Media bin: import files, drag onto timeline
4. Konva preview canvas: replace `<video>` with composited canvas rendering
5. Voiceover recording: mic → separate audio track
6. Audio mixing: Web Audio graph, per-track gain sliders
7. Text overlay tool: click preview to place text, edit font/size/color
8. Complex FFmpeg export: multi-track filter graph, `drawtext` overlays

**Deliverable:** Multi-track editor with text overlays and audio mixing.

### Phase 3 — Effects & Polish

**Goal:** Screen-recording-specific effects, keyboard shortcuts, undo/redo.

1. Zoom/pan effect: keyframed viewport transforms, FFmpeg `zoompan` filter
2. Cursor highlighting: capture pointer events during recording, replay as overlay
3. Blur/redact: draggable blur regions with keyframes, FFmpeg `boxblur`
4. Speed control: per-clip 0.25x–4x, `setpts`/`atempo` for export
5. Crop and resize: project output resolution, per-clip crop
6. Undo/redo: Zustand temporal middleware, Ctrl+Z / Ctrl+Shift+Z
7. Keyboard shortcuts: Space, J/K/L, I/O, S, Delete, Ctrl+Z/Y

**Deliverable:** Feature-rich editor with screen-recording-specific effects.

### Phase 4 — Transitions, Templates & Advanced

**Goal:** Professional polish.

1. Transitions: cross-dissolve, fade-to-black, wipe; FFmpeg `xfade`
2. Intro/outro templates: pre-designed Konva scenes, user-customizable
3. Background music: built-in tracks or user upload
4. Thumbnail generation: seek to frame, export PNG
5. GIF export: two-pass FFmpeg pipeline
6. Noise reduction: basic high-pass filter (stretch: RNNoise WASM)
7. Project persistence: save/load to IndexedDB + JSON, auto-save

**Deliverable:** Polished, professional-feeling editor.

---

## Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| FFmpeg.wasm slow for long videos | Accurate progress UI; background tab processing; future WebCodecs export |
| SharedArrayBuffer unavailable | Detect + fall back to single-threaded core; warn user |
| Large recordings exceed memory | Stream `MediaRecorder` chunks to IndexedDB; use `<video>` seek not full load |
| WebCodecs unavailable (Firefox) | Fall back to `<video>` seeking; slower scrub but functional |
| Complex filter graphs fail | Test suite of patterns; validate before execution; show FFmpeg stderr |

---

## Verification Plan

After each phase:

1. **Record** a screen capture (30+ seconds) with system audio
2. **Import** the recording and verify it appears on timeline
3. **Trim** the clip using drag handles, verify preview matches
4. **Export** as MP4, verify output plays correctly in VLC/browser
5. **Cross-browser** test in Chrome and Edge (primary targets)
6. **Memory** check: record 5+ min video, edit, export without crash
