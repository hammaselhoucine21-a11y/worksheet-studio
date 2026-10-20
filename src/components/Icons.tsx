const P = {
  crop: 'M7 2v15h15 M2 7h15v15',
  clean: 'M15 4l5 5-9.5 9.5H6L3.5 16a2 2 0 0 1 0-2.8zM9 10l5 5 M6 20h14',
  select: 'M5 3l13 6.5-5.5 1.8L10.7 17z M13 13l5 5',
  text: 'M5 6V4h14v2 M12 4v16 M9 20h6',
  stickers: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6-4.5-4.1 6-.7z',
  export: 'M7 9V3h10v6 M6 18H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-2 M7 14h10v7H7z',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  home: 'M3 11l9-8 9 8 M5 9.5V21h5v-6h4v6h5V9.5',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  copy: 'M8 8h12v12H8z M4 16V4h12',
  front: 'M4 14V4h10 M8 8h12v12H8z',
  check: 'M4 12.5l5 5L20 6.5',
  close: 'M6 6l12 12 M18 6L6 18',
  image: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M15.5 9.5a1.5 1.5 0 1 0 0-.01',
  wand: 'M4 20L15 9 M13 4v3 M19 10h-3 M17.5 5.5l-2 2 M6 6l1.5 1.5 M20 18l-1.5-1.5',
  brush: 'M14 4l6 6-8 8H6v-6z M4 20h4',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  pdf: 'M6 2h9l5 5v15H6z M14 2v6h6 M9 13h6 M9 17h6',
  open: 'M3 7h7l2 2h9v11H3z M12 17v-5 M9.5 14.5L12 12l2.5 2.5',
  cut: 'M4 4h6v6H4z M14 14h6v6h-6z M10 10l4 4',
  eraseBox: 'M4 4h16v16H4z M8 8l8 8 M16 8l-8 8',
  see: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
}

export type IconName = keyof typeof P

export function Icon({ name, size = 26 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}
