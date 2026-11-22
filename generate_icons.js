import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// PNG CRC32 table
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  crcTable[n] = c
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = data ? data.length : 0
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(len, 0)
  
  const toCrc = data ? Buffer.concat([typeBuf, data]) : typeBuf
  const crcVal = crc32(toCrc)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crcVal, 0)

  return Buffer.concat([lenBuf, toCrc, crcBuf])
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
}

function generatePng(size) {
  const width = size
  const height = size
  const rowBytes = 1 + width * 4
  const rawData = Buffer.alloc(rowBytes * height)

  const scale = size / 512
  const cornerRadius = 110 * scale

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes
    rawData[rowOffset] = 0 // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4

      // Rounded rectangle test for main canvas
      const dx = Math.max(0, Math.max(cornerRadius - x, x - (width - cornerRadius)))
      const dy = Math.max(0, Math.max(cornerRadius - y, y - (height - cornerRadius)))
      const outsideCorner = Math.hypot(dx, dy) > cornerRadius

      if (outsideCorner) {
        rawData[pixelOffset] = 0
        rawData[pixelOffset + 1] = 0
        rawData[pixelOffset + 2] = 0
        rawData[pixelOffset + 3] = 0
        continue
      }

      // Default Background: Kasiry Emerald Green (#2E7D32)
      let r = 0x2e
      let g = 0x7d
      let b = 0x32
      let a = 255

      // Subtly lighter green gradient at top
      const gradT = y / height
      r = Math.min(255, Math.floor(0x28 + (0x35 - 0x28) * (1 - gradT)))
      g = Math.min(255, Math.floor(0x75 + (0x8e - 0x75) * (1 - gradT)))
      b = Math.min(255, Math.floor(0x2d + (0x3c - 0x2d) * (1 - gradT)))

      const px = x / scale
      const py = y / scale

      // 1. Warung Traditional Roof (Golden Yellow #FBC02D)
      // Roof Triangle / Ridge: Peak at (256, 90), Left (76, 210), Right (436, 210)
      const distRoofLeft = distToSeg(px, py, 256, 95, 85, 210)
      const distRoofRight = distToSeg(px, py, 256, 95, 427, 210)
      const distRoofEaves = distToSeg(px, py, 85, 210, 427, 210)

      if (distRoofLeft <= 16 || distRoofRight <= 16 || (distRoofEaves <= 12 && px >= 85 && px <= 427)) {
        r = 0xfb; g = 0xc0; b = 0x2d // Gold Roof
      }

      // 2. Y Shape & Checkmark (Clean Crisp White #FFFFFF)
      // Left arm of Y: (140, 200) to (256, 320)
      const distLeftArm = distToSeg(px, py, 145, 210, 256, 320)
      // Right arm (thick check stroke): (375, 175) to (256, 320)
      const distRightArm = distToSeg(px, py, 375, 175, 256, 320)
      // Stem of Y: (256, 320) to (256, 420)
      const distStem = distToSeg(px, py, 256, 320, 256, 420)

      if (distLeftArm <= 20 || distRightArm <= 24 || distStem <= 20) {
        r = 255; g = 255; b = 255
      }

      // 3. Central Golden Coin Accent Circle at (256, 265)
      const distCoin = Math.hypot(px - 256, py - 265)
      if (distCoin <= 26) {
        r = 0xf5; g = 0x9e; b = 0x0b // Golden Amber
      }

      rawData[pixelOffset] = r
      rawData[pixelOffset + 1] = g
      rawData[pixelOffset + 2] = b
      rawData[pixelOffset + 3] = a
    }
  }

  // PNG Construction
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8  // bit depth
  ihdrData[9] = 6  // color type RGBA
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData)

  const compressedData = zlib.deflateSync(rawData, { level: 9 })
  const idatChunk = makeChunk('IDAT', compressedData)
  const iendChunk = makeChunk('IEND', null)

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

const publicDir = path.resolve('public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

console.log('Menghasilkan ikon PWA Kasiry...')
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192))
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512))
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180))
console.log('Ikon PWA berhasil dibuat di folder public!')
