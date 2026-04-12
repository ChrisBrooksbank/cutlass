# CLAUDE.md

## Project Overview

Cutlass — a browser-based video editor for screen recordings. Multi-track timeline editing, effects, annotations, and client-side export via FFmpeg.wasm. Everything runs in the browser with no server required.

**Live:** https://videoeditor-app.netlify.app

## Tech Stack

- React 19 + TypeScript
- Vite
- Zustand (state management)
- Konva.js (canvas timeline)
- FFmpeg.wasm (client-side video encoding in a Web Worker)
- Web Audio API

## Development Commands

```bash
npm install
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
```

## Architecture

- `src/components/` — React UI components
- `src/store/` — Zustand state (timeline, clips, tracks)
- `src/workers/` — FFmpeg.wasm Web Worker for encoding
- `src/effects/` — Video effects pipeline

## Important Notes

- FFmpeg.wasm requires SharedArrayBuffer — the app needs the appropriate COOP/COEP headers (set in `netlify.toml`)
- Canvas timeline is rendered with Konva.js, not DOM elements
- Export runs in a Web Worker to avoid blocking the UI

## Deployment

Deployed on Netlify. Auto-deploys from main branch.
