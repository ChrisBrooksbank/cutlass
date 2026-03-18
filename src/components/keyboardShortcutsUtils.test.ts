import { describe, it, expect } from 'vitest'
import { getShortcutAction, stepOneFrame } from './keyboardShortcutsUtils'

function makeEvent(
  key: string,
  opts: Partial<{
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    tagName: string
    isContentEditable: boolean
  }> = {},
): KeyboardEvent {
  const target = {
    tagName: opts.tagName ?? 'BODY',
    isContentEditable: opts.isContentEditable ?? false,
  } as HTMLElement

  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
  })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('getShortcutAction', () => {
  it('Space → TOGGLE_PLAY', () => {
    expect(getShortcutAction(makeEvent(' '))).toEqual({ type: 'TOGGLE_PLAY' })
  })

  it('j → SHUTTLE_BACKWARD', () => {
    expect(getShortcutAction(makeEvent('j'))).toEqual({ type: 'SHUTTLE_BACKWARD' })
    expect(getShortcutAction(makeEvent('J'))).toEqual({ type: 'SHUTTLE_BACKWARD' })
  })

  it('k → PAUSE', () => {
    expect(getShortcutAction(makeEvent('k'))).toEqual({ type: 'PAUSE' })
    expect(getShortcutAction(makeEvent('K'))).toEqual({ type: 'PAUSE' })
  })

  it('l → SHUTTLE_FORWARD', () => {
    expect(getShortcutAction(makeEvent('l'))).toEqual({ type: 'SHUTTLE_FORWARD' })
    expect(getShortcutAction(makeEvent('L'))).toEqual({ type: 'SHUTTLE_FORWARD' })
  })

  it('i → SET_IN_POINT', () => {
    expect(getShortcutAction(makeEvent('i'))).toEqual({ type: 'SET_IN_POINT' })
    expect(getShortcutAction(makeEvent('I'))).toEqual({ type: 'SET_IN_POINT' })
  })

  it('o → SET_OUT_POINT', () => {
    expect(getShortcutAction(makeEvent('o'))).toEqual({ type: 'SET_OUT_POINT' })
    expect(getShortcutAction(makeEvent('O'))).toEqual({ type: 'SET_OUT_POINT' })
  })

  it('s → SPLIT', () => {
    expect(getShortcutAction(makeEvent('s'))).toEqual({ type: 'SPLIT' })
    expect(getShortcutAction(makeEvent('S'))).toEqual({ type: 'SPLIT' })
  })

  it('Delete → DELETE', () => {
    expect(getShortcutAction(makeEvent('Delete'))).toEqual({ type: 'DELETE' })
  })

  it('Backspace → DELETE', () => {
    expect(getShortcutAction(makeEvent('Backspace'))).toEqual({ type: 'DELETE' })
  })

  it('Ctrl+Z → UNDO', () => {
    expect(getShortcutAction(makeEvent('z', { ctrlKey: true }))).toEqual({ type: 'UNDO' })
  })

  it('Meta+Z → UNDO', () => {
    expect(getShortcutAction(makeEvent('z', { metaKey: true }))).toEqual({ type: 'UNDO' })
  })

  it('Ctrl+Y → REDO', () => {
    expect(getShortcutAction(makeEvent('y', { ctrlKey: true }))).toEqual({ type: 'REDO' })
  })

  it('Ctrl+Shift+Z → REDO', () => {
    expect(getShortcutAction(makeEvent('z', { ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'REDO',
    })
  })

  it('returns null for unrecognised keys', () => {
    expect(getShortcutAction(makeEvent('a'))).toBeNull()
    expect(getShortcutAction(makeEvent('F5'))).toBeNull()
  })

  it('returns null when focus is inside an INPUT', () => {
    const e = makeEvent(' ', { tagName: 'INPUT' })
    expect(getShortcutAction(e)).toBeNull()
  })

  it('returns null when focus is inside a TEXTAREA', () => {
    const e = makeEvent('s', { tagName: 'TEXTAREA' })
    expect(getShortcutAction(e)).toBeNull()
  })

  it('returns null when focus is in a contentEditable element', () => {
    const e = makeEvent('j', { isContentEditable: true })
    expect(getShortcutAction(e)).toBeNull()
  })

  it('returns null for Ctrl+other (browser shortcut passthrough)', () => {
    expect(getShortcutAction(makeEvent('s', { ctrlKey: true }))).toBeNull()
  })
})

describe('stepOneFrame', () => {
  it('steps forward by 1/fps', () => {
    expect(stepOneFrame(1.0, 30, 1)).toBeCloseTo(1.0 + 1 / 30)
  })

  it('steps backward by 1/fps', () => {
    expect(stepOneFrame(1.0, 30, -1)).toBeCloseTo(1.0 - 1 / 30)
  })

  it('clamps at 0 when stepping backward from start', () => {
    expect(stepOneFrame(0, 30, -1)).toBe(0)
  })

  it('works with 24fps', () => {
    expect(stepOneFrame(0, 24, 1)).toBeCloseTo(1 / 24)
  })
})
