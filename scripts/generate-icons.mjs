// Rasterises public/icon.svg into every PNG the PWA + browsers reference.
// Run with: node scripts/generate-icons.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const svg = readFileSync(join(pub, 'icon.svg'))

// filename -> rendered pixel size
const targets = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'icon-512-maskable.png': 512, // full-bleed bg, safe for maskable
  'apple-touch-icon.png': 180,
  'favicon-32.png': 32,
}

for (const [file, size] of Object.entries(targets)) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(pub, file))
  console.log(`wrote public/${file}`)
}
