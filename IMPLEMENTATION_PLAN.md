# Implementation Plan

## Status

- Planning iterations: 1
- Build iterations: 0
- Last updated: 2026-03-17

## Notes

### Architecture Decisions

- **Framework**: React + TypeScript + Vite
- **State**: Zustand (with temporal middleware for undo/redo)
- **Timeline renderer**: Konva.js (canvas-based)
- **Audio**: Web Audio API (GainNode graph per track)
- **Export**: FFmpeg.wasm in Web Worker (SharedArrayBuffer / fallback to single-threaded)
- **Recording**: getDisplayMedia + MediaRecorder (WebM chunks)

### Dependency Order

Project scaffold → State + layout → Timeline core → Recording → Audio → Effects → Export

---

## Tasks

### Phase 1: Project Scaffold & Layout

- [x] Scaffold Vite + React + TypeScript project with ESLint, Prettier, and path aliases (spec: timeline-editing.md)
- [x] Install core dependencies: Zustand, Konva/react-konva, @ffmpeg/ffmpeg, @ffmpeg/util (spec: timeline-editing.md)
- [x] Define core Zustand store: project state, tracks, clips, playhead, selection (spec: timeline-editing.md)
- [x] Build app shell layout: media bin (left), preview (top-right), properties panel (right), timeline (bottom) (spec: timeline-editing.md)
- [x] Build video preview component: HTMLVideoElement sync'd to playhead position and playback state (spec: timeline-editing.md)

### Phase 2: Timeline Core

- [x] Canvas timeline with Konva: pixelsPerSecond zoom and horizontal pan (spec: timeline-editing.md)
- [x] Time ruler with zoom-dependent tick marks (frames / seconds / minutes) (spec: timeline-editing.md)
- [x] Track lane rows: video, audio, annotation types; add/remove/reorder; mute/lock toggles (spec: timeline-editing.md)
- [x] Clip blocks: colored rectangles with drag-to-move within and across tracks (spec: timeline-editing.md)
- [x] Trim handles: drag left/right clip edges to adjust in/out points (spec: timeline-editing.md)
- [x] Draggable playhead that snaps to clip boundaries and syncs preview position (spec: timeline-editing.md)
- [x] Split tool: split clip at playhead into two independent clips (spec: timeline-editing.md)
- [x] Delete selected clip(s) (spec: timeline-editing.md)
- [x] Snap-to: clip edges, other clip boundaries, and playhead (spec: timeline-editing.md)
- [x] Media bin panel: import video/audio/image files; drag onto timeline to create clips (spec: timeline-editing.md)
- [x] Clip speed control (0.25x–4x) per clip with preview sync (spec: timeline-editing.md)
- [x] Undo/redo via Zustand temporal middleware for all timeline operations (spec: timeline-editing.md)
- [x] Keyboard shortcuts: Space, J/K/L, I/O, S, Del, Ctrl+Z/Y (spec: timeline-editing.md)
- [x] Thumbnail preview inside video clip blocks (extracted via canvas seek) (spec: timeline-editing.md)

### Phase 3: Recording

- [x] Screen capture via getDisplayMedia (video + system audio); start/pause/resume/stop controls + timer UI (spec: recording.md)
- [x] MediaRecorder encoding WebM chunks; stream chunks to avoid memory issues on long recordings (spec: recording.md)
- [x] Auto-create media asset (blob + thumbnail + duration) when recording stops and place on timeline (spec: recording.md)
- [x] Voiceover recording via getUserMedia(audio) as separate audio track on timeline (spec: recording.md)
- [x] Cursor position capture via pointer events during recording; store timestamped coordinates (spec: recording.md)

### Phase 4: Audio

- [x] Web Audio API routing graph: each track through GainNode to destination (spec: audio.md)
- [x] Per-track volume slider (0–1) with real-time gain adjustment; per-track mute toggle (spec: audio.md)
- [x] Audio waveform extraction: pre-compute Float32Array and render inside audio clip blocks (spec: audio.md)
- [x] Background music: user uploads audio file, placed on dedicated audio track (spec: audio.md)
- [x] Audio level metering: visual VU meter bars during playback (spec: audio.md)
- [x] Noise reduction: BiquadFilterNode high-pass filter per audio track (spec: audio.md)

### Phase 5: Effects & Annotations

- [x] Keyframe data model: per-effect keyframes with easing types (linear, ease-in, ease-out, ease-in-out) (spec: effects-annotations.md)
- [x] Keyframe editor UI in properties panel: add/remove/move keyframes, easing curve selector (spec: effects-annotations.md)
- [x] Effect registry: extensible map of effect-type → render/export handler (spec: effects-annotations.md)
- [ ] Zoom/pan (Ken Burns) effect: keyframed scaleX/Y + x/y viewport transforms on preview canvas (spec: effects-annotations.md)
- [ ] Blur/redact regions: draggable rectangles with configurable blur strength, keyframed position/size (spec: effects-annotations.md)
- [ ] Cursor highlight overlay: replay captured cursor data as animated circle/spotlight on preview canvas (spec: effects-annotations.md)
- [ ] Text overlays: place text on preview canvas, edit font/size/color/position (spec: effects-annotations.md)
- [ ] Shape annotations: arrows, rectangles, circles on annotation layer (spec: effects-annotations.md)
- [ ] Clip transitions: cross-dissolve, fade-to-black, wipe with handles on clip edges in timeline (spec: effects-annotations.md)
- [ ] Crop per clip: adjust visible region in properties panel (spec: effects-annotations.md)
- [ ] Intro/outro templates: pre-designed scenes with editable text and colors (spec: effects-annotations.md)

### Phase 6: Export

- [ ] Load FFmpeg.wasm in Web Worker; configure COOP/COEP headers in Vite; fallback to single-threaded core (spec: export.md)
- [ ] Project-to-FFmpeg filter graph translation: multi-track compositing, speed, drawtext, zoompan, boxblur, xfade (spec: export.md)
- [ ] Export format selection: MP4 (H.264) and WebM (VP9); resolution presets 1080p/720p/480p + custom (spec: export.md)
- [ ] Export progress UI: percentage bar parsed from FFmpeg stderr; cancel export mid-process (spec: export.md)
- [ ] GIF export: two-pass palettegen + paletteuse pipeline with configurable FPS and width (spec: export.md)
- [ ] Thumbnail generation: seek to user-selected frame, export PNG via canvas.toDataURL (spec: export.md)
- [ ] Export dialog: format, resolution, quality preset, estimated file size, download trigger (spec: export.md)

---

## Completed

<!-- Completed tasks move here -->
