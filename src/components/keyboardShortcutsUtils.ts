/**
 * Pure utilities for keyboard shortcut handling.
 */

export type ShortcutAction =
  | { type: 'TOGGLE_PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SHUTTLE_BACKWARD' }
  | { type: 'SHUTTLE_FORWARD' }
  | { type: 'SET_IN_POINT' }
  | { type: 'SET_OUT_POINT' }
  | { type: 'SPLIT' }
  | { type: 'DELETE' }
  | { type: 'UNDO' }
  | { type: 'REDO' }

/**
 * Returns the ShortcutAction for a given KeyboardEvent, or null if no shortcut matches.
 * Ignores events originating from text inputs.
 */
export function getShortcutAction(e: KeyboardEvent): ShortcutAction | null {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return null
  }

  const { key, ctrlKey, metaKey, shiftKey } = e
  const cmdOrCtrl = ctrlKey || metaKey

  if (cmdOrCtrl && !shiftKey && (key === 'z' || key === 'Z')) return { type: 'UNDO' }
  if (cmdOrCtrl && (key === 'y' || key === 'Y')) return { type: 'REDO' }
  if (cmdOrCtrl && shiftKey && (key === 'z' || key === 'Z')) return { type: 'REDO' }

  // Don't handle other Ctrl/Cmd combos
  if (cmdOrCtrl) return null

  switch (key) {
    case ' ':
      return { type: 'TOGGLE_PLAY' }
    case 'j':
    case 'J':
      return { type: 'SHUTTLE_BACKWARD' }
    case 'k':
    case 'K':
      return { type: 'PAUSE' }
    case 'l':
    case 'L':
      return { type: 'SHUTTLE_FORWARD' }
    case 'i':
    case 'I':
      return { type: 'SET_IN_POINT' }
    case 'o':
    case 'O':
      return { type: 'SET_OUT_POINT' }
    case 's':
    case 'S':
      return { type: 'SPLIT' }
    case 'Delete':
    case 'Backspace':
      return { type: 'DELETE' }
    default:
      return null
  }
}

/**
 * Computes new playhead time when stepping one frame forward or backward.
 */
export function stepOneFrame(currentTime: number, fps: number, direction: 1 | -1): number {
  const frameStep = 1 / fps
  return Math.max(0, currentTime + direction * frameStep)
}
