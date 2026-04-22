import { useState, useEffect, useCallback } from 'react'

const MAX_FILES = 10

const DOC_TYPES = [
  {
    id:          'readme',
    label:       'README',
    descripcion: 'Documentación general del repositorio',
    hint:        'Selecciona package.json, el entry point principal y los archivos clave',
  },
  {
    id:          'api',
    label:       'API / Endpoints',
    descripcion: 'Documentación técnica de rutas y endpoints',
    hint:        'Selecciona los archivos en routes/, controllers/ o api/',
  },
]

export default function DocGenerator({ proyecto }) {
  const [repos,        setRepos]        = useState([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [reposError,   setReposError]   = useState(null)
  const [selectedRepo, setSelectedRepo] = useState(null)

  const [tree,         setTree]         = useState({})
  const [expanded,     setExpanded]     = useState(new Set())
  const [loadingPaths, setLoadingPaths] = useState(new Set())
  const [selectedFiles,setSelectedFiles]= useState(new Set())

  const [docType,    setDocType]    = useState('readme')
  const [generating, setGenerating] = useState(false)
  const [markdown,   setMarkdown]   = useState('')
  const [genError,   setGenError]   = useState(null)

  useEffect(() => {
    if (!proyecto) return
    setRepos([]); setSelectedRepo(null); setTree({})
    setExpanded(new Set()); setSelectedFiles(new Set())
    setMarkdown(''); setReposError(null); setLoadingRepos(true)

    fetch(`/api/repos?project=${encodeURIComponent(proyecto)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setRepos(data.repos || [])
      })
      .catch(err => setReposError(err.message))
      .finally(() => setLoadingRepos(false))
  }, [proyecto])

  const loadTree = useCallback(async (repoId, path = '/') => {
    setLoadingPaths(prev => new Set(prev).add(path))
    try {
      const r    = await fetch(`/api/repos/${repoId}/tree?project=${encodeURIComponent(proyecto)}&path=${encodeURIComponent(path)}`)
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setTree(prev => ({ ...prev, [path]: data.items || [] }))
    } catch (err) {
      console.error('Error cargando árbol:', err)
    } finally {
      setLoadingPaths(prev => { const s = new Set(prev); s.delete(path); return s })
    }
  }, [proyecto])

  function handleSelectRepo(repoId) {
    const repo = repos.find(r => r.id === repoId) || null
    setSelectedRepo(repo); setTree({}); setExpanded(new Set(['/']))
    setSelectedFiles(new Set()); setMarkdown(''); setGenError(null)
    if (repo) loadTree(repo.id, '/')
  }

  function handleToggleFolder(path) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) { next.delete(path) }
      else { next.add(path); if (!tree[path] && selectedRepo) loadTree(selectedRepo.id, path) }
      return next
    })
  }

  function handleToggleFile(path) {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else if (next.size < MAX_FILES) next.add(path)
      return next
    })
  }

  async function handleGenerate() {
    if (!selectedFiles.size || !selectedRepo) return
    setGenerating(true); setGenError(null); setMarkdown('')

    try {
      const contentRes  = await fetch(`/api/repos/content?project=${encodeURIComponent(proyecto)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: selectedRepo.id, paths: [...selectedFiles] }),
      })
      const contentData = await contentRes.json()
      if (!contentRes.ok) throw new Error(contentData.error)

      const genRes  = await fetch('/api/docs/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: docType, repo: selectedRepo.nombre, archivos: contentData.archivos }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData.error)

      setMarkdown(genData.markdown)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!markdown) return
    const nombre = docType === 'readme'
      ? `README-${selectedRepo?.nombre || 'repo'}.md`
      : `API-${selectedRepo?.nombre || 'repo'}.md`
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: nombre })
    a.click(); URL.revokeObjectURL(url)
  }

  const currentDocType = DOC_TYPES.find(d => d.id === docType)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Documentación Técnica</h1>
        <p className="text-sm text-white/40 mt-1.5">
          Selecciona un repositorio y archivos — la IA genera la documentación lista para descargar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Panel izquierdo: Repo + árbol ── */}
        <div className="bg-surface border border-white/[0.08] rounded-xl overflow-hidden">

          {/* Selector de repositorio */}
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <p className="text-[10px] font-bold tracking-[.16em] uppercase text-teal-400 mb-3">Repositorio</p>
            {loadingRepos ? (
              <div className="input-base text-white/30 flex items-center gap-2"><Spinner small /> Cargando…</div>
            ) : reposError ? (
              <div className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">{reposError}</div>
            ) : (
              <select value={selectedRepo?.id || ''} onChange={e => handleSelectRepo(e.target.value)} className="input-base">
                <option value="">— Selecciona un repositorio —</option>
                {repos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            )}
          </div>

          {/* Árbol de archivos */}
          {selectedRepo ? (
            <div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07]">
                <p className="text-[10px] font-bold tracking-[.16em] uppercase text-white/30">Archivos</p>
                {selectedFiles.size > 0 && (
                  <span className="text-[10px] text-teal-400 font-medium">{selectedFiles.size}/{MAX_FILES}</span>
                )}
              </div>

              {selectedFiles.size >= MAX_FILES && (
                <div className="mx-4 mt-3 text-[11px] text-amber-400 bg-amber-400/[0.07] border border-amber-400/20 rounded-lg px-3 py-2">
                  Límite de {MAX_FILES} archivos alcanzado
                </div>
              )}

              <div className="max-h-80 overflow-y-auto py-1">
                {loadingPaths.has('/') ? (
                  <div className="flex items-center gap-2 text-white/25 px-5 py-4 text-xs"><Spinner small /> Cargando…</div>
                ) : (tree['/'] || []).length === 0 ? (
                  <div className="text-white/25 px-5 py-4 text-xs">Repositorio vacío</div>
                ) : (
                  <TreeLevel
                    items={tree['/']}
                    depth={0}
                    tree={tree}
                    expanded={expanded}
                    loadingPaths={loadingPaths}
                    selectedFiles={selectedFiles}
                    maxReached={selectedFiles.size >= MAX_FILES}
                    onToggleFolder={handleToggleFolder}
                    onToggleFile={handleToggleFile}
                  />
                )}
              </div>

              {currentDocType?.hint && (
                <div className="px-5 py-3 border-t border-white/[0.07]">
                  <p className="text-[11px] text-white/25 leading-relaxed">{currentDocType.hint}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-sm text-white/25">Selecciona un repositorio</p>
              <p className="text-xs text-white/15">para explorar sus archivos</p>
            </div>
          )}
        </div>

        {/* ── Panel derecho: tipo + output ── */}
        <div className="flex flex-col gap-4">

          {/* Tipo de documentación */}
          <div className="bg-surface border border-white/[0.08] rounded-xl p-5 flex flex-col gap-4">
            <p className="text-[10px] font-bold tracking-[.16em] uppercase text-white/30">Tipo de documentación</p>

            <div className="grid grid-cols-2 gap-2">
              {DOC_TYPES.map(dt => (
                <button
                  key={dt.id}
                  onClick={() => setDocType(dt.id)}
                  className={`flex flex-col gap-1 text-left p-3.5 rounded-xl border transition-colors ${
                    docType === dt.id
                      ? 'border-teal-500/40 bg-teal-500/[0.07] text-white'
                      : 'border-white/[0.07] hover:border-white/15 text-white/40 hover:text-white/70'
                  }`}
                >
                  <span className="text-xs font-semibold font-display">{dt.label}</span>
                  <span className="text-[11px] leading-snug">{dt.descripcion}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !selectedFiles.size || !selectedRepo}
              className="bg-white hover:bg-zinc-100 disabled:bg-white/[0.05] disabled:text-white/20 disabled:cursor-not-allowed text-black font-semibold text-sm py-2.5 px-5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {generating
                ? <><Spinner /> Generando documentación…</>
                : `Generar ${currentDocType?.label}`
              }
            </button>

            {!selectedRepo && (
              <p className="text-[11px] text-white/25 text-center -mt-1">Selecciona un repositorio y archivos primero</p>
            )}
            {selectedRepo && !selectedFiles.size && (
              <p className="text-[11px] text-white/25 text-center -mt-1">Selecciona al menos un archivo del árbol</p>
            )}
          </div>

          {/* Output */}
          {genError && (
            <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
              <strong className="font-medium">Error: </strong>{genError}
            </div>
          )}

          {!markdown && !generating && !genError && (
            <div className="bg-surface border border-dashed border-white/[0.08] rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3 min-h-[180px]">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/20">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                </svg>
              </div>
              <p className="text-sm text-white/30">La documentación aparecerá aquí</p>
            </div>
          )}

          {markdown && (
            <div className="bg-surface border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07]">
                <div>
                  <p className="text-[10px] font-bold tracking-[.16em] uppercase text-teal-400">Generado</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {docType === 'readme' ? 'README.md' : 'API-docs.md'} · {selectedRepo?.nombre}
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/90 border border-white/[0.08] hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <DownloadIcon /> Descargar .md
                </button>
              </div>
              <pre className="p-5 text-xs text-white/60 font-mono leading-relaxed overflow-auto max-h-[480px] whitespace-pre-wrap break-words">
                {markdown}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Árbol de archivos ─────────────────────────────────────────────

function TreeLevel({ items, depth, tree, expanded, loadingPaths, selectedFiles, maxReached, onToggleFolder, onToggleFile }) {
  return (
    <>
      {items.map(item => (
        <TreeNode key={item.path} item={item} depth={depth} tree={tree} expanded={expanded}
          loadingPaths={loadingPaths} selectedFiles={selectedFiles} maxReached={maxReached}
          onToggleFolder={onToggleFolder} onToggleFile={onToggleFile} />
      ))}
    </>
  )
}

function TreeNode({ item, depth, tree, expanded, loadingPaths, selectedFiles, maxReached, onToggleFolder, onToggleFile }) {
  const isOpen    = expanded.has(item.path)
  const isLoading = loadingPaths.has(item.path)
  const isChecked = selectedFiles.has(item.path)

  return (
    <>
      <div
        onClick={() => item.isFolder ? onToggleFolder(item.path) : onToggleFile(item.path)}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        className={`flex items-center gap-2 py-[5px] pr-4 cursor-pointer select-none group transition-colors duration-75
          ${isChecked ? 'bg-teal-500/[0.06]' : 'hover:bg-white/[0.03]'}`}
      >
        {item.isFolder ? (
          <span className="text-white/25 text-[10px] w-3 text-center flex-shrink-0">
            {isLoading ? '…' : isOpen ? '▾' : '▸'}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isChecked}
              disabled={!isChecked && maxReached}
              onChange={() => onToggleFile(item.path)}
              className="w-[11px] h-[11px] accent-teal-500 cursor-pointer disabled:cursor-not-allowed"
            />
          </span>
        )}

        <span className={`text-xs truncate flex-1 ${
          item.isFolder ? 'text-white/60 font-medium' : isChecked ? 'text-teal-300' : 'text-white/40'
        }`}>
          {item.nombre}
        </span>

        {!item.isFolder && item.size > 0 && (
          <span className="text-[10px] text-white/20 flex-shrink-0 ml-auto">
            {item.size < 1024 ? `${item.size}B` : `${(item.size / 1024).toFixed(1)}KB`}
          </span>
        )}
      </div>

      {item.isFolder && isOpen && tree[item.path] && (
        <TreeLevel items={tree[item.path]} depth={depth + 1} tree={tree} expanded={expanded}
          loadingPaths={loadingPaths} selectedFiles={selectedFiles} maxReached={maxReached}
          onToggleFolder={onToggleFolder} onToggleFile={onToggleFile} />
      )}
    </>
  )
}

// ── Utilidades ────────────────────────────────────────────────────

function Spinner({ small }) {
  return (
    <svg className={`animate-spin ${small ? 'h-3 w-3' : 'h-4 w-4'}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
      <path d="M8 10.5L4.5 7H7V2h2v5h2.5L8 10.5z" fill="currentColor"/>
      <path d="M3 12h10v1.5H3V12z" fill="currentColor"/>
    </svg>
  )
}
