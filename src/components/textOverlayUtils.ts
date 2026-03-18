import type { Effect } from '@/store/types'

// ---------------------------------------------------------------------------
// Text overlay state
// ---------------------------------------------------------------------------

export interface TextOverlay {
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
}

// ---------------------------------------------------------------------------
// Compute text overlay state from effect params
// ---------------------------------------------------------------------------

export function computeTextOverlay(effect: Effect): TextOverlay {
  const p = effect.params
  return {
    text: (p.text as string | undefined) ?? 'Label',
    x: (p.x as number | undefined) ?? 50,
    y: (p.y as number | undefined) ?? 50,
    fontSize: (p.fontSize as number | undefined) ?? 32,
    color: (p.color as string | undefined) ?? '#ffffff',
    fontFamily: (p.fontFamily as string | undefined) ?? 'sans-serif',
  }
}
