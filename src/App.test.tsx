import { describe, it, expect } from 'vitest'

describe('App scaffold', () => {
  it('path alias resolves', async () => {
    const mod = await import('@/App')
    expect(mod.default).toBeDefined()
  })
})
