import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Circle, Group, Image as KImage, Layer, Line, Rect as KRect, Stage, Text as KText, Transformer } from 'react-konva'
import { clampRect, normRect } from '../lib/geometry'
import { itemAttrs, preloadFonts } from '../lib/items'
import { loadImage } from '../lib/raster'
import type { Doc, Item, Rect, Stroke, Tool } from '../lib/types'

export function useHTMLImage(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    let alive = true
    if (src) loadImage(src).then((i) => alive && setImg(i), () => {})
    return () => {
      alive = false
    }
  }, [src])
  return src ? img : null
}

interface Props {
  doc: Doc
  tool: Tool
  zoom: number
  onZoom: (z: number) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  onItemChange: (id: string, patch: Partial<Item>) => void
  strokes: Stroke[]
  brushSize: number
  /** Colour of the live stroke: a paint colour, or null for the red "erase this" marks. */
  paintColor: string | null
  onStroke: (s: Stroke) => void
  picking: boolean
  onPick: (pt: { x: number; y: number }) => void
  crop: Rect | null
  cropRatio: number | null
  onCrop: (r: Rect) => void
  selRect: Rect | null
  onSelRect: (r: Rect | null) => void
}

const ACCENT = '#e8505b'
const MARK = '#ff2d55'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

function ItemNode({ item, draggable, onChange, register }: {
  item: Item
  draggable: boolean
  onChange: (patch: Partial<Item>) => void
  register: (id: string, n: Konva.Node | null) => void
}) {
  const img = useHTMLImage(item.kind === 'image' ? item.src : undefined)
  const props = {
    ...itemAttrs(item),
    id: item.id,
    name: 'item',
    draggable,
    ref: (n: Konva.Node | null) => register(item.id, n),
    onDragEnd: (e: KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: KonvaEventObject<Event>) => {
      const n = e.target
      onChange({ x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() })
    },
  }
  if (item.kind === 'image') return img ? <KImage image={img} {...props} /> : null
  return <KText {...props} />
}

export function EditorCanvas(p: Props) {
  const { doc } = p
  const W = doc.width
  const H = doc.height
  const outer = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const cropRef = useRef<Konva.Rect>(null)
  const cropTr = useRef<Konva.Transformer>(null)
  const nodes = useRef(new Map<string, Konva.Node>())
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [live, setLive] = useState<Stroke | null>(null)
  const [tempRect, setTempRect] = useState<Rect | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const startPt = useRef<{ x: number; y: number } | null>(null)
  const pinch = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null)
  const baseImg = useHTMLImage(doc.base)
  const itemsActive = p.tool === 'select' || p.tool === 'text' || p.tool === 'stickers'

  useLayoutEffect(() => {
    const el = outer.current!
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    preloadFonts().then(() => stageRef.current?.batchDraw())
  }, [])

  const PAD = 20
  const fit = box.w ? Math.min((box.w - 2 * PAD) / W, (box.h - 2 * PAD) / H) : 0.1
  const scale = Math.max(0.02, fit * p.zoom)
  const cw = W * scale
  const ch = H * scale
  const stageW = Math.max(box.w, cw + 2 * PAD)
  const stageH = Math.max(box.h, ch + 2 * PAD)
  const ox = (stageW - cw) / 2
  const oy = (stageH - ch) / 2

  // Attach the resize/rotate handles to the selected piece.
  const selectedRef = useRef(p.selectedId)
  selectedRef.current = itemsActive ? p.selectedId : null
  const attach = () => {
    const tr = trRef.current
    if (!tr) return
    const n = selectedRef.current ? nodes.current.get(selectedRef.current) : undefined
    tr.nodes(n ? [n] : [])
    tr.getLayer()?.batchDraw()
  }
  useEffect(attach, [p.selectedId, doc.items, itemsActive])
  const register = (id: string, n: Konva.Node | null) => {
    if (n) nodes.current.set(id, n)
    else nodes.current.delete(id)
    if (id === selectedRef.current) attach()
  }

  useEffect(() => {
    const tr = cropTr.current
    if (!tr) return
    tr.nodes(p.tool === 'crop' && cropRef.current ? [cropRef.current] : [])
    tr.getLayer()?.batchDraw()
  }, [p.tool, p.crop !== null, p.cropRatio])

  const toDoc = () => {
    const pos = stageRef.current?.getPointerPosition()
    return pos ? { x: (pos.x - ox) / scale, y: (pos.y - oy) / scale } : null
  }
  const inside = (pt: { x: number; y: number }) => ({ x: clamp(pt.x, 0, W), y: clamp(pt.y, 0, H) })

  function down(e: KonvaEventObject<PointerEvent>) {
    if (pinch.current || e.evt.button > 0) return
    const pt = toDoc()
    if (!pt) return
    if (p.picking) return p.onPick(inside(pt))
    if (p.tool === 'clean') return setLive({ points: [pt.x, pt.y], size: p.brushSize })
    if (p.tool === 'crop' || p.tool === 'export') return
    const t = e.target
    if (t.hasName('item')) return p.onSelect(t.id())
    if (t.getParent() instanceof Konva.Transformer) return
    p.onSelect(null)
    if (p.tool === 'select') {
      startPt.current = inside(pt)
      p.onSelRect(null)
    }
  }

  function move(e: KonvaEventObject<PointerEvent>) {
    const pt = toDoc()
    if (!pt) return
    if (p.tool === 'clean' && e.evt.pointerType === 'mouse') setHover(pt)
    if (live) {
      const n = live.points.length
      if (Math.hypot(pt.x - live.points[n - 2], pt.y - live.points[n - 1]) * scale < 3) return
      setLive({ ...live, points: [...live.points, pt.x, pt.y] })
    } else if (startPt.current) setTempRect(normRect(startPt.current, inside(pt)))
  }

  function up() {
    if (live) {
      p.onStroke(live)
      setLive(null)
    }
    if (startPt.current) {
      const r = tempRect
      startPt.current = null
      setTempRect(null)
      if (r && r.width * scale > 10 && r.height * scale > 10) p.onSelRect(clampRect(r, W, H))
    }
  }
  const upRef = useRef(up)
  upRef.current = up
  useEffect(() => {
    const f = () => upRef.current()
    window.addEventListener('pointerup', f)
    return () => window.removeEventListener('pointerup', f)
  }, [])

  // Two fingers: pinch to zoom, drag to move around. Ctrl + mouse wheel also zooms.
  const zoomRef = useRef(p.zoom)
  zoomRef.current = p.zoom
  const onZoomRef = useRef(p.onZoom)
  onZoomRef.current = p.onZoom
  useEffect(() => {
    const el = scroller.current!
    const info = (t: TouchList) => ({
      dist: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY),
      cx: (t[0].clientX + t[1].clientX) / 2,
      cy: (t[0].clientY + t[1].clientY) / 2,
    })
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      pinch.current = { ...info(e.touches), zoom: zoomRef.current }
      setLive(null)
      startPt.current = null
      setTempRect(null)
    }
    const moveT = (e: TouchEvent) => {
      if (!pinch.current || e.touches.length !== 2) return
      e.preventDefault()
      const i = info(e.touches)
      onZoomRef.current(clamp((pinch.current.zoom * i.dist) / pinch.current.dist, 0.5, 6))
      el.scrollLeft -= i.cx - pinch.current.cx
      el.scrollTop -= i.cy - pinch.current.cy
      pinch.current.cx = i.cx
      pinch.current.cy = i.cy
    }
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch.current = null
    }
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      onZoomRef.current(clamp(zoomRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.5, 6))
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', moveT, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', moveT)
      el.removeEventListener('touchend', end)
      el.removeEventListener('wheel', wheel)
    }
  }, [])

  const drawLine = (s: Stroke, color: string, key: string | number) =>
    s.points.length <= 2 ? (
      <Circle key={key} x={s.points[0]} y={s.points[1]} radius={s.size / 2} fill={color} listening={false} />
    ) : (
      <Line key={key} points={s.points} stroke={color} strokeWidth={s.size} lineCap="round" lineJoin="round" listening={false} />
    )

  const showRect = tempRect || (p.tool === 'select' ? p.selRect : null)
  const c = p.crop
  const cursor = p.picking ? 'copy' : p.tool === 'clean' ? (hover ? 'none' : 'crosshair') : p.tool === 'select' ? 'crosshair' : 'default'

  return (
    <div className="canvas-outer" ref={outer}>
      <div className="canvas-scroll" ref={scroller}>
        {box.w > 0 && (
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={() => setHover(null)}
            style={{ cursor }}
          >
            <Layer>
              <KRect x={ox} y={oy} width={cw} height={ch} fill="#fff" shadowColor="#000" shadowOpacity={0.18} shadowBlur={18} name="paper" />
              {/* Clipped to the page so the screen shows exactly what gets printed. */}
              <Group x={ox} y={oy} scaleX={scale} scaleY={scale} clipX={0} clipY={0} clipWidth={W} clipHeight={H}>
                {baseImg && <KImage image={baseImg} width={W} height={H} name="base" />}
                {doc.items.map((it) => (
                  <ItemNode key={it.id} item={it} draggable={itemsActive} register={register} onChange={(patch) => p.onItemChange(it.id, patch)} />
                ))}
              </Group>
              <Transformer
                ref={trRef}
                enabledAnchors={CORNERS}
                anchorSize={22}
                anchorCornerRadius={11}
                anchorStroke={ACCENT}
                anchorStrokeWidth={3}
                anchorFill="#fff"
                borderStroke={ACCENT}
                borderStrokeWidth={2}
                rotateAnchorOffset={38}
                boundBoxFunc={(o, n) => (Math.abs(n.width) < 14 || Math.abs(n.height) < 14 ? o : n)}
              />
            </Layer>
            <Layer listening={p.tool === 'crop'}>
              <Group x={ox} y={oy} scaleX={scale} scaleY={scale}>
                {p.tool === 'clean' && (
                  <Group opacity={0.5}>
                    {p.strokes.map((s, i) => drawLine(s, MARK, i))}
                    {live && !p.paintColor && drawLine(live, MARK, 'live')}
                  </Group>
                )}
                {p.tool === 'clean' && live && p.paintColor && drawLine(live, p.paintColor, 'paint')}
                {p.tool === 'clean' && hover && !live && (
                  <Circle x={hover.x} y={hover.y} radius={p.brushSize / 2} stroke="#222" strokeWidth={1.5 / scale} fill={p.paintColor ?? 'rgba(255,45,85,0.25)'} opacity={0.7} listening={false} />
                )}
                {showRect && (
                  <KRect {...showRect} stroke="#1f5fbf" strokeWidth={3 / scale} dash={[12 / scale, 7 / scale]} fill="rgba(31,95,191,0.10)" listening={false} />
                )}
                {p.tool === 'crop' && c && (
                  <>
                    <KRect x={0} y={0} width={W} height={c.y} fill="rgba(0,0,0,0.55)" listening={false} />
                    <KRect x={0} y={c.y + c.height} width={W} height={H - c.y - c.height} fill="rgba(0,0,0,0.55)" listening={false} />
                    <KRect x={0} y={c.y} width={c.x} height={c.height} fill="rgba(0,0,0,0.55)" listening={false} />
                    <KRect x={c.x + c.width} y={c.y} width={W - c.x - c.width} height={c.height} fill="rgba(0,0,0,0.55)" listening={false} />
                    <KRect
                      ref={cropRef}
                      {...c}
                      stroke="#fff"
                      strokeWidth={3 / scale}
                      dash={[12 / scale, 7 / scale]}
                      draggable
                      onDragMove={(e) => {
                        const n = e.target
                        n.x(clamp(n.x(), 0, W - c.width))
                        n.y(clamp(n.y(), 0, H - c.height))
                        p.onCrop({ ...c, x: n.x(), y: n.y() })
                      }}
                      onTransformEnd={() => {
                        const n = cropRef.current!
                        const r = { x: n.x(), y: n.y(), width: n.width() * n.scaleX(), height: n.height() * n.scaleY() }
                        n.scaleX(1)
                        n.scaleY(1)
                        p.onCrop(clampRect(r, W, H))
                      }}
                    />
                  </>
                )}
              </Group>
              {p.tool === 'crop' && (
                <Transformer
                  ref={cropTr}
                  rotateEnabled={false}
                  keepRatio={p.cropRatio !== null}
                  enabledAnchors={p.cropRatio !== null ? CORNERS : undefined}
                  anchorSize={26}
                  anchorCornerRadius={13}
                  anchorStroke={ACCENT}
                  anchorStrokeWidth={3}
                  borderEnabled={false}
                  ignoreStroke
                  boundBoxFunc={(o, n) =>
                    n.width < 30 || n.height < 30 || n.x < ox - 1 || n.y < oy - 1 || n.x + n.width > ox + cw + 1 || n.y + n.height > oy + ch + 1 ? o : n
                  }
                />
              )}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  )
}
