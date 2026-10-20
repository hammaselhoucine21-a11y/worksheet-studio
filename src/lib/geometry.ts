import type { Item, Rect } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function normRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

/** Rounds a rectangle to whole pixels and keeps it inside a W x H picture. */
export function clampRect(r: Rect, W: number, H: number): Rect {
  const x = clamp(Math.round(r.x), 0, W - 1)
  const y = clamp(Math.round(r.y), 0, H - 1)
  const width = clamp(Math.round(r.width), 1, W - x)
  const height = clamp(Math.round(r.height), 1, H - y)
  return { x, y, width, height }
}

/** Largest centred rectangle with the given width/height ratio that fits in W x H. */
export function fitAspect(W: number, H: number, ratio: number): Rect {
  let width = W
  let height = W / ratio
  if (height > H) {
    height = H
    width = H * ratio
  }
  return { x: (W - width) / 2, y: (H - height) / 2, width, height }
}

/** Area around the brushed marks that the AI looks at: the marks plus some surroundings. */
export function regionAround(b: Rect, W: number, H: number): Rect {
  const pad = Math.max(48, Math.round(Math.max(b.width, b.height) * 0.25))
  const width = Math.min(W, Math.max(b.width + pad * 2, Math.min(256, W)))
  const height = Math.min(H, Math.max(b.height + pad * 2, Math.min(256, H)))
  const x = clamp(Math.round(b.x + b.width / 2 - width / 2), 0, W - width)
  const y = clamp(Math.round(b.y + b.height / 2 - height / 2), 0, H - height)
  return { x, y, width: Math.round(width), height: Math.round(height) }
}

/** Bounding box of the set pixels of a W x H mask (1 = marked), or null if empty. */
export function maskBBox(mask: Uint8Array, W: number, H: number): Rect | null {
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) {
    const row = y * W
    for (let x = 0; x < W; x++) {
      if (mask[row + x]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

export const shiftItems = (items: Item[], dx: number, dy: number): Item[] =>
  items.map((it) => ({ ...it, x: it.x + dx, y: it.y + dy }))
