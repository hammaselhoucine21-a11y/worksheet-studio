import { createStore, del, get, keys, set } from 'idb-keyval'
import type { Doc, Item } from './types'

/** Projects are kept in the browser (IndexedDB) so nothing is lost when the window closes. */
const store = createStore('worksheet-studio', 'projects')

export interface ProjectMeta {
  id: string
  name: string
  updated: number
  thumb: string
}

interface StoredDoc {
  width: number
  height: number
  base: Blob
  items: (Omit<Item, 'src'> & { src?: Blob })[]
}

const toBlob = (url: string) => fetch(url).then((r) => r.blob())

export async function saveProject(meta: ProjectMeta, doc: Doc) {
  const stored: StoredDoc = {
    width: doc.width,
    height: doc.height,
    base: await toBlob(doc.base),
    items: await Promise.all(doc.items.map(async (it) => ({ ...it, src: it.src ? await toBlob(it.src) : undefined }))),
  }
  await set(`doc:${meta.id}`, stored, store)
  await set(`meta:${meta.id}`, meta, store)
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const ks = (await keys(store)).filter((k) => String(k).startsWith('meta:'))
  const metas = await Promise.all(ks.map((k) => get<ProjectMeta>(k, store)))
  return metas.filter((m): m is ProjectMeta => !!m).sort((a, b) => b.updated - a.updated)
}

export async function loadProject(id: string): Promise<Doc | null> {
  const s = await get<StoredDoc>(`doc:${id}`, store)
  if (!s) return null
  return {
    width: s.width,
    height: s.height,
    base: URL.createObjectURL(s.base),
    items: s.items.map((it) => ({ ...it, src: it.src ? URL.createObjectURL(it.src) : undefined })),
  }
}

export async function deleteProject(id: string) {
  await del(`doc:${id}`, store)
  await del(`meta:${id}`, store)
}
