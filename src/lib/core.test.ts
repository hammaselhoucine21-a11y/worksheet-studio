import { describe, expect, it } from 'vitest'
import { fromOutput, smartFill, snapToPaper, toTensors, whiteToClear } from './fill'
import { clampRect, fitAspect, maskBBox, normRect, regionAround, shiftItems } from './geometry'
import { commit, initHistory, redo, undo } from './history'

describe('history', () => {
  it('undoes and redoes', () => {
    let h = initHistory(1)
    h = commit(h, 2)
    h = commit(h, 3)
    h = undo(h)
    expect(h.present).toBe(2)
    h = redo(h)
    expect(h.present).toBe(3)
  })
  it('merges typing into one step and clears redo on new edits', () => {
    let h = initHistory('')
    h = commit(h, 'a', 'text:1')
    h = commit(h, 'ab', 'text:1')
    h = commit(h, 'abc', 'text:1')
    expect(h.past).toEqual([''])
    h = undo(h)
    expect(h.present).toBe('')
    h = commit(h, 'x')
    expect(h.future).toEqual([])
  })
  it('does nothing when there is nothing to undo', () => {
    const h = initHistory(5)
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })
})

describe('geometry', () => {
  it('normalises a dragged rectangle in any direction', () => {
    expect(normRect({ x: 10, y: 20 }, { x: 4, y: 2 })).toEqual({ x: 4, y: 2, width: 6, height: 18 })
  })
  it('keeps crop rectangles inside the picture', () => {
    expect(clampRect({ x: -5, y: 10.4, width: 200, height: 50 }, 100, 40)).toEqual({ x: 0, y: 10, width: 100, height: 30 })
  })
  it('fits an A4 frame inside a wide picture', () => {
    const r = fitAspect(1000, 500, 210 / 297)
    expect(r.height).toBe(500)
    expect(r.width / r.height).toBeCloseTo(210 / 297)
    expect(r.x).toBeCloseTo((1000 - r.width) / 2)
  })
  it('finds the box around marked pixels', () => {
    const m = new Uint8Array(10 * 10)
    m[3 * 10 + 2] = 1
    m[6 * 10 + 7] = 1
    expect(maskBBox(m, 10, 10)).toEqual({ x: 2, y: 3, width: 6, height: 4 })
    expect(maskBBox(new Uint8Array(4), 2, 2)).toBeNull()
  })
  it('gives the AI some surroundings but stays inside the picture', () => {
    const r = regionAround({ x: 10, y: 10, width: 50, height: 20 }, 1000, 800)
    expect(r.x).toBe(0)
    expect(r.width).toBeGreaterThanOrEqual(50 + 96)
    expect(r.x + r.width).toBeLessThanOrEqual(1000)
    const small = regionAround({ x: 0, y: 0, width: 30, height: 30 }, 100, 60)
    expect(small).toEqual({ x: 0, y: 0, width: 100, height: 60 })
  })
  it('moves pieces when the picture is cropped', () => {
    const items = shiftItems([{ id: 'a', kind: 'text', x: 50, y: 60, rotation: 0, scaleX: 1, scaleY: 1 }], -10, -20)
    expect(items[0]).toMatchObject({ x: 40, y: 40 })
  })
})

describe('clean-up pixels', () => {
  it('quick fill blends a hole in a white page back to white', () => {
    const w = 8
    const h = 8
    const px = new Uint8ClampedArray(w * h * 4).fill(255)
    const mask = new Uint8Array(w * h)
    for (let y = 2; y < 6; y++)
      for (let x = 2; x < 6; x++) {
        const i = y * w + x
        mask[i] = 1
        px.set([0, 0, 0, 255], i * 4) // black "title" pixels to remove
      }
    smartFill(px, w, h, mask)
    for (let i = 0; i < w * h; i++) expect(px[i * 4]).toBe(255)
  })
  it('converts pixels to model tensors and back', () => {
    const rgba = new Uint8ClampedArray([255, 0, 51, 255, 0, 255, 0, 255])
    const mask = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0])
    const t = toTensors(rgba, mask, 2)
    expect(Array.from(t.image)).toEqual([1, 0, 0, 1, 0.2, 0].map(Math.fround))
    expect(Array.from(t.mask)).toEqual([1, 0])
    const back = fromOutput(new Float32Array([255, 0, 0, 255, 51, 0]), 2)
    expect(Array.from(back)).toEqual([255, 0, 51, 255, 0, 255, 0, 255])
    const unit = fromOutput(new Float32Array([1, 0, 0, 1, 0.2, 0]), 2)
    expect(Array.from(unit)).toEqual([255, 0, 51, 255, 0, 255, 0, 255])
  })
  it('snaps an almost-paper AI fill to the exact paper colour but keeps real content', () => {
    // 3 paper pixels (cream), then 2 filled pixels: one slightly off-paper, one dark.
    const px = new Uint8ClampedArray([250, 245, 230, 255, 250, 245, 230, 255, 250, 245, 230, 255, 244, 240, 226, 255, 40, 40, 40, 255])
    snapToPaper(px, new Uint8Array([0, 0, 0, 1, 1]))
    expect(Array.from(px.slice(12, 15))).toEqual([250, 245, 230])
    expect(Array.from(px.slice(16, 19))).toEqual([40, 40, 40])
  })
  it('makes white see-through but keeps ink', () => {
    const px = new Uint8ClampedArray([255, 255, 255, 255, 20, 20, 20, 255])
    whiteToClear(px)
    expect(px[3]).toBe(0)
    expect(px[7]).toBe(255)
  })
})
