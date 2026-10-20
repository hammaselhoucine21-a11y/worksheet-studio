import { useCallback, useState } from 'react'

export interface Hist<T> {
  past: T[]
  present: T
  future: T[]
  mergeKey: string | null
}

const LIMIT = 30

export const initHistory = <T,>(present: T): Hist<T> => ({ past: [], present, future: [], mergeKey: null })

/** Records a new state. Consecutive commits with the same mergeKey (e.g. typing) become one undo step. */
export function commit<T>(h: Hist<T>, next: T, mergeKey: string | null = null): Hist<T> {
  if (mergeKey && h.mergeKey === mergeKey) return { ...h, present: next, future: [] }
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [], mergeKey }
}

export function undo<T>(h: Hist<T>): Hist<T> {
  if (!h.past.length) return h
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], mergeKey: null }
}

export function redo<T>(h: Hist<T>): Hist<T> {
  if (!h.future.length) return h
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), mergeKey: null }
}

export function useHistory<T>(initial: T) {
  const [h, setH] = useState(() => initHistory(initial))
  const set = useCallback((next: T, mergeKey: string | null = null) => setH((cur) => commit(cur, next, mergeKey)), [])
  return {
    present: h.present,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    set,
    undo: useCallback(() => setH(undo), []),
    redo: useCallback(() => setH(redo), []),
  }
}
