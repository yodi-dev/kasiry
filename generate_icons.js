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

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

function blendOver(bg, fg, alpha) {
  const a = Math.max(0, Math.min(1, alpha))
  return [
    bg[0] * (1 - a) + fg[0] * a,
    bg[1] * (1 - a) + fg[1] * a,
    bg[2] * (1 - a) + fg[2] * a
  ]
}

// Render ikon PNG dengan 4x4 SSAA anti-aliasing sesuai sistem desain Kasiry (Midnight Navy & Azure Sky)
function generateIconPng(size, { fullBleed = false } = {}) {
  const width = size
  const height = size
  const rowBytes = 1 + width * 4
  const rawData = Buffer.alloc(rowBytes * height)
  const scale = size / 512
  const cornerRadius = fullBleed ? 0 : 124
  const subSamples = 4
  const invSub = 1 / (subSamples * subSamples)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes
    rawData[rowOffset] = 0 // Filter 0

    for (let x = 0; x < width; x++) {
      let accR = 0
      let accG = 0
      let accB = 0
      let accA = 0

      for (let sy = 0; sy < subSamples; sy++) {
        for (let sx = 0; sx < subSamples; sx++) {
          const px = (x + (sx + 0.5) / subSamples) / scale
          const py = (y + (sy + 0.5) / subSamples) / scale

          let insideBg = true
          if (!fullBleed) {
            const dx = Math.max(0, Math.max(cornerRadius - px, px - (512 - cornerRadius)))
            const dy = Math.max(0, Math.max(cornerRadius - py, py - (512 - cornerRadius)))
            if (Math.hypot(dx, dy) > cornerRadius) {
              insideBg = false
            }
          }

          if (!insideBg) continue

          // Background gradient: bottom-left (#061029) -> top-right (#133173)
          const diagT = Math.max(0, Math.min(1, (px + (512 - py)) / 1024))
          let col = [
            lerp(0x06, 0x13, diagT),
            lerp(0x10, 0x31, diagT),
            lerp(0x29, 0x73, diagT)
          ]

          // Subtle Azure/Sky radial aura at top-right (400, 102)
          const glowDist = Math.hypot(px - 400, py - 102) / 340
          if (glowDist < 1) {
            const glowAlpha = (1 - glowDist) * (1 - glowDist) * 0.28
            col = blendOver(col, [0x38, 0xbd, 0xf8], glowAlpha)
          }

          // Subtle inner luminous edge ring for squircle icons
          if (!fullBleed && px >= 7 && px <= 505 && py >= 7 && py <= 505) {
            const innerR = 116
            const idx = Math.max(0, Math.max(innerR - (px - 8), (px - 8) - (496 - innerR)))
            const idy = Math.max(0, Math.max(innerR - (py - 8), (py - 8) - (496 - innerR)))
            const borderDist = Math.abs(Math.hypot(idx, idy) - innerR)
            if (borderDist <= 1.5) {
              col = blendOver(col, [0x38, 0xbd, 0xf8], 0.22)
            }
          }

          // Lettermark K (seamless shared pivot at 196, 260):
          // 1. Spine (White #FFFFFF): (158, 132) -> (158, 380), r=32
          const dSpine = distToSeg(px, py, 158, 132, 158, 380)
          // 2. Lower leg (White #FFFFFF): (196, 260) -> (358, 380), r=32
          const dLower = distToSeg(px, py, 196, 260, 358, 380)
          if (dSpine <= 32 || dLower <= 32) {
            col = [255, 255, 255]
          }

          // 3. Upper Check Arm (Azure -> Luminous Sky Blue): (196, 260) -> (362, 132), r=32
          const dUpper = distToSeg(px, py, 196, 260, 362, 132)
          if (dUpper <= 32) {
            const armT = Math.max(0, Math.min(1, (px - 196) / (362 - 196)))
            col = [
              lerp(0x02, 0x7d, armT),
              lerp(0x84, 0xd3, armT),
              lerp(0xc7, 0xfc, armT)
            ]
          }

          accR += col[0]
          accG += col[1]
          accB += col[2]
          accA += 255
        }
      }

      const pixelOffset = rowOffset + 1 + x * 4
      if (accA > 0) {
        rawData[pixelOffset] = Math.round(accR / (accA / 255))
        rawData[pixelOffset + 1] = Math.round(accG / (accA / 255))
        rawData[pixelOffset + 2] = Math.round(accB / (accA / 255))
        rawData[pixelOffset + 3] = Math.round(accA * invSub)
      } else {
        rawData[pixelOffset] = 0
        rawData[pixelOffset + 1] = 0
        rawData[pixelOffset + 2] = 0
        rawData[pixelOffset + 3] = 0
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8
  ihdrData[9] = 6
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0
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

console.log('Menghasilkan aset ikon brand baru Kasiry (Midnight Navy & Azure Sky)...')
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generateIconPng(192))
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generateIconPng(512))
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generateIconPng(180, { fullBleed: true }))
fs.writeFileSync(path.join(publicDir, 'kasiry-oauth-120x120.png'), generateIconPng(120, { fullBleed: true }))
console.log('Selesai! pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png, dan kasiry-oauth-120x120.png siap di public/.')
