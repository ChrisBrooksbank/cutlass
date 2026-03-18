import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeBuffer, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcData), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function createPNG(size, bgR, bgG, bgB) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // RGB
  const ihdrChunk = makeChunk('IHDR', ihdr)

  const rowSize = 1 + size * 3
  const rawData = Buffer.alloc(rowSize * size)
  const cx = size / 2
  const cy = size / 2

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize
    rawData[rowOffset] = 0 // no filter
    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 3
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)

      const outerR = cx * 0.55
      const innerR = cx * 0.32
      const isInRing = dist > innerR && dist < outerR
      const isOpenSide = angle > -0.7 && angle < 0.7
      const isLetter = isInRing && !isOpenSide

      if (isLetter) {
        rawData[px] = 74
        rawData[px + 1] = 158
        rawData[px + 2] = 255
      } else {
        rawData[px] = bgR
        rawData[px + 1] = bgG
        rawData[px + 2] = bgB
      }
    }
  }

  const compressed = deflateSync(rawData)
  const idatChunk = makeChunk('IDAT', compressed)
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

writeFileSync('public/icons/icon-192.png', createPNG(192, 26, 26, 26))
writeFileSync('public/icons/icon-512.png', createPNG(512, 26, 26, 26))
writeFileSync('public/icons/icon-512-maskable.png', createPNG(512, 26, 26, 26))
console.log('Icons generated: 192x192, 512x512, 512x512-maskable')
