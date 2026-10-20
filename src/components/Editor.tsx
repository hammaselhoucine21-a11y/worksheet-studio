import { useEffect, useRef, useState } from 'react'
import { printDoc, renderDoc, savePdf, savePng } from '../lib/export'
import { clampRect, fitAspect, shiftItems } from '../lib/geometry'
import { useHistory } from '../lib/history'
import { COLORS, FONTS } from '../lib/items'
import { ensureLama, getLamaStatus, useLamaStatus } from '../lib/lama'
import { cropImage, fileToPiece, inpaint, makeWhiteClear, paintStrokes, pickColor, rectMask, strokesMask } from '../lib/raster'
import { EMOJI, SHAPES, type Sticker } from '../lib/stickers'
import { saveProject, type ProjectMeta } from '../lib/storage'
import { uid, type Doc, type Item, type Rect, type Stroke, type Tool } from '../lib/types'
import { EditorCanvas } from './EditorCanvas'
import type { OpenProject } from './Home'
import { Icon, type IconName } from './Icons'

const TOOLS: { id: Tool; label: string; icon: IconName }[] = [
  { id: 'crop', label: 'Crop', icon: 'crop' },
  { id: 'clean', label: 'Clean up', icon: 'clean' },
  { id: 'select', label: 'Select & Move', icon: 'select' },
  { id: 'text', label: 'Text', icon: 'text' },
  { id: 'stickers', label: 'Stickers', icon: 'stickers' },
  { id: 'export', label: 'Print / Save', icon: 'export' },
]

const BRUSH = { S: 0.012, M: 0.025, L: 0.05 } as const
const TEXT_SIZE = { S: 0.022, M: 0.035, L: 0.055, XL: 0.085 } as const
const CROP_PRESETS = [
  { label: 'Free', ratio: null },
  { label: 'Square', ratio: 1 },
  { label: 'A4 tall', ratio: 210 / 297 },
  { label: 'A4 wide', ratio: 297 / 210 },
]

export function Editor({ project, onHome }: { project: OpenProject; onHome: () => void }) {
  const h = useHistory<Doc>(project.doc)
  const doc = h.present
  const docRef = useRef(doc)
  docRef.current = doc
  const [meta, setMeta] = useState<ProjectMeta>(project.meta)
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const lama = useLamaStatus()

  // Clean up
  const [cleanMode, setCleanMode] = useState<'ai' | 'brush'>('ai')
  const [brushKey, setBrushKey] = useState<keyof typeof BRUSH>('M')
  const [brushColor, setBrushColor] = useState('#ffffff')
  const [pickedColor, setPickedColor] = useState<string | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [picking, setPicking] = useState(false)
  // Crop
  const [crop, setCrop] = useState<Rect | null>(null)
  const [cropRatio, setCropRatio] = useState<number | null>(null)
  // Select
  const [selRect, setSelRect] = useState<Rect | null>(null)
  // Text
  const [draft, setDraft] = useState('')
  const [font, setFont] = useState<string>(FONTS[0].family)
  const [sizeKey, setSizeKey] = useState<keyof typeof TEXT_SIZE>('L')
  const [color, setColor] = useState(COLORS[0])

  const W = doc.width
  const H = doc.height
  const big = Math.max(W, H)
  const brushSize = Math.max(4, Math.round(big * BRUSH[brushKey]))
  const selected = doc.items.find((i) => i.id === selectedId) ?? null

  const toastTimer = useRef(0)
  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }

  // Picture changes run one after another so quick brush strokes never overwrite each other.
  const queue = useRef(Promise.resolve())
  function runOp(label: string | null, fn: (d: Doc) => Promise<Doc | null>) {
    queue.current = queue.current.then(async () => {
      if (label) setBusy(label)
      try {
        const next = await fn(docRef.current)
        if (next) {
          docRef.current = next
          h.set(next)
        }
      } catch (e) {
        showToast(`Sorry, that did not work. ${(e as Error).message || ''}`)
      } finally {
        if (label) setBusy(null)
      }
    })
  }

  /** Removes the masked area: AI when available, otherwise the quick fill. */
  async function removeArea(d: Doc, mask: HTMLCanvasElement, waitForAI: boolean) {
    let ai = getLamaStatus().state === 'ready'
    if (!ai && waitForAI) {
      try {
        await ensureLama()
        ai = true
      } catch {
        showToast('The magic eraser could not start, so a quick fill was used instead.')
      }
    }
    try {
      return await inpaint(d.base, mask, ai)
    } catch {
      if (!ai) throw new Error('')
      showToast('The magic eraser had a problem, so a quick fill was used instead.')
      return inpaint(d.base, mask, false)
    }
  }

  function changeTool(t: Tool) {
    setStrokes([])
    setSelRect(null)
    setPicking(false)
    if (t !== 'select' && t !== 'text' && t !== 'stickers') setSelectedId(null)
    if (t === 'crop') {
      const inset = 0.04
      setCropRatio(null)
      setCrop({ x: W * inset, y: H * inset, width: W * (1 - 2 * inset), height: H * (1 - 2 * inset) })
    }
    if (t === 'clean' || t === 'select') ensureLama().catch(() => {})
    setTool(t)
  }

  // ---------- items ----------
  const patchItem = (id: string, patch: Partial<Item>, mergeKey: string | null = null) =>
    h.set({ ...docRef.current, items: docRef.current.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }, mergeKey)

  function addItem(it: Item) {
    h.set({ ...docRef.current, items: [...docRef.current.items, it] })
    setSelectedId(it.id)
  }

  const blank = { rotation: 0, scaleX: 1, scaleY: 1 }

  function deleteSelected() {
    if (!selectedId) return
    h.set({ ...doc, items: doc.items.filter((i) => i.id !== selectedId) })
    setSelectedId(null)
  }
  function duplicateSelected() {
    if (!selected) return
    addItem({ ...selected, id: uid(), x: selected.x + big * 0.03, y: selected.y + big * 0.03 })
  }
  function toFront() {
    if (!selected) return
    h.set({ ...doc, items: [...doc.items.filter((i) => i.id !== selected.id), selected] })
  }

  // ---------- text ----------
  useEffect(() => {
    if (selected?.kind === 'text') {
      setDraft(selected.text ?? '')
      setFont(selected.fontFamily ?? FONTS[0].family)
      setColor(selected.fill ?? COLORS[0])
    }
    // Only when a different piece gets selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const editingText = tool === 'text' && selected?.kind === 'text' ? selected : null
  function addText() {
    const fontSize = Math.round(big * TEXT_SIZE[sizeKey])
    const text = draft.trim() || 'Your text'
    addItem({ id: uid(), kind: 'text', text, fontSize, fontFamily: font, fill: color, x: W / 2 - text.length * fontSize * 0.25, y: H / 2 - fontSize / 2, ...blank })
  }
  function textStyle(patch: Partial<Item>) {
    if (editingText) patchItem(editingText.id, patch)
  }

  // ---------- stickers ----------
  function addSticker(s: Sticker) {
    if (s.kind === 'emoji') {
      const fontSize = Math.round(big * 0.07)
      addItem({ id: uid(), kind: 'text', text: s.value, fontSize, fontFamily: 'Andika', fill: '#222', x: W / 2 - fontSize / 2, y: H / 2 - fontSize / 2, ...blank })
    } else {
      const width = W * (s.w > s.h * 1.5 ? 0.4 : 0.2)
      const height = (width * s.h) / s.w
      addItem({ id: uid(), kind: 'image', src: s.value, width, height, x: W / 2 - width / 2, y: H / 2 - height / 2, ...blank })
    }
  }
  const photoInput = useRef<HTMLInputElement>(null)
  async function addPhoto(file?: File) {
    if (!file) return
    try {
      const p = await fileToPiece(file)
      const width = Math.min(W * 0.4, p.width)
      const height = (width * p.height) / p.width
      addItem({ id: uid(), kind: 'image', src: p.url, width, height, x: W / 2 - width / 2, y: H / 2 - height / 2, ...blank })
    } catch {
      showToast('Sorry, that picture could not be added.')
    }
  }

  // ---------- crop ----------
  function chooseRatio(ratio: number | null) {
    setCropRatio(ratio)
    if (ratio === null) setCrop({ x: 0, y: 0, width: W, height: H })
    else setCrop(fitAspect(W, H, ratio))
  }
  function applyCrop() {
    if (!crop) return
    const r = clampRect(crop, W, H)
    runOp('Cropping…', async (d) => ({
      ...d,
      base: await cropImage(d.base, r),
      width: r.width,
      height: r.height,
      items: shiftItems(d.items, -r.x, -r.y),
    }))
    setCrop(null)
    setTool('select')
  }

  // ---------- clean up ----------
  function onStroke(s: Stroke) {
    if (cleanMode === 'ai') setStrokes((st) => [...st, s])
    else {
      const c = brushColor
      runOp(null, async (d) => ({ ...d, base: await paintStrokes(d.base, [s], c) }))
    }
  }
  function eraseMarks() {
    if (!strokes.length) return showToast('First paint over the thing you want to remove.')
    const marks = strokes
    runOp('Erasing…', async (d) => {
      const base = await removeArea(d, strokesMask(d.width, d.height, marks), true)
      setStrokes([])
      return { ...d, base }
    })
  }
  async function onPick(pt: { x: number; y: number }) {
    setPicking(false)
    const c = await pickColor(doc.base, pt.x, pt.y)
    setPickedColor(c)
    setBrushColor(c)
  }

  // ---------- select ----------
  function liftSelection(keepOriginal: boolean) {
    const r = selRect
    if (!r) return
    setSelRect(null)
    runOp(keepOriginal ? 'Copying…' : 'Cutting out…', async (d) => {
      const src = await cropImage(d.base, r)
      const id = uid()
      const shift = keepOriginal ? big * 0.03 : 0
      const piece: Item = { id, kind: 'image', src, width: r.width, height: r.height, x: r.x + shift, y: r.y + shift, ...blank }
      const base = keepOriginal ? d.base : await removeArea(d, rectMask(d.width, d.height, r), false)
      setSelectedId(id)
      return { ...d, base, items: [...d.items, piece] }
    })
    if (!keepOriginal) showToast('Now drag the piece wherever you want it.')
  }
  function eraseSelection() {
    const r = selRect
    if (!r) return
    setSelRect(null)
    runOp('Erasing…', async (d) => ({ ...d, base: await removeArea(d, rectMask(d.width, d.height, r), true) }))
  }
  function seeThrough() {
    if (!selected || selected.kind !== 'image') return
    const id = selected.id
    const src = selected.src!
    runOp('Working…', async (d) => {
      const out = await makeWhiteClear(src)
      return { ...d, items: d.items.map((it) => (it.id === id ? { ...it, src: out } : it)) }
    })
  }

  // ---------- export ----------
  const fileName = meta.name.replace(/[\\/:*?"<>|]/g, '') || 'worksheet'
  function exportAs(kind: 'print' | 'pdf' | 'png') {
    setSelectedId(null)
    runOp(kind === 'print' ? 'Getting ready to print…' : 'Saving…', async (d) => {
      if (kind === 'print') await printDoc(d)
      else if (kind === 'pdf') await savePdf(d, fileName)
      else await savePng(d, fileName)
      return null
    })
  }
  function rename() {
    const n = prompt('Name for this worksheet:', meta.name)
    if (n && n.trim()) setMeta((m) => ({ ...m, name: n.trim() }))
  }

  // ---------- autosave ----------
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setSaved(false)
    const t = setTimeout(async () => {
      try {
        const thumb = (await renderDoc(doc, 360)).toDataURL('image/jpeg', 0.8)
        await saveProject({ ...meta, updated: Date.now(), thumb }, doc)
        setSaved(true)
      } catch {
        /* storage full or private window: keep editing anyway */
      }
    }, 900)
    return () => clearTimeout(t)
  }, [doc, meta])

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) h.redo()
        else h.undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        h.redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && selectedId) {
        e.preventDefault()
        deleteSelected()
      } else if (e.key === 'Escape') {
        setSelectedId(null)
        setSelRect(null)
        setPicking(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------- panels ----------
  const lamaLine =
    lama.state === 'ready'
      ? 'Magic eraser is ready.'
      : lama.state === 'loading'
        ? lama.progress >= 1
          ? 'Starting the magic eraser… (the first time takes a little while)'
          : `Getting the magic eraser ready… ${Math.round(lama.progress * 100)}%`
        : lama.state === 'error'
          ? 'Magic eraser is not available right now. A quick fill will be used (best on white paper).'
          : ''

  function itemButtons() {
    if (!selected) return null
    return (
      <div className="row">
        {selected.kind === 'text' && tool !== 'text' && (
          <button className="btn" onClick={() => changeTool('text')}>
            <Icon name="text" /> Change text
          </button>
        )}
        {selected.kind === 'image' && (
          <button className="btn" onClick={seeThrough}>
            <Icon name="see" /> Make white see-through
          </button>
        )}
        <button className="btn" onClick={duplicateSelected}>
          <Icon name="copy" /> Copy
        </button>
        <button className="btn" onClick={toFront}>
          <Icon name="front" /> To front
        </button>
        <button className="btn danger" onClick={deleteSelected}>
          <Icon name="trash" /> Delete
        </button>
        <button className="btn" onClick={() => setSelectedId(null)}>
          <Icon name="check" /> Done
        </button>
      </div>
    )
  }

  function panel() {
    switch (tool) {
      case 'crop':
        return (
          <>
            <p className="hint">Drag the white corners to choose what to keep. Everything in the dark part is cut off.</p>
            <div className="row">
              {CROP_PRESETS.map((pr) => (
                <button key={pr.label} className={`chip ${cropRatio === pr.ratio ? 'on' : ''}`} onClick={() => chooseRatio(pr.ratio)}>
                  {pr.label}
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn" onClick={() => changeTool('select')}>
                <Icon name="close" /> Cancel
              </button>
              <button className="btn primary" onClick={applyCrop}>
                <Icon name="check" /> Done cropping
              </button>
            </div>
          </>
        )
      case 'clean':
        return (
          <>
            <div className="seg">
              <button className={cleanMode === 'ai' ? 'on' : ''} onClick={() => setCleanMode('ai')}>
                <Icon name="wand" /> Magic eraser
              </button>
              <button className={cleanMode === 'brush' ? 'on' : ''} onClick={() => { setCleanMode('brush'); setStrokes([]) }}>
                <Icon name="brush" /> Paint brush
              </button>
            </div>
            <p className="hint">
              {cleanMode === 'ai'
                ? 'Paint over what you want to remove (it turns red), then press Erase.'
                : 'Paint over things to cover them with a colour. Use “Pick from photo” to match the paper.'}
            </p>
            <div className="row">
              <span className="label">Brush</span>
              {(Object.keys(BRUSH) as (keyof typeof BRUSH)[]).map((k) => (
                <button key={k} className={`chip size ${brushKey === k ? 'on' : ''}`} onClick={() => setBrushKey(k)} aria-label={`Brush size ${k}`}>
                  <span className="dot" style={{ width: { S: 8, M: 14, L: 22 }[k], height: { S: 8, M: 14, L: 22 }[k] }} />
                  {k}
                </button>
              ))}
            </div>
            {cleanMode === 'brush' && (
              <div className="row">
                <span className="label">Colour</span>
                {['#ffffff', '#222222', ...(pickedColor ? [pickedColor] : [])].map((c) => (
                  <button key={c} className={`swatch ${brushColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setBrushColor(c)} aria-label={`Colour ${c}`} />
                ))}
                <button className={`chip ${picking ? 'on' : ''}`} onClick={() => setPicking((v) => !v)}>
                  <Icon name="drop" size={20} /> {picking ? 'Tap the photo…' : 'Pick from photo'}
                </button>
              </div>
            )}
            {cleanMode === 'ai' && (
              <>
                <div className="row">
                  <button className="btn" onClick={() => setStrokes([])} disabled={!strokes.length}>
                    <Icon name="close" /> Clear marks
                  </button>
                  <button className="btn primary" onClick={eraseMarks} disabled={!strokes.length}>
                    <Icon name="wand" /> Erase
                  </button>
                </div>
                {lamaLine && <p className={`status ${lama.state}`}>{lamaLine}</p>}
              </>
            )}
          </>
        )
      case 'select':
        if (selRect)
          return (
            <>
              <p className="hint">What do you want to do with the part inside the blue box?</p>
              <div className="row">
                <button className="btn primary" onClick={() => liftSelection(false)}>
                  <Icon name="cut" /> Cut out & move
                </button>
                <button className="btn" onClick={() => liftSelection(true)}>
                  <Icon name="copy" /> Copy it
                </button>
                <button className="btn danger" onClick={eraseSelection}>
                  <Icon name="eraseBox" /> Erase it
                </button>
                <button className="btn" onClick={() => setSelRect(null)}>
                  <Icon name="close" /> Cancel
                </button>
              </div>
            </>
          )
        if (selected) return <>{itemButtons()}<p className="hint">Drag to move. Pull a round corner to make it bigger or smaller, or the top dot to turn it.</p></>
        return <p className="hint">Draw a box around any part of the page (like one clock) to cut it out, copy it or erase it. Tap text or stickers to move them.</p>
      case 'text':
        return (
          <>
            <textarea
              className="text-input"
              rows={2}
              placeholder="Type your text here"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                if (editingText) patchItem(editingText.id, { text: e.target.value }, `text:${editingText.id}`)
              }}
            />
            <div className="row">
              {FONTS.map((f) => (
                <button key={f.family} className={`chip ${font === f.family ? 'on' : ''}`} style={{ fontFamily: f.family }} onClick={() => { setFont(f.family); textStyle({ fontFamily: f.family }) }}>
                  {f.label}
                </button>
              ))}
              <span className="sep" />
              {(Object.keys(TEXT_SIZE) as (keyof typeof TEXT_SIZE)[]).map((k) => (
                <button key={k} className={`chip ${sizeKey === k ? 'on' : ''}`} onClick={() => { setSizeKey(k); textStyle({ fontSize: Math.round(big * TEXT_SIZE[k]), scaleX: 1, scaleY: 1 }) }}>
                  {k}
                </button>
              ))}
            </div>
            <div className="row">
              {COLORS.map((c) => (
                <button key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); textStyle({ fill: c }) }} aria-label={`Colour ${c}`} />
              ))}
            </div>
            <div className="row">
              {editingText ? (
                <>
                  <button className="btn" onClick={() => { setSelectedId(null); setDraft('') }}>
                    <Icon name="plus" /> New text
                  </button>
                  <button className="btn danger" onClick={deleteSelected}>
                    <Icon name="trash" /> Delete
                  </button>
                  <button className="btn primary" onClick={() => setSelectedId(null)}>
                    <Icon name="check" /> Done
                  </button>
                </>
              ) : (
                <button className="btn primary" onClick={addText}>
                  <Icon name="plus" /> Add text to the page
                </button>
              )}
            </div>
          </>
        )
      case 'stickers':
        return (
          <>
            {selected && itemButtons()}
            <p className="hint">Tap a sticker to put it on the page, then drag it into place.</p>
            <div className="sticker-grid">
              {SHAPES.map((s) => (
                <button key={s.id} className="sticker" onClick={() => addSticker(s)} title={s.label}>
                  <img src={s.value} alt={s.label} />
                </button>
              ))}
              {EMOJI.map((s) => (
                <button key={s.id} className="sticker emoji" onClick={() => addSticker(s)} aria-label={`Sticker ${s.label}`}>
                  {s.value}
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn" onClick={() => photoInput.current?.click()}>
                <Icon name="image" /> Add my own picture
              </button>
              <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </>
        )
      case 'export':
        return (
          <>
            <p className="hint">Your work is saved on this computer automatically.</p>
            <div className="row">
              <button className="btn primary" onClick={() => exportAs('print')}>
                <Icon name="export" /> Print
              </button>
              <button className="btn" onClick={() => exportAs('pdf')}>
                <Icon name="pdf" /> Save as PDF
              </button>
              <button className="btn" onClick={() => exportAs('png')}>
                <Icon name="image" /> Save as picture
              </button>
            </div>
          </>
        )
    }
  }

  return (
    <div className="editor">
      <header className="topbar">
        <button className="icon-btn" onClick={onHome} aria-label="Home">
          <Icon name="home" />
          <span>Home</span>
        </button>
        <button className="title" onClick={rename} title="Rename">
          {meta.name}
          <small>{saved ? 'Saved' : 'Saving…'}</small>
        </button>
        <div className="top-actions">
          <button className="icon-btn" onClick={h.undo} disabled={!h.canUndo} aria-label="Undo">
            <Icon name="undo" />
            <span>Undo</span>
          </button>
          <button className="icon-btn" onClick={h.redo} disabled={!h.canRedo} aria-label="Redo">
            <Icon name="redo" />
            <span>Redo</span>
          </button>
          <div className="zoom">
            <button onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} aria-label="Zoom out">
              <Icon name="minus" size={22} />
            </button>
            <button onClick={() => setZoom(1)} aria-label="Fit to screen">
              <Icon name="fit" size={22} />
            </button>
            <button onClick={() => setZoom((z) => Math.min(6, z * 1.25))} aria-label="Zoom in">
              <Icon name="plus" size={22} />
            </button>
          </div>
        </div>
      </header>

      <EditorCanvas
        doc={doc}
        tool={tool}
        zoom={zoom}
        onZoom={setZoom}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onItemChange={(id, patch) => patchItem(id, patch)}
        strokes={strokes}
        brushSize={brushSize}
        paintColor={cleanMode === 'brush' ? brushColor : null}
        onStroke={onStroke}
        picking={picking}
        onPick={onPick}
        crop={crop}
        cropRatio={cropRatio}
        onCrop={setCrop}
        selRect={selRect}
        onSelRect={setSelRect}
      />

      <section className="panel" aria-label={`${TOOLS.find((t) => t.id === tool)?.label} options`}>
        {panel()}
      </section>

      <nav className="toolbar">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tool ${tool === t.id ? 'on' : ''}`} onClick={() => changeTool(t.id)}>
            <Icon name={t.icon} size={28} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {busy && (
        <div className="busy" role="alert">
          <div className="busy-card">
            <div className="spinner" />
            <p>{lama.state === 'loading' && busy === 'Erasing…' ? lamaLine : busy}</p>
            {lama.state === 'loading' && busy === 'Erasing…' && (
              <div className="bar">
                <span style={{ width: `${Math.round(lama.progress * 100)}%` }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
