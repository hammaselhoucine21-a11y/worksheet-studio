import type { Item } from './types'

export const FONTS = [
  { family: 'Andika', label: 'Clear' },
  { family: 'Fredoka', label: 'Round' },
  { family: 'Comic Neue', label: 'Fun' },
] as const

export const COLORS = ['#222222', '#1f5fbf', '#d62f2f', '#1f8f4e', '#f08a00', '#7b3fbf', '#ffffff']

export function preloadFonts() {
  return Promise.all(FONTS.map((f) => document.fonts.load(`40px "${f.family}"`).catch(() => null)))
}

/** Konva attributes for an item. Shared by the editor canvas and the exporter so both draw the same thing. */
export function itemAttrs(it: Item) {
  const common = { x: it.x, y: it.y, rotation: it.rotation, scaleX: it.scaleX, scaleY: it.scaleY }
  if (it.kind === 'image') return { ...common, width: it.width, height: it.height }
  return {
    ...common,
    text: it.text || ' ',
    fontSize: it.fontSize,
    fontFamily: `"${it.fontFamily}", "Segoe UI Emoji", "Apple Color Emoji", sans-serif`,
    fill: it.fill,
    lineHeight: 1.15,
  }
}
