// Tiny local web server for the built app (no extra packages needed).
// Usage: node scripts/serve.mjs [--open]   ->  http://localhost:4321
import { exec } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT) || 4321
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const url = `http://localhost:${PORT}`
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.onnx': 'application/octet-stream',
}

function openBrowser() {
  if (!process.argv.includes('--open')) return
  if (process.platform === 'win32') {
    // Edge "app" window looks like a normal program; fall back to the default browser.
    exec(`start "" msedge --app=${url}`, (err) => err && exec(`start "" ${url}`))
  } else if (process.platform === 'darwin') {
    // Chrome's app window if installed, otherwise the default browser (Safari).
    exec(`open -na "Google Chrome" --args --app=${url}`, (err) => err && exec(`open ${url}`))
  } else exec(`xdg-open ${url}`)
}

if (!existsSync(join(root, 'index.html'))) {
  console.error('The app is not built yet. Run install.bat (or: npm run build) first.')
  process.exit(1)
}

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url || '/', url).pathname)
  let file = normalize(join(root, path))
  if (!file.startsWith(root)) {
    res.writeHead(403).end()
    return
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (extname(path)) {
      res.writeHead(404).end()
      return
    }
    file = join(root, 'index.html')
  }
  res.writeHead(200, {
    'Content-Type': types[extname(file)] || 'application/octet-stream',
    'Content-Length': statSync(file).size,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cache-Control': file.endsWith('index.html') || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600',
  })
  createReadStream(file).pipe(res)
})

server.on('error', (err) => {
  // Already running (e.g. opened twice): just open the window.
  if (err.code === 'EADDRINUSE') {
    openBrowser()
    setTimeout(() => process.exit(0), 1500)
  } else throw err
})

server.listen(PORT, () => {
  console.log(`Worksheet Studio is running at ${url}`)
  openBrowser()
})
