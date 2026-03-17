# Timeline & Editing

## Overview

Multi-track timeline for arranging, trimming, splitting, and reordering video and audio clips.

## User Stories

- As a user, I want to trim clips by dragging handles so I can remove unwanted sections
- As a user, I want to split a clip at the playhead so I can remove a middle section
- As a user, I want multiple tracks so I can layer video and audio independently
- As a user, I want to drag clips to rearrange them on the timeline

## Requirements

- [ ] Canvas-based timeline (Konva.js) with zoom (pixelsPerSecond) and horizontal pan
- [ ] Time ruler with zoom-dependent markers (frames/seconds/minutes)
- [ ] Draggable playhead that syncs with preview, snaps to clip boundaries
- [ ] Track lanes: video, audio, and annotation track types
- [ ] Add/remove/reorder tracks, mute/lock per track
- [ ] Clip blocks: colored rectangles with thumbnail preview, drag to move between tracks/positions
- [ ] Trim handles: drag left/right edges of clip to adjust in/out points
- [ ] Split tool: split clip at playhead position into two clips
- [ ] Delete selected clip(s)
- [ ] Snap-to: playhead, clip edges, and other clip boundaries
- [ ] Media bin panel: import files (video, audio, image), drag onto timeline
- [ ] Waveform display inside audio clips (pre-computed)
- [ ] Clip speed control: 0.25x to 4x per clip
- [ ] Undo/redo for all timeline operations (Zustand temporal middleware)
- [ ] Keyboard shortcuts: Space (play/pause), J/K/L (shuttle), I/O (in/out), S (split), Del (delete), Ctrl+Z/Y (undo/redo)

## Acceptance Criteria

- [ ] Can import a video file and it appears on the timeline as a clip
- [ ] Can trim a clip by dragging edges, preview updates to reflect trim
- [ ] Can split a clip at playhead, resulting in two independent clips
- [ ] Can drag clips to reposition and reorder on timeline
- [ ] Multi-track: video on track 1, audio on track 2, both play in sync
- [ ] Undo/redo works for all editing operations
- [ ] Timeline zoom from full-project view to frame-level precision
- [ ] All keyboard shortcuts functional

## Out of Scope

- Ripple/roll edit modes (future enhancement)
- Magnetic timeline (clips auto-close gaps)
