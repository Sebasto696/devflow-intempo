import { useState, useEffect, useRef } from 'react'
import StoryForm    from './components/StoryForm'
import StoryOutput  from './components/StoryOutput'
import DocGenerator from './components/DocGenerator'
import SprintReport from './components/SprintReport'

// ── Módulos disponibles ───────────────────────────────────────────

const MODULES = [
  {
    id:     'historias',
    num:    '01',
    label:  'Historias de Usuario',
    icon:   <IconStory />,
    ready:  true,
  },
  {
    id:     'docs',
    num:    '02',
    label:  'Documentación Técnica',
    icon:   <IconDocs />,
    ready:  false,
  },
  {
    id:     'sprint',
    num:    '03',
    label:  'Reporte de Sprint',
    icon:   <IconSprint />,
    ready:  true,
  },
  {
    id:     'pipelines',
    num:    '04',
    label:  'Monitor de Pipelines',
    icon:   <IconPipeline />,
    ready:  false,
  },
  {
    id:     'review',
    num:    '05',
    label:  'Code Review',
    icon:   <IconReview />,
    ready:  false,
  },
  {
    id:     'hub',
    num:    '06',
    label:  'Hub Empresarial',
    icon:   <IconHub />,
    ready:  false,
  },
]

// ── App ───────────────────────────────────────────────────────────

export default function App() {
  const [modulo, setModulo] = useState('historias')

  // Historia — Módulo 01
  const [historia, setHistoria] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  // Proyectos
  const [proyectos,        setProyectos]        = useState([])
  const [loadingProyectos, setLoadingProyectos] = useState(true)
  const [proyectoActual,   setProyectoActual]   = useState('')

  useEffect(() => {
    fetch('/api/devops/proyectos')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setProyectos(data.proyectos || [])
        if (data.proyectos?.length === 1) setProyectoActual(data.proyectos[0].nombre)
      })
      .catch(() => {})
      .finally(() => setLoadingProyectos(false))
  }, [])

  function handleProjectChange(nombre) {
    setProyectoActual(nombre)
    setHistoria(null)
    setError(null)
    // Si el módulo activo está deshabilitado, volver al 01
    const current = MODULES.find(m => m.id === modulo)
    if (current && !current.ready) setModulo('historias')
  }

  async function handleGenerate(formData) {
    setLoading(true)
    setError(null)
    setHistoria(null)
    try {
      const res  = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHistoria(data.historia)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const currentModule = MODULES.find(m => m.id === modulo)

  return (
    <div className="flex h-screen bg-black overflow-hidden">

      {/* ── Sidebar ── */}
      <Sidebar
        modulo={modulo}
        setModulo={(id) => { setModulo(id); setHistoria(null); setError(null) }}
        proyectos={proyectos}
        proyectoActual={proyectoActual}
        setProyectoActual={handleProjectChange}
        loadingProyectos={loadingProyectos}
      />

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-[52px] flex items-center px-6 border-b border-white/[0.07] flex-shrink-0 gap-2">
          <span className="text-white/30 text-sm font-medium">DevFlow</span>
          <span className="text-white/20 text-sm">/</span>
          <span className="text-sm text-white/70">{currentModule?.label}</span>
          <div className="ml-auto flex items-center gap-2">
            {proyectoActual && (
              <span className="flex items-center gap-1.5 text-xs text-white/40 bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                {proyectoActual}
              </span>
            )}
          </div>
        </header>

        {/* Contenido scrollable */}
        <main className="flex-1 overflow-y-auto p-8">

          {/* Sin proyecto seleccionado */}
          {!proyectoActual && !loadingProyectos ? (
            <div className="max-w-md mx-auto mt-20 text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-xl">
                ⬡
              </div>
              <div>
                <p className="text-white font-medium">Elige un proyecto</p>
                <p className="text-sm text-white/40 mt-1">
                  Selecciona el proyecto de Azure DevOps en el que estás trabajando desde el panel lateral.
                </p>
              </div>
            </div>
          ) : modulo === 'historias' ? (
            <ModuleHistorias
              historia={historia}
              loading={loading}
              error={error}
              proyectoActual={proyectoActual}
              onGenerate={handleGenerate}
            />
          ) : modulo === 'docs' ? (
            <DocGenerator proyecto={proyectoActual} />
          ) : modulo === 'sprint' ? (
            <SprintReport proyecto={proyectoActual} />
          ) : null}

        </main>
      </div>
    </div>
  )
}

// ── Módulo 01 ─────────────────────────────────────────────────────

function ModuleHistorias({ historia, loading, error, proyectoActual, onGenerate }) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Nueva Historia de Usuario</h1>
        <p className="text-sm text-white/40 mt-1.5">
          Describe la funcionalidad en lenguaje natural — la IA genera la historia lista para Azure DevOps.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="flex flex-col gap-3">
          <StoryForm onGenerate={onGenerate} loading={loading} />
          {error && (
            <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
              <strong className="font-medium">Error: </strong>{error}
            </div>
          )}
        </div>

        <div>
          {historia
            ? <StoryOutput key={JSON.stringify(historia)} historiaInicial={historia} proyecto={proyectoActual} />
            : <EmptyOutput loading={loading} />
          }
        </div>
      </div>
    </div>
  )
}

function EmptyOutput({ loading }) {
  return (
    <div className="bg-surface border border-white/[0.08] rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3 min-h-[320px]">
      {loading ? (
        <>
          <div className="w-7 h-7 border-2 border-teal-500/50 border-t-teal-400 rounded-full animate-spin" />
          <p className="text-sm text-white/50">Generando historia…</p>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/20">
            <IconStory />
          </div>
          <p className="text-sm text-white/40">La historia aparecerá aquí</p>
          <p className="text-xs text-white/20 max-w-xs">Completa el formulario y haz clic en Generar</p>
        </>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────

function Sidebar({ modulo, setModulo, proyectos, proyectoActual, setProyectoActual, loadingProyectos }) {
  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#0a0a0a] border-r border-white/[0.07]">

      {/* Logo */}
      <div className="h-[52px] flex items-center px-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-black font-bold text-[11px] font-display">IF</span>
          </div>
          <div className="leading-none">
            <div className="text-sm font-semibold text-white font-display">DevFlow</div>
            <div className="text-[10px] text-white/30 mt-0.5">Intempo</div>
          </div>
        </div>
      </div>

      {/* Project selector */}
      <div className="px-2 py-2 border-b border-white/[0.07]">
        <ProjectSelector
          proyectos={proyectos}
          proyectoActual={proyectoActual}
          setProyectoActual={setProyectoActual}
          loading={loadingProyectos}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.12em] px-2 mb-1.5">
          Automatización
        </p>
        {MODULES.map(m => (
          <NavItem
            key={m.id}
            item={m}
            active={modulo === m.id}
            onClick={() => m.ready && setModulo(m.id)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.07]">
        <p className="text-[10px] text-white/20">Área de Tecnología · Fase 1</p>
      </div>
    </aside>
  )
}

function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!item.ready}
      className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors duration-100 group
        ${active
          ? 'bg-white/[0.08] text-white'
          : item.ready
            ? 'text-white/45 hover:text-white/80 hover:bg-white/[0.04] cursor-pointer'
            : 'text-white/20 cursor-default'
        }`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-teal-400' : ''}`} style={{ width: 16, height: 16 }}>
        {item.icon}
      </span>
      <span className="flex-1 text-xs font-medium truncate">{item.label}</span>
      {item.ready ? (
        active && <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
      ) : (
        <span className="text-[9px] text-white/20 flex-shrink-0 font-medium">Pronto</span>
      )}
    </button>
  )
}

// ── Project Selector ──────────────────────────────────────────────

function ProjectSelector({ proyectos, proyectoActual, setProyectoActual, loading }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-white/30 text-xs">
        <div className="w-4 h-4 border border-white/20 border-t-white/50 rounded-full animate-spin" />
        Cargando…
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
      >
        <ProjectAvatar name={proyectoActual} size="sm" />
        <span className="flex-1 text-left text-xs text-white/70 truncate font-medium">
          {proyectoActual || 'Seleccionar proyecto'}
        </span>
        <svg className={`w-3 h-3 text-white/30 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#111] border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl z-50 py-1">
          {proyectos.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/30">Sin proyectos disponibles</p>
          ) : proyectos.map(p => (
            <button
              key={p.id}
              onClick={() => { setProyectoActual(p.nombre); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.05] transition-colors"
            >
              <ProjectAvatar name={p.nombre} size="sm" />
              <span className={`flex-1 text-left text-xs truncate ${p.nombre === proyectoActual ? 'text-white font-medium' : 'text-white/50'}`}>
                {p.nombre}
              </span>
              {p.nombre === proyectoActual && (
                <svg className="w-3 h-3 text-teal-400 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectAvatar({ name }) {
  const colors = ['#0d9488','#0891b2','#7c3aed','#b45309','#be185d','#15803d']
  const idx    = name ? name.charCodeAt(0) % colors.length : 0
  const bg     = name ? colors[idx] : '#333'
  const letter = name?.[0]?.toUpperCase() || '?'

  return (
    <span
      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
      style={{ background: bg }}
    >
      {letter}
    </span>
  )
}

// ── Icons ─────────────────────────────────────────────────────────

function IconStory() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconDocs() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M9 2v4h4M5.5 8.5h5M5.5 11h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconSprint() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M2 11V8M6 11V5M10 11V7M14 11V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconPipeline() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <circle cx="3" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="13" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4.5 8h2M9.5 8h2M8 5.5v1M8 9.5v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconReview() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M5 3.5L2 8l3 4.5M11 3.5L14 8l-3 4.5M9.5 2l-3 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconHub() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M8 2l1.5 4.5h4.5L10.5 9l1.5 4.5L8 11l-4 2.5L5.5 9 2 6.5h4.5L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}
