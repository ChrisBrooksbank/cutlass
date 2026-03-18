import { describe, it, expect } from 'vitest'
import { getAssetTypeFromMime, DRAG_ASSET_TYPE } from './mediaBinUtils'

describe('getAssetTypeFromMime', () => {
  it('identifies video types', () => {
    expect(getAssetTypeFromMime('video/mp4')).toBe('video')
    expect(getAssetTypeFromMime('video/webm')).toBe('video')
    expect(getAssetTypeFromMime('video/quicktime')).toBe('video')
  })

  it('identifies audio types', () => {
    expect(getAssetTypeFromMime('audio/mpeg')).toBe('audio')
    expect(getAssetTypeFromMime('audio/wav')).toBe('audio')
    expect(getAssetTypeFromMime('audio/ogg')).toBe('audio')
  })

  it('identifies image types', () => {
    expect(getAssetTypeFromMime('image/png')).toBe('image')
    expect(getAssetTypeFromMime('image/jpeg')).toBe('image')
    expect(getAssetTypeFromMime('image/gif')).toBe('image')
  })

  it('returns null for unknown types', () => {
    expect(getAssetTypeFromMime('text/plain')).toBeNull()
    expect(getAssetTypeFromMime('application/pdf')).toBeNull()
    expect(getAssetTypeFromMime('')).toBeNull()
  })
})

describe('DRAG_ASSET_TYPE', () => {
  it('is a non-empty string', () => {
    expect(typeof DRAG_ASSET_TYPE).toBe('string')
    expect(DRAG_ASSET_TYPE.length).toBeGreaterThan(0)
  })
})
