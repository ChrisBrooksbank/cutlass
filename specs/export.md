# Export

## Overview

Client-side video export via FFmpeg.wasm, supporting multiple formats, resolutions, and GIF output.

## User Stories

- As a user, I want to export my edited video as MP4 so I can share it anywhere
- As a user, I want to choose export resolution so I can optimize for file size or quality
- As a user, I want to export as GIF for quick sharing in chat/docs
- As a user, I want to see export progress so I know how long to wait

## Requirements

- [ ] FFmpeg.wasm loaded in Web Worker (non-blocking)
- [ ] Cross-Origin-Isolation headers (COOP/COEP) configured in Vite dev server and build
- [ ] Fallback to single-threaded @ffmpeg/core if SharedArrayBuffer unavailable
- [ ] Export format selection: MP4 (H.264) and WebM (VP9)
- [ ] Resolution presets: 1080p, 720p, 480p, plus custom
- [ ] Project-to-FFmpeg filter graph translation: multi-track compositing, drawtext overlays, zoompan, boxblur, speed changes, xfade transitions
- [ ] Export progress UI: percentage bar parsed from FFmpeg stderr output
- [ ] Cancel export mid-process
- [ ] GIF export: two-pass pipeline (palettegen + paletteuse) with configurable FPS and width
- [ ] Thumbnail generation: seek to user-selected frame, export as PNG via canvas.toDataURL()
- [ ] Export dialog: format, resolution, quality presets, estimated file size
- [ ] Download exported file via browser download

## Acceptance Criteria

- [ ] Can export a trimmed, multi-track project as MP4, file plays correctly in VLC and browser
- [ ] Can export as WebM with same fidelity
- [ ] Progress bar updates smoothly during export
- [ ] Can cancel an in-progress export without crashing
- [ ] GIF export produces reasonable quality at configurable dimensions
- [ ] Text overlays, blur regions, and zoom effects render correctly in exported file
- [ ] Export works on Chrome and Edge; graceful fallback message on unsupported browsers
- [ ] Thumbnail picker lets user select a frame and download as PNG

## Out of Scope

- Server-side encoding
- Streaming upload to YouTube/Vimeo
- Batch export of multiple projects
