// Generates the PWA/app icons as PNGs with no dependencies (hand-rolled PNG
// encoder). Re-run with: node scripts/generate-icons.mjs
import zlib from 'node:zlib'
import fs from 'node:fs'

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function png(size, pixel) {
  const w = size
  const h = size
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y)
      const o = y * (w * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const NAVY = [13, 27, 62, 255]
const BLUE = [61, 146, 214, 255]
const ORANGE = [255, 122, 61, 255]
const WHITE = [255, 255, 255, 255]

// A location/runner motif: navy field, blue ring, white halo, orange dot.
// Content stays within the maskable safe zone (~0.4 radius) and the field is
// full-bleed navy so it also works as a maskable icon.
function iconPixel(size) {
  const cx = size / 2
  const cy = size / 2
  const ringR = size * 0.3
  const ringW = size * 0.07
  const dotR = size * 0.12
  const halo = size * 0.02
  return (x, y) => {
    const d = Math.hypot(x - cx + 0.5, y - cy + 0.5)
    if (d <= dotR) return ORANGE
    if (d <= dotR + halo) return WHITE
    if (d >= ringR - ringW / 2 && d <= ringR + ringW / 2) return BLUE
    return NAVY
  }
}

const out = 'public'
fs.mkdirSync(out, { recursive: true })
for (const [file, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['pwa-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon.png', 64],
]) {
  fs.writeFileSync(`${out}/${file}`, png(size, iconPixel(size)))
  console.log('wrote', `${out}/${file}`)
}
