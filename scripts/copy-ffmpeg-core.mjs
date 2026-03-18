/**
 * Postinstall script: copies FFmpeg WASM core assets from node_modules
 * into public/ so they can be served as static files.
 *
 * This avoids checking ~64MB of WASM binaries into git.
 */

import { cpSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const copies = [
  {
    src: resolve(root, 'node_modules/@ffmpeg/core-mt/dist/esm'),
    dest: resolve(root, 'public/ffmpeg-core-mt'),
  },
  {
    src: resolve(root, 'node_modules/@ffmpeg/core/dist/esm'),
    dest: resolve(root, 'public/ffmpeg-core-st'),
  },
]

for (const { src, dest } of copies) {
  if (!existsSync(src)) {
    console.warn(`[copy-ffmpeg-core] Source not found, skipping: ${src}`)
    continue
  }
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`[copy-ffmpeg-core] Copied ${src} → ${dest}`)
}
