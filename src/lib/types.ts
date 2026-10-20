export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Item {
  id: string
  kind: 'image' | 'text'
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  // image items
  src?: string
  width?: number
  height?: number
  // text items
  text?: string
  fontSize?: number
  fontFamily?: string
  fill?: string
}

/** A worksheet: a flat base picture plus movable pieces on top. */
export interface Doc {
  base: string
  width: number
  height: number
  items: Item[]
}

/** One brush stroke, in picture pixels. */
export interface Stroke {
  points: number[]
  size: number
}

export type Tool = 'select' | 'crop' | 'clean' | 'text' | 'stickers' | 'export'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
