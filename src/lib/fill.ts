/**
 * Pure pixel helpers for clean-up: a quick non-AI fill and the tensor
 * conversions for the LaMa model (512 x 512, image 0..1, mask 0/1).
 */

/** Fills marked pixels from the outside in, averaging their known neighbours. */
export function smartFill(px: Uint8ClampedArray, w: number, h: number, mask: Uint8Array): void {
  const known = new Uint8Array(w * h)
  let todo: number[] = []
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) todo.push(i)
    else known[i] = 1
  }
  if (todo.length === w * h) {
    px.fill(255)
    return
  }
  while (todo.length) {
    const next: number[] = []
    const done: number[] = []
    const cols: number[] = []
    for (const i of todo) {
      const x = i % w
      const y = (i - x) / w
      let r = 0, g = 0, b = 0, n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if ((!dx && !dy) || nx < 0 || nx >= w) continue
          const j = ny * w + nx
          if (known[j]) {
            r += px[j * 4]
            g += px[j * 4 + 1]
            b += px[j * 4 + 2]
            n++
          }
        }
      }
      if (n) {
        done.push(i)
        cols.push(r / n, g / n, b / n)
      } else next.push(i)
    }
    if (!done.length) break
    for (let k = 0; k < done.length; k++) {
      const i = done[k]
      px[i * 4] = cols[k * 3]
      px[i * 4 + 1] = cols[k * 3 + 1]
      px[i * 4 + 2] = cols[k * 3 + 2]
      px[i * 4 + 3] = 255
      known[i] = 1
    }
    todo = next
  }
}

/** RGBA pixels + RGBA mask (alpha > 0 = erase) -> model inputs in CHW layout. */
export function toTensors(rgba: Uint8ClampedArray, maskRgba: Uint8ClampedArray, n: number) {
  const image = new Float32Array(3 * n)
  const mask = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    image[i] = rgba[i * 4] / 255
    image[n + i] = rgba[i * 4 + 1] / 255
    image[2 * n + i] = rgba[i * 4 + 2] / 255
    mask[i] = maskRgba[i * 4 + 3] > 0 ? 1 : 0
  }
  return { image, mask }
}

/** Model output (CHW, 0..255 or 0..1) -> RGBA pixels. */
export function fromOutput(out: Float32Array, n: number): Uint8ClampedArray {
  let max = 0
  for (let i = 0; i < out.length; i += 97) max = Math.max(max, out[i])
  const k = max <= 1.5 ? 255 : 1
  const rgba = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = out[i] * k
    rgba[i * 4 + 1] = out[n + i] * k
    rgba[i * 4 + 2] = out[2 * n + i] * k
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

/**
 * The AI fill can leave the paper a shade off (e.g. 252 instead of 255), which shows as a faint patch.
 * Finds the most common colour around the hole (the paper) and snaps filled pixels close to it back to it.
 */
export function snapToPaper(px: Uint8ClampedArray, mask: Uint8Array, tolerance = 14): void {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) continue
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    const bin = bins.get(key)
    if (bin) {
      bin.n++
      bin.r += r
      bin.g += g
      bin.b += b
    } else bins.set(key, { n: 1, r, g, b })
  }
  let best: { n: number; r: number; g: number; b: number } | null = null
  for (const bin of bins.values()) if (!best || bin.n > best.n) best = bin
  if (!best) return
  const pr = best.r / best.n, pg = best.g / best.n, pb = best.b / best.n
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const d = Math.max(Math.abs(px[i * 4] - pr), Math.abs(px[i * 4 + 1] - pg), Math.abs(px[i * 4 + 2] - pb))
    if (d <= tolerance) {
      px[i * 4] = pr
      px[i * 4 + 1] = pg
      px[i * 4 + 2] = pb
    }
  }
}

/** Makes near-white pixels see-through (for lifted pieces of a white page). */
export function whiteToClear(px: Uint8ClampedArray, threshold = 232): void {
  for (let i = 0; i < px.length; i += 4) {
    const m = Math.min(px[i], px[i + 1], px[i + 2])
    if (m >= threshold) px[i + 3] = 0
    else if (m > threshold - 30) px[i + 3] = Math.round(((threshold - m) / 30) * px[i + 3])
  }
}
