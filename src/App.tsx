import { useState } from 'react'
import { Editor } from './components/Editor'
import { Home, type OpenProject } from './components/Home'

export default function App() {
  const [project, setProject] = useState<OpenProject | null>(null)
  return project ? <Editor key={project.meta.id} project={project} onHome={() => setProject(null)} /> : <Home onOpen={setProject} />
}
