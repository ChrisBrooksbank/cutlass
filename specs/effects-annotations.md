# Effects & Annotations

## Overview

Visual effects and annotation tools optimized for screen recording editing: zoom/pan, blur, cursor highlighting, text overlays, and transitions.

## User Stories

- As a user, I want to zoom into a region of my screen recording to focus viewers' attention
- As a user, I want to blur sensitive information like passwords or personal data
- As a user, I want to highlight my cursor so viewers can follow my actions
- As a user, I want to add text labels and arrows to annotate my recording
- As a user, I want smooth transitions between clips

## Requirements

- [ ] Zoom/pan (Ken Burns) effect: keyframed viewport transforms (scaleX/Y, x/y)
- [ ] Blur/redact regions: draggable rectangles with configurable blur strength, keyframed position/size
- [ ] Cursor highlighting: replay captured cursor data as animated overlay (circle/spotlight)
- [ ] Text overlay: place text on preview canvas, edit font/family/size/color/position
- [ ] Shape annotations: arrows, rectangles, circles on annotation layer
- [ ] Keyframe system: per-effect keyframes with easing (linear, ease-in, ease-out, ease-in-out)
- [ ] Keyframe editor UI in properties panel
- [ ] Transitions between clips: cross-dissolve, fade-to-black, wipe
- [ ] Transition handles on clip edges in timeline
- [ ] Crop per clip: adjust visible region
- [ ] Intro/outro templates: pre-designed scenes with editable text and colors
- [ ] Effect registry: extensible system for adding new effect types

## Acceptance Criteria

- [ ] Can add zoom effect to a clip, keyframe start/end viewport, preview animates smoothly
- [ ] Can draw a blur region, resize/move it, blur visible in preview
- [ ] Cursor highlight replays recorded cursor path with configurable style
- [ ] Can place text on preview, edit properties, text renders at correct time
- [ ] Transitions render in preview and export correctly
- [ ] Keyframe editor allows adding/removing/moving keyframes with easing curves
- [ ] All effects export correctly via FFmpeg filter graph

## Out of Scope

- Custom shader effects
- Motion tracking (auto-follow cursor)
- AI-powered auto-zoom
