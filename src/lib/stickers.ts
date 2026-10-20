export type Sticker =
  | { id: string; label: string; kind: 'emoji'; value: string }
  | { id: string; label: string; kind: 'svg'; value: string; w: number; h: number }

const svgUrl = (w: number, h: number, body: string) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)

function clockFace() {
  let s = '<circle cx="200" cy="200" r="185" fill="#fff" stroke="#222" stroke-width="14"/>'
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2
    const r1 = i % 5 ? 168 : 158
    s += `<line x1="${200 + Math.sin(a) * r1}" y1="${200 - Math.cos(a) * r1}" x2="${200 + Math.sin(a) * 176}" y2="${200 - Math.cos(a) * 176}" stroke="#222" stroke-width="${i % 5 ? 3 : 6}"/>`
  }
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * Math.PI * 2
    s += `<text x="${200 + Math.sin(a) * 128}" y="${200 - Math.cos(a) * 128}" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#222" text-anchor="middle" dominant-baseline="central">${n}</text>`
  }
  return svgUrl(400, 400, s + '<circle cx="200" cy="200" r="10" fill="#222"/>')
}

const line = (w = 10) => `stroke="#222" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`

export const SHAPES: Sticker[] = [
  { id: 'clock', label: 'Empty clock', kind: 'svg', value: clockFace(), w: 400, h: 400 },
  {
    id: 'timebox',
    label: 'Time box',
    kind: 'svg',
    value: svgUrl(420, 120, `<rect x="6" y="6" width="408" height="108" rx="22" fill="#fff" ${line(6)}/><line x1="50" y1="84" x2="180" y2="84" ${line(5)}/><line x1="240" y1="84" x2="370" y2="84" ${line(5)}/><circle cx="210" cy="48" r="7" fill="#222"/><circle cx="210" cy="78" r="7" fill="#222"/>`),
    w: 420,
    h: 120,
  },
  {
    id: 'answer',
    label: 'Answer line',
    kind: 'svg',
    value: svgUrl(500, 40, `<line x1="10" y1="30" x2="490" y2="30" ${line(5)}/>`),
    w: 500,
    h: 40,
  },
  {
    id: 'lines',
    label: 'Writing lines',
    kind: 'svg',
    value: svgUrl(600, 200, [30, 100, 170].map((y) => `<line x1="10" y1="${y}" x2="590" y2="${y}" ${line(4)}/>`).join('')),
    w: 600,
    h: 200,
  },
  { id: 'box', label: 'Box', kind: 'svg', value: svgUrl(300, 300, `<rect x="8" y="8" width="284" height="284" rx="16" fill="none" ${line(10)}/>`), w: 300, h: 300 },
  { id: 'circle', label: 'Circle', kind: 'svg', value: svgUrl(300, 300, `<circle cx="150" cy="150" r="140" fill="none" ${line(10)}/>`), w: 300, h: 300 },
  {
    id: 'arrow',
    label: 'Arrow',
    kind: 'svg',
    value: svgUrl(400, 120, `<path d="M15 60 H360 M300 15 L370 60 L300 105" fill="none" ${line(14)}/>`),
    w: 400,
    h: 120,
  },
  {
    id: 'tick',
    label: 'Tick box',
    kind: 'svg',
    value: svgUrl(120, 120, `<rect x="6" y="6" width="108" height="108" rx="12" fill="#fff" ${line(8)}/>`),
    w: 120,
    h: 120,
  },
]

export const EMOJI: Sticker[] = ['⭐', '✅', '❌', '❤️', '😊', '👍', '🏆', '🍎', '✏️', '📚', '⏰', '🌞', '🌈', '🎈', '🐱', '🐶', '🌸', '🚗', '➡️', '❓']
  .map((e, i) => ({ id: `e${i}`, label: e, kind: 'emoji' as const, value: e }))
