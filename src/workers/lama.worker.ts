/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web'

const REMOTE = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx'
const CACHE = 'worksheet-studio-models'
const S = 512

let session: ort.InferenceSession | null = null
let modelBytes: ArrayBuffer | null = null
let backend = ''

const post = (m: unknown, t: Transferable[] = []) => (self as unknown as Worker).postMessage(m, t)

async function readWithProgress(res: Response): Promise<ArrayBuffer> {
  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body) return res.arrayBuffer()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  let last = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    if (loaded - last > 2_000_000) {
      last = loaded
      post({ type: 'progress', loaded, total })
    }
  }
  const out = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out.buffer
}

async function fetchModel(base: string): Promise<ArrayBuffer> {
  // 1. The copy installed next to the app (install.bat puts it there).
  try {
    const r = await fetch(`${base}models/lama_fp32.onnx`)
    const type = r.headers.get('content-type') || ''
    if (r.ok && !type.includes('text/html')) return await readWithProgress(r)
  } catch {
    /* fall through to the internet copy */
  }
  // 2. A copy downloaded earlier into the browser cache.
  const cache = 'caches' in self ? await caches.open(CACHE).catch(() => null) : null
  const hit = await cache?.match(REMOTE)
  if (hit) return hit.arrayBuffer()
  // 3. Download once from Hugging Face.
  const r = await fetch(REMOTE)
  if (!r.ok) throw new Error(`Download failed (${r.status})`)
  const buf = await readWithProgress(r)
  await cache?.put(REMOTE, new Response(buf.slice(0))).catch(() => {})
  return buf
}

async function createSession(useGpu: boolean) {
  session = await ort.InferenceSession.create(modelBytes!, {
    executionProviders: useGpu ? ['webgpu', 'wasm'] : ['wasm'],
    graphOptimizationLevel: 'all',
  })
  backend = useGpu ? 'webgpu' : 'wasm'
}

async function load(base: string, gpu: boolean) {
  ort.env.wasm.numThreads = 1
  modelBytes = await fetchModel(base)
  post({ type: 'progress', loaded: 1, total: 1 })
  // The CPU path works everywhere. WebGPU can be switched on, but on some PCs it hangs with this model.
  try {
    await createSession(gpu && 'gpu' in navigator)
  } catch {
    await createSession(false)
  }
}

async function run(image: Float32Array, mask: Float32Array) {
  const go = async () => {
    const s = session!
    const feeds: Record<string, ort.Tensor> = {}
    for (const name of s.inputNames) {
      feeds[name] = name.includes('mask')
        ? new ort.Tensor('float32', mask, [1, 1, S, S])
        : new ort.Tensor('float32', image, [1, 3, S, S])
    }
    const out = await s.run(feeds)
    const data = out[s.outputNames[0]].data as Float32Array
    if (Number.isNaN(data[0])) throw new Error('bad output')
    return data
  }
  try {
    return await go()
  } catch (e) {
    if (backend !== 'webgpu') throw e
    await createSession(false)
    return go()
  }
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data
  if (m.type === 'load') {
    try {
      if (!session) await load(m.base, m.gpu)
      post({ type: 'ready', backend })
    } catch (err) {
      post({ type: 'loadError', error: String((err as Error)?.message || err) })
    }
  } else if (m.type === 'run') {
    try {
      const copy = new Float32Array(await run(m.image, m.mask))
      post({ type: 'result', id: m.id, data: copy }, [copy.buffer])
    } catch (err) {
      post({ type: 'runError', id: m.id, error: String((err as Error)?.message || err) })
    }
  }
}
