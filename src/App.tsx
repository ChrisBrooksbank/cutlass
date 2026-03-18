import { useEffect } from 'react'
import '@/App.css'
import MediaBin from '@/components/MediaBin'
import PreviewPanel from '@/components/PreviewPanel'
import PropertiesPanel from '@/components/PropertiesPanel'
import TimelinePanel from '@/components/TimelinePanel'
import { useEditorStore, useUndoRedo } from '@/store'
import { getShortcutAction, stepOneFrame } from '@/components/keyboardShortcutsUtils'
import { getSplitCandidates } from '@/components/splitUtils'

export default function App() {
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const setInPoint = useEditorStore((s) => s.setInPoint)
  const setOutPoint = useEditorStore((s) => s.setOutPoint)
  const splitClip = useEditorStore((s) => s.splitClip)
  const removeClips = useEditorStore((s) => s.removeClips)
  const { undo, redo } = useUndoRedo()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const action = getShortcutAction(e)
      if (!action) return

      e.preventDefault()

      // Read current state fresh to avoid stale closures
      const state = useEditorStore.getState()

      switch (action.type) {
        case 'TOGGLE_PLAY':
          setIsPlaying(!state.playback.isPlaying)
          break
        case 'PAUSE':
          setIsPlaying(false)
          break
        case 'SHUTTLE_BACKWARD':
          setIsPlaying(false)
          setCurrentTime(stepOneFrame(state.playback.currentTime, state.project.fps, -1))
          break
        case 'SHUTTLE_FORWARD':
          setIsPlaying(false)
          setCurrentTime(stepOneFrame(state.playback.currentTime, state.project.fps, 1))
          break
        case 'SET_IN_POINT':
          setInPoint(state.playback.currentTime)
          break
        case 'SET_OUT_POINT':
          setOutPoint(state.playback.currentTime)
          break
        case 'SPLIT': {
          const candidates = getSplitCandidates(
            state.project.tracks,
            state.selection.selectedClipIds,
            state.playback.currentTime,
          )
          for (const clipId of candidates) {
            splitClip(clipId, state.playback.currentTime)
          }
          break
        }
        case 'DELETE':
          if (state.selection.selectedClipIds.length > 0) {
            removeClips(state.selection.selectedClipIds)
          }
          break
        case 'UNDO':
          undo()
          break
        case 'REDO':
          redo()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setIsPlaying, setCurrentTime, setInPoint, setOutPoint, splitClip, removeClips, undo, redo])

  return (
    <div className="app-shell">
      <MediaBin />
      <PreviewPanel />
      <PropertiesPanel />
      <TimelinePanel />
    </div>
  )
}
