# Cutlass

A browser-based video editor built for screen recordings. Record your screen, trim and arrange clips on a multi-track timeline, add effects and annotations, then export — all without leaving the browser.

## Features

**Recording**
- Screen capture with system audio via `getDisplayMedia()`
- Voiceover recording with separate audio track
- Cursor position tracking for replay highlighting
- Pause/resume support with recording timer

**Timeline Editing**
- Multi-track canvas timeline (video, audio, annotation tracks)
- Drag-to-move, trim handles, split at playhead
- Per-clip speed control (0.25x–4x)
- Track mute/lock, volume, and noise reduction
- Snapping, zoom from frame-level to minutes
- Undo/redo with full history

**Effects & Annotations**
- Zoom/Pan (Ken Burns) with keyframes
- Blur/redact regions
- Text overlays
- Shape annotations (rectangle, circle, arrow)
- Cursor highlight replay
- Crop per clip
- Transitions (cross-dissolve, fade-to-black, wipe)
- Intro/outro templates
- Keyframe editor with easing curves

**Audio**
- Per-track volume and mute
- Waveform visualization
- Background music track
- Audio level metering
- Noise reduction (high-pass filter)

**Export**
- MP4 (H.264), WebM (VP9), and GIF
- Resolution presets (1080p, 720p, 480p) or custom
- Client-side encoding via FFmpeg.wasm in a Web Worker
- Progress tracking with cancel support

## Tech Stack

React 19 · TypeScript · Vite · Zustand · Konva.js · FFmpeg.wasm · Web Audio API

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run lint` | Lint with ESLint |
| `npm run check` | Run all checks (types, lint, format, tests) |

## License

MIT
