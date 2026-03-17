# AGENTS.md - Operational Guide

Keep this file under 60 lines. It's loaded every iteration.

## Stack

React 19 + TypeScript 5 + Vite 6 + Tailwind CSS 4 + Zustand + Konva.js + FFmpeg.wasm

## Build Commands

```bash
npm run build          # Production build
npm run dev            # Development server
```

## Test Commands

```bash
npm test               # Run tests (watch mode)
npm run test:run       # Run tests once
npm run test:coverage  # Coverage report
```

## Validation (run before committing)

```bash
npm run check          # Run ALL checks (typecheck, lint, format, tests)
```

## Key Architecture

- **State**: Zustand store with slices (project, playback, selection, ui, history)
- **Preview**: Konva.js canvas compositing with PlaybackEngine frame clock
- **Timeline**: Custom Konva canvas (not DOM) for performance
- **Export**: FFmpeg.wasm in Web Worker, requires Cross-Origin-Isolation headers
- **Data model**: Project > Tracks > Clips > Effects > Keyframes

## Project Notes

- FFmpeg.wasm requires `SharedArrayBuffer` → COOP/COEP headers in vite.config.ts
- Fallback to single-threaded `@ffmpeg/core` if SharedArrayBuffer unavailable
- Non-destructive editing: store in/out points, never modify source media
- Canvas-based timeline for waveform rendering performance
