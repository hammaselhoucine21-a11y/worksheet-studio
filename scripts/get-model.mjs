// Downloads the free LaMa "magic eraser" model (about 200 MB) into public/models once.
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'models', 'lama_fp32.onnx')

if (existsSync(out) && statSync(out).size > 100_000_000) {
  console.log('Magic eraser model is already downloaded.')
  process.exit(0)
}

mkdirSync(dirname(out), { recursive: true })
console.log('Downloading the magic eraser model (about 200 MB). This happens only once...')
const res = await fetch(URL)
if (!res.ok || !res.body) {
  console.error(`Download failed: ${res.status} ${res.statusText}`)
  process.exit(1)
}
const total = Number(res.headers.get('content-length')) || 0
let done = 0
let lastPct = -1
const body = Readable.fromWeb(res.body)
body.on('data', (chunk) => {
  done += chunk.length
  const pct = total ? Math.floor((done / total) * 100) : 0
  if (pct !== lastPct && pct % 5 === 0) {
    lastPct = pct
    process.stdout.write(`\r  ${pct}%  (${(done / 1e6).toFixed(0)} MB)`)
  }
})
const tmp = out + '.part'
await pipeline(body, createWriteStream(tmp))
renameSync(tmp, out)
console.log('\nDone.')
