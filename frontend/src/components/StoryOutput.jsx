import { useState, useEffect } from 'react'

const PRIORIDADES = ['Alta', 'Media', 'Baja']
const FIBONACCI   = [1, 2, 3, 5, 8, 13]

export default function StoryOutput({ historiaInicial, proyecto }) {
  const [h, setH]                = useState(historiaInicial)
  const [criteriosText, setCtxt] = useState(historiaInicial.criterios_aceptacion.join('\n'))
  const [pushing,    setPushing]   = useState(false)
  const [result,     setResult]    = useState(null)
  const [pushError,  setPushError] = useState(null)
  const [copied,     setCopied]    = useState(false)

  const [tareasPadre,      setTareasPadre]      = useState([])
  const [loadingTareas,    setLoadingTareas]    = useState(false)
  const [tareasPadreError, setTareasPadreError] = useState(null)
  const [parentId,         setParentId]         = useState('')
  const [estados,          setEstados]          = useState([])
  const [estado,           setEstado]           = useState('')

  useEffect(() => {
    setLoadingTareas(true)
    const qs = proyecto ? `?project=${encodeURIComponent(proyecto)}` : ''
    Promise.all([
      fetch(`/api/devops/tareas-padre${qs}`).then(r => r.json()),
      fetch(`/api/devops/estados${qs}`).then(r => r.json()),
    ])
      .then(([tareas, est]) => {
        if (tareas.error) throw new Error(tareas.error)
        setTareasPadre(tareas.tareas || [])
        if (!est.error && est.estados?.length) {
          setEstados(est.estados)
          setEstado(est.estados[0])
        }
      })
      .catch(err => setTareasPadreError(err.message))
      .finally(() => setLoadingTareas(false))
  }, [])

  function update(field, value) {
    setH(prev => ({ ...prev, [field]: value }))
  }

  async function handlePush() {
    setPushing(true)
    setPushError(null)
    setResult(null)
    const payload = {
      ...h,
      criterios_aceptacion: criteriosText.split('\n').map(s => s.trim()).filter(Boolean),
    }
    try {
      const res  = await fetch('/api/devops/push', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ historia: payload, parentId: parentId || undefined, estado: estado || undefined, project: proyecto || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (err) {
      setPushError(err.message)
    } finally {
      setPushing(false)
    }
  }

  function handleCopy() {
    const criterios = criteriosText.split('\n').filter(Boolean)
    const text = [
      `TÍTULO: ${h.titulo}`, '',
      `HISTORIA: ${h.historia}`, '',
      'CRITERIOS DE ACEPTACIÓN:',
      ...criterios.map((c, i) => `  ${i + 1}. ${c}`), '',
      `ESTIMACIÓN: ${h.estimacion_puntos} pts  |  PRIORIDAD: ${h.prioridad}`,
      h.etiquetas?.length ? `ETIQUETAS: ${h.etiquetas.join(', ')}` : '',
      h.notas ? `\nNOTAS: ${h.notas}` : '',
    ].filter(l => l !== undefined).join('\n')

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const prioridadColor = { Alta: 'text-red-400 bg-red-400/10 border-red-400/20', Media: 'text-amber-400 bg-amber-400/10 border-amber-400/20', Baja: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' }

  return (
    <div className="bg-surface border border-white/[0.08] rounded-xl flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] uppercase text-teal-400 mb-0.5">Generado</p>
          <h2 className="font-display text-lg font-bold text-white">Revisa y ajusta</h2>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-white/40 hover:text-white/80 border border-white/[0.08] hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="p-6 flex flex-col gap-4">

        {/* Título */}
        <Field label="Título">
          <input type="text" value={h.titulo} onChange={e => update('titulo', e.target.value)} className="input-base" />
        </Field>

        {/* Historia */}
        <Field label="Historia de usuario">
          <textarea rows={3} value={h.historia} onChange={e => update('historia', e.target.value)} className="input-base resize-none" />
        </Field>

        {/* Criterios */}
        <Field label="Criterios de aceptación" hint="Un criterio por línea">
          <textarea
            rows={Math.max(4, criteriosText.split('\n').length + 1)}
            value={criteriosText}
            onChange={e => setCtxt(e.target.value)}
            className="input-base resize-none font-mono text-xs leading-relaxed"
          />
        </Field>

        {/* Estimación + Prioridad */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Story points">
            <select value={h.estimacion_puntos} onChange={e => update('estimacion_puntos', Number(e.target.value))} className="input-base">
              {FIBONACCI.map(n => <option key={n} value={n}>{n} {n === 1 ? 'punto' : 'puntos'}</option>)}
            </select>
          </Field>
          <Field label="Prioridad">
            <select value={h.prioridad} onChange={e => update('prioridad', e.target.value)} className="input-base">
              {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        {/* Badge de prioridad */}
        <div className="flex items-center gap-2 -mt-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${prioridadColor[h.prioridad] || 'text-white/40 bg-white/5 border-white/10'}`}>
            {h.prioridad}
          </span>
          <span className="text-[10px] text-white/25">{h.estimacion_puntos} {h.estimacion_puntos === 1 ? 'punto' : 'puntos'}</span>
        </div>

        {/* Etiquetas */}
        <Field label="Etiquetas" hint="Separadas por coma">
          <input
            type="text"
            value={(h.etiquetas || []).join(', ')}
            onChange={e => update('etiquetas', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
            className="input-base"
          />
        </Field>

        {/* Notas */}
        {(h.notas || '') !== '' && (
          <Field label="Notas técnicas">
            <textarea rows={2} value={h.notas} onChange={e => update('notas', e.target.value)} className="input-base resize-none" />
          </Field>
        )}

        <div className="border-t border-white/[0.07] pt-4 flex flex-col gap-3">

          {/* Estado inicial */}
          {estados.length > 0 && (
            <Field label="Estado inicial">
              <select value={estado} onChange={e => setEstado(e.target.value)} className="input-base">
                {estados.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}

          {/* Tarea padre */}
          <Field label="Tarea padre" hint="opcional">
            {loadingTareas ? (
              <div className="input-base text-white/30 flex items-center gap-2">
                <Spinner small /> Cargando tareas…
              </div>
            ) : tareasPadreError ? (
              <div className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">
                {tareasPadreError}
              </div>
            ) : (
              <select value={parentId} onChange={e => setParentId(e.target.value)} className="input-base">
                <option value="">— Sin tarea padre —</option>
                {tareasPadre.map(t => (
                  <option key={t.id} value={t.id}>
                    [{t.tipo}] #{t.id} · {t.titulo}{t.asignado ? ` — ${t.asignado}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* Info tarea padre */}
          {parentId && (() => {
            const t = tareasPadre.find(t => String(t.id) === String(parentId))
            return t ? (
              <div className="flex items-center gap-2 text-xs text-white/30 -mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400/60" />
                {t.estado}{t.asignado && <> · {t.asignado}</>}
              </div>
            ) : null
          })()}

          {/* Resultado */}
          {result ? (
            <div className="bg-teal-500/[0.07] border border-teal-500/20 rounded-xl p-4 flex flex-col gap-1.5">
              <p className="text-sm font-medium text-teal-300">✓ Work Item creado</p>
              <p className="text-xs text-white/40">#{result.workItemId}</p>
              <a href={result.url} target="_blank" rel="noreferrer" className="text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2">
                Abrir en Azure DevOps →
              </a>
            </div>
          ) : (
            <>
              {pushError && (
                <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
                  {pushError}
                </div>
              )}
              <button
                onClick={handlePush}
                disabled={pushing}
                className="bg-white hover:bg-zinc-100 disabled:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed text-black font-semibold text-sm py-2.5 px-5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {pushing ? <><Spinner /> Enviando…</> : <><AzureIcon /> {parentId ? 'Crear como subtarea' : 'Crear en Azure DevOps'}</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="text-xs font-medium text-white/60">{label}</label>
        {hint && <span className="text-[11px] text-white/25">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Spinner({ small }) {
  return (
    <svg className={`animate-spin ${small ? 'h-3 w-3' : 'h-4 w-4'}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

function AzureIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.05 4.24L6.56 18.05l-2.49.01 5.35-9.6-2.88-5.07 6.51.85zM14.39 5.87l4.6 12.17H8.29l5.6-2.09-2.99-5.26 3.49-4.82z"/>
    </svg>
  )
}
