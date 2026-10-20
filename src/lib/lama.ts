import { useSyncExternalStore } from 'react'

/** The "magic eraser": LaMa inpainting running in a background worker. */
export interface LamaStatus {
  state: 'idle' | 'loading' | 'ready' | 'error'
  progress: number // 0..1 while downloading
  backend?: string
  error?: string
}

let status: LamaStatus = { state: 'idle', progress: 0 }
const listeners = new Set<() => void>()
let worker: Worker | null = null
let loading: Promise<void> | null = null
let nextId = 1
const pending = new Map<number, { resolve: (d: Float32Array) => void; reject: (e: Error) => void }>()

function setStatus(s: Partial<LamaStatus>) {
  status = { ...status, ...s }
  listeners.forEach((l) => l())
}

export const getLamaStatus = () => status

export function useLamaStatus() {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, getLamaStatus)
}

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('../workers/lama.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', (e: MessageEvent) => {
    const m = e.data
    if (m.type === 'progress') setStatus({ progress: m.total ? m.loaded / m.total : 0 })
    else if (m.type === 'result') pending.get(m.id)?.resolve(m.data)
    else if (m.type === 'runError') pending.get(m.id)?.reject(new Error(m.error))
    if (m.type === 'result' || m.type === 'runError') pending.delete(m.id)
  })
  return worker
}

/** Downloads (first time only) and starts the model. Safe to call many times. */
export function ensureLama(): Promise<void> {
  if (status.state === 'ready') return Promise.resolve()
  if (loading) return loading
  setStatus({ state: 'loading', progress: 0, error: undefined })
  const w = getWorker()
  loading = new Promise<void>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        w.removeEventListener('message', onMsg)
        setStatus({ state: 'ready', progress: 1, backend: e.data.backend })
        resolve()
      } else if (e.data.type === 'loadError') {
        w.removeEventListener('message', onMsg)
        setStatus({ state: 'error', error: e.data.error })
        loading = null
        reject(new Error(e.data.error))
      }
    }
    w.addEventListener('message', onMsg)
    let gpu = false
    try {
      gpu = localStorage.getItem('ws-gpu') === '1'
    } catch {
      /* storage blocked */
    }
    w.postMessage({ type: 'load', base: import.meta.env.BASE_URL, gpu })
  })
  return loading
}

export async function runLama(image: Float32Array, mask: Float32Array): Promise<Float32Array> {
  await ensureLama()
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ type: 'run', id, image, mask }, [image.buffer, mask.buffer])
  })
}
