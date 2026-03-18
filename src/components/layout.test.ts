import { describe, it, expect } from 'vitest'

describe('layout components', () => {
  it('MediaBin exports a default component', async () => {
    const mod = await import('@/components/MediaBin')
    expect(typeof mod.default).toBe('function')
  })

  it('PreviewPanel exports a default component', async () => {
    const mod = await import('@/components/PreviewPanel')
    expect(typeof mod.default).toBe('function')
  })

  it('PropertiesPanel exports a default component', async () => {
    const mod = await import('@/components/PropertiesPanel')
    expect(typeof mod.default).toBe('function')
  })

  it('TimelinePanel exports a default component', async () => {
    const mod = await import('@/components/TimelinePanel')
    expect(typeof mod.default).toBe('function')
  })
})
