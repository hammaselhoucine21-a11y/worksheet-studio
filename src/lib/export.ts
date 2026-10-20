import Konva from 'konva'
import { jsPDF } from 'jspdf'
import { itemAttrs } from './items'
import { loadImage } from './raster'
import type { Doc } from './types'

/** Draws the whole worksheet (picture + all pieces) onto one canvas. */
export async function renderDoc(doc: Doc, maxSide?: number): Promise<HTMLCanvasElement> {
  await document.fonts.ready
  const div = document.createElement('div')
  const stage = new Konva.Stage({ container: div, width: doc.width, height: doc.height })
  const layer = new Konva.Layer()
  stage.add(layer)
  layer.add(new Konva.Rect({ width: doc.width, height: doc.height, fill: '#fff' }))
  layer.add(new Konva.Image({ image: await loadImage(doc.base), width: doc.width, height: doc.height }))
  for (const it of doc.items) {
    if (it.kind === 'image') layer.add(new Konva.Image({ ...itemAttrs(it), image: await loadImage(it.src!) }))
    else layer.add(new Konva.Text(itemAttrs(it)))
  }
  const scale = maxSide ? Math.min(1, maxSide / Math.max(doc.width, doc.height)) : 1
  const canvas = stage.toCanvas({ pixelRatio: scale })
  stage.destroy()
  return canvas
}

function download(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function savePng(doc: Doc, name: string) {
  const c = await renderDoc(doc)
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
  const url = URL.createObjectURL(blob)
  download(url, `${name}.png`)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** A4 page, picture fitted inside small margins, portrait or landscape to match the picture. */
export async function savePdf(doc: Doc, name: string) {
  const c = await renderDoc(doc)
  const landscape = doc.width > doc.height
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const pw = landscape ? 297 : 210
  const ph = landscape ? 210 : 297
  const m = 8
  const s = Math.min((pw - 2 * m) / doc.width, (ph - 2 * m) / doc.height)
  const w = doc.width * s
  const h = doc.height * s
  pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h)
  pdf.save(`${name}.pdf`)
}

export async function printDoc(doc: Doc) {
  const c = await renderDoc(doc)
  const landscape = doc.width > doc.height
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const d = frame.contentDocument!
  d.open()
  d.write(`<!doctype html><html><head><style>
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 8mm; }
    html, body { margin: 0; height: 100%; }
    img { display: block; width: 100%; height: 100%; object-fit: contain; }
  </style></head><body><img src="${c.toDataURL('image/png')}"></body></html>`)
  d.close()
  const img = d.querySelector('img')!
  await new Promise((r) => (img.complete ? r(null) : (img.onload = () => r(null))))
  frame.contentWindow!.focus()
  frame.contentWindow!.print()
  setTimeout(() => frame.remove(), 60_000)
}
