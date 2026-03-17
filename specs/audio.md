# Audio

## Overview

Audio mixing, voiceover recording, and background music for screen recording projects.

## User Stories

- As a user, I want to adjust audio volume per track so I can balance narration and system sounds
- As a user, I want to add background music to make my tutorials more engaging
- As a user, I want basic noise reduction on my voiceover recordings

## Requirements

- [ ] Web Audio API graph: each track routes through a GainNode to destination
- [ ] Per-track volume slider (0-1) with real-time gain adjustment
- [ ] Per-track mute toggle
- [ ] Audio waveform extraction and visualization (pre-computed Float32Array)
- [ ] Background music: user uploads audio file, placed on dedicated audio track
- [ ] Audio level metering: visual feedback of audio levels during playback
- [ ] Basic noise reduction: BiquadFilterNode high-pass filter to remove low-frequency hum
- [ ] Audio syncs correctly with video across all playback rates

## Acceptance Criteria

- [ ] Can adjust volume on individual tracks, hear difference in real-time
- [ ] Muting a track silences it immediately
- [ ] Waveforms display accurately inside audio clips on timeline
- [ ] Background music track plays alongside video audio
- [ ] Audio stays in sync with video at 0.5x and 2x playback speeds
- [ ] High-pass filter audibly reduces background hum

## Out of Scope

- RNNoise WASM integration (stretch goal, deferred)
- Audio effects (reverb, compression, EQ beyond high-pass)
- Built-in royalty-free music library
