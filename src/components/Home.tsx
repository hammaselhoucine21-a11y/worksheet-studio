import { useEffect, useRef, useState } from 'react'
import { fileToBase } from '../lib/raster'
import { deleteProject, listProjects, loadProject, type ProjectMeta } from '../lib/storage'
import { uid, type Doc } from '../lib/types'
import { Icon } from './Icons'

export interface OpenProject {
  meta: ProjectMeta
  doc: Doc
}

export function Home({ onOpen }: { onOpen: (p: OpenProject) => void }) {
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([]))
  }, [])

  async function openFile(file: Blob | null | undefined, name = 'Worksheet') {
    if (!file || !file.type.startsWith('image/')) {
      setError('That is not a picture. Please choose a photo or screenshot.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const b = await fileToBase(file)
      const meta = { id: uid(), name: name.replace(/\.[^.]+$/, '') || 'Worksheet', updated: Date.now(), thumb: '' }
      onOpen({ meta, doc: { base: b.url, width: b.width, height: b.height, items: [] } })
    } catch {
      setError('Sorry, this picture could not be opened.')
      setBusy(false)
    }
  }

  // Paste a screenshot with Ctrl+V
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'))
      if (f) openFile(f, 'Pasted picture')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  async function open(meta: ProjectMeta) {
    const doc = await loadProject(meta.id)
    if (doc) onOpen({ meta, doc })
  }

  async function remove(meta: ProjectMeta) {
    if (!confirm(`Delete "${meta.name}"? This cannot be undone.`)) return
    await deleteProject(meta.id)
    setProjects((p) => p.filter((x) => x.id !== meta.id))
  }

  return (
    <div
      className={`home ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        openFile(f, f?.name)
      }}
    >
      <header className="home-head">
        <img src="/icon.svg" alt="" width={56} height={56} />
        <div>
          <h1>Worksheet Studio</h1>
          <p>Crop, clean up and change any worksheet picture.</p>
        </div>
      </header>

      <button className="open-big" onClick={() => input.current?.click()} disabled={busy}>
        <Icon name="open" size={44} />
        <span>{busy ? 'Opening…' : 'Open a photo'}</span>
        <small>From your files, gallery or camera</small>
      </button>
      <p className="home-hint">You can also drag a picture here, or copy a picture and press Ctrl + V.</p>
      {error && <p className="error">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          openFile(f, f?.name)
          e.target.value = ''
        }}
      />

      {projects.length > 0 && (
        <section className="recent">
          <h2>Your recent work</h2>
          <div className="recent-grid">
            {projects.map((p) => (
              <div className="recent-card" key={p.id}>
                <button className="recent-open" onClick={() => open(p)}>
                  {p.thumb ? <img src={p.thumb} alt="" /> : <div className="thumb-empty" />}
                  <span className="recent-name">{p.name}</span>
                  <span className="recent-date">{new Date(p.updated).toLocaleString()}</span>
                </button>
                <button className="recent-del" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>
                  <Icon name="trash" size={20} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
