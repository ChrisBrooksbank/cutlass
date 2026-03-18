import type { MediaAssetType } from '@/store/types'

export const DRAG_ASSET_TYPE = 'application/x-media-asset-id'

export function getAssetTypeFromMime(mimeType: string): MediaAssetType | null {
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('image/')) return 'image'
  return null
}

export function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const assetType = getAssetTypeFromMime(file.type)
    if (assetType === 'image' || assetType === null) {
      resolve(0)
      return
    }
    const url = URL.createObjectURL(file)
    const el: HTMLMediaElement =
      assetType === 'audio' ? new Audio() : document.createElement('video')
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(isFinite(el.duration) ? el.duration : 0)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    el.src = url
  })
}
