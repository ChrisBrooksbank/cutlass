# Recording

## Overview

Capture screen video, system audio, and cursor position directly in the browser.

## User Stories

- As a user, I want to record my screen so that I can create tutorials and demos
- As a user, I want to capture system audio alongside video so my recordings include app sounds
- As a user, I want my cursor position tracked so I can add highlights in editing

## Requirements

- [ ] Screen capture via `getDisplayMedia()` with video and system audio
- [ ] MediaRecorder encoding to WebM chunks
- [ ] Recording controls: start, pause, resume, stop
- [ ] Recording timer display
- [ ] Automatic media asset creation when recording stops (blob + thumbnail + duration)
- [ ] Voiceover recording via `getUserMedia({ audio: true })` as separate audio track
- [ ] Cursor position capture via pointer events during recording
- [ ] Store cursor data as time-stamped coordinates alongside the recording

## Acceptance Criteria

- [ ] Can record screen with one click, recording appears on timeline when stopped
- [ ] System audio is captured on Chrome/Edge when user opts in
- [ ] Voiceover can be recorded independently and lands on a separate audio track
- [ ] Cursor positions are stored and retrievable for replay overlay
- [ ] Recordings over 5 minutes don't crash or run out of memory (stream chunks to storage)

## Out of Scope

- Webcam/facecam overlay (future enhancement)
- Cloud recording or server-side processing
- Recording format selection (always WebM from MediaRecorder)
