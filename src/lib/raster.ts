import { fromOutput, smartFill, snapToPaper, toTensors, whiteToClear } from './fill'
import { maskBBox, regionAround } from './geometry'
import { runLama } from './lama'
import type { Rect, Stroke } from './types'

const cache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not open this picture'))
      img.src = src
    })
    cache.set(src, p)
    if (cache.size > 80) cache.delete(cache.keys().next().value!)
  }
  return p
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!

export async function imageToCanvas(src: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(src)
  const c = makeCanvas(img.naturalWidth, img.naturalHeight)
  ctx2d(c).drawImage(img, 0, 0)
  return c
}

export function canvasToUrl(c: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error('Could not save picture'))), 'image/png'),
  )
}

/** Opens a user's file as a picture, shrinking very large photos so phones stay fast. */
export async function fileToBase(file: Blob, maxSide = 3000) {
  const url = URL.createObjectURL(file)
  const img = await loadImage(url)
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const c = makeCanvas(Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s))
  const g = ctx2d(c)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0, c.width, c.height)
  return { url: await canvasToUrl(c), width: c.width, height: c.height }
}

/** Opens a file as a movable piece (keeps transparency), sized to fit maxSide. */
export async function fileToPiece(file: Blob, maxSide = 1600) {
  const url = URL.createObjectURL(file)
  const img = await loadImage(url)
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const c = makeCanvas(Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s))
  ctx2d(c).drawImage(img, 0, 0, c.width, c.height)
  return { url: await canvasToUrl(c), width: c.width, height: c.height }
}

export async function cropImage(src: string, r: Rect): Promise<string> {
  const img = await loadImage(src)
  const c = makeCanvas(r.width, r.height)
  ctx2d(c).drawImage(img, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
  return canvasToUrl(c)
}

function drawStrokes(g: CanvasRenderingContext2D, strokes: Stroke[], color: string, extra = 0) {
  g.strokeStyle = g.fillStyle = color
  g.lineCap = g.lineJoin = 'round'
  for (const s of strokes) {
    const p = s.points
    g.lineWidth = s.size + extra
    if (p.length <= 2) {
      g.beginPath()
      g.arc(p[0], p[1], (s.size + extra) / 2, 0, Math.PI * 2)
      g.fill()
      continue
    }
    g.beginPath()
    g.moveTo(p[0], p[1])
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1])
    g.stroke()
  }
}

/** Paint brush: draws the strokes onto the picture in one colour. */
export async function paintStrokes(src: string, strokes: Stroke[], color: string): Promise<string> {
  const c = await imageToCanvas(src)
  drawStrokes(ctx2d(c), strokes, color)
  return canvasToUrl(c)
}

/** Reads the colour of one pixel (for the "pick colour" button). */
export async function pickColor(src: string, x: number, y: number): Promise<string> {
  const img = await loadImage(src)
  const c = makeCanvas(1, 1)
  const g = ctx2d(c)
  g.drawImage(img, Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1)
  const d = g.getImageData(0, 0, 1, 1).data
  return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function strokesMask(w: number, h: number, strokes: Stroke[]): HTMLCanvasElement {
  const m = makeCanvas(w, h)
  // A little wider than the visible marks so the edges of the old content are covered too.
  drawStrokes(ctx2d(m), strokes, '#fff', 8)
  return m
}

export function rectMask(w: number, h: number, r: Rect): HTMLCanvasElement {
  const m = makeCanvas(w, h)
  const g = ctx2d(m)
  g.fillStyle = '#fff'
  g.fillRect(r.x - 2, r.y - 2, r.width + 4, r.height + 4)
  return m
}

const MODEL_SIZE = 512

/**
 * Removes whatever the mask covers. With useAI the LaMa model repaints the area;
 * otherwise the quick fill blends in the surrounding colours.
 */
export async function inpaint(src: string, maskCanvas: HTMLCanvasElement, useAI: boolean): Promise<string> {
  const base = await imageToCanvas(src)
  const W = base.width
  const H = base.height
  const md = ctx2d(maskCanvas).getImageData(0, 0, W, H).data
  const m = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) m[i] = md[i * 4 + 3] > 0 ? 1 : 0
  const bb = maskBBox(m, W, H)
  if (!bb) return src

  const R = regionAround(bb, W, H)
  const g = ctx2d(base)
  const region = g.getImageData(R.x, R.y, R.width, R.height)
  const rm = new Uint8Array(R.width * R.height)
  for (let y = 0; y < R.height; y++)
    for (let x = 0; x < R.width; x++) rm[y * R.width + x] = m[(R.y + y) * W + R.x + x]

  if (useAI) {
    const S = MODEL_SIZE
    const ic = makeCanvas(S, S)
    const icg = ctx2d(ic)
    icg.imageSmoothingQuality = 'high'
    icg.drawImage(base, R.x, R.y, R.width, R.height, 0, 0, S, S)
    const mc = makeCanvas(S, S)
    ctx2d(mc).drawImage(maskCanvas, R.x, R.y, R.width, R.height, 0, 0, S, S)
    const { image, mask } = toTensors(icg.getImageData(0, 0, S, S).data, ctx2d(mc).getImageData(0, 0, S, S).data, S * S)
    const out = await runLama(image, mask)
    const oc = makeCanvas(S, S)
    const pixels = fromOutput(out, S * S)
    const outData = new ImageData(S, S)
    outData.data.set(pixels)
    ctx2d(oc).putImageData(outData, 0, 0)
    const back = makeCanvas(R.width, R.height)
    const bg = ctx2d(back)
    bg.imageSmoothingQuality = 'high'
    bg.drawImage(oc, 0, 0, S, S, 0, 0, R.width, R.height)
    const res = bg.getImageData(0, 0, R.width, R.height).data
    for (let i = 0; i < rm.length; i++) {
      if (!rm[i]) continue
      region.data[i * 4] = res[i * 4]
      region.data[i * 4 + 1] = res[i * 4 + 1]
      region.data[i * 4 + 2] = res[i * 4 + 2]
      region.data[i * 4 + 3] = 255
    }
    snapToPaper(region.data, rm)
  } else {
    smartFill(region.data, R.width, R.height, rm)
  }
  g.putImageData(region, R.x, R.y)
  return canvasToUrl(base)
}

export async function makeWhiteClear(src: string): Promise<string> {
  const c = await imageToCanvas(src)
  const g = ctx2d(c)
  const d = g.getImageData(0, 0, c.width, c.height)
  whiteToClear(d.data)
  g.putImageData(d, 0, 0)
  return canvasToUrl(c)
}
