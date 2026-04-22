import { useState, useEffect } from 'react'
import { marked } from 'marked'

export default function SprintReport({ proyecto }) {
  const [equipos,        setEquipos]        = useState([])
  const [loadingEquipos, setLoadingEquipos] = useState(false)
  const [equipoActual,   setEquipoActual]   = useState('')

  const [iteraciones,        setIteraciones]        = useState([])
  const [loadingIteraciones, setLoadingIteraciones] = useState(false)
  const [iteracionActual,    setIteracionActual]    = useState(null)

  const [generating, setGenerating] = useState(false)
  const [resultado,  setResultado]  = useState(null)   // { markdown, stats }
  const [error,      setError]      = useState(null)

  // Cargar equipos cuando cambia el proyecto
  useEffect(() => {
    if (!proyecto) return
    setEquipos([]); setEquipoActual(''); setIteraciones([])
    setIteracionActual(null); setResultado(null); setError(null)
    setLoadingEquipos(true)

    fetch(`/api/sprint/equipos?project=${encodeURIComponent(proyecto)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setEquipos(data.equipos || [])
        if (data.equipos?.length === 1) setEquipoActual(data.equipos[0].nombre)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingEquipos(false))
  }, [proyecto])

  // Cargar iteraciones cuando cambia el equipo
  useEffect(() => {
    if (!proyecto || !equipoActual) return
    setIteraciones([]); setIteracionActual(null); setResultado(null); setError(null)
    setLoadingIteraciones(true)

    fetch(`/api/sprint/iteraciones?project=${encodeURIComponent(proyecto)}&team=${encodeURIComponent(equipoActual)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        const its = data.iteraciones || []
        setIteraciones(its)
        // Pre-seleccionar el sprint actual si existe
        const actual = its.find(i => i.timeFrame === 'current') || its[0] || null
        setIteracionActual(actual)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingIteraciones(false))
  }, [equipoActual, proyecto])

  async function handleGenerar() {
    if (!iteracionActual) return
    setGenerating(true); setError(null); setResultado(null)

    try {
      const res  = await fetch('/api/sprint/generar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          project:       proyecto,
          team:          equipoActual,
          iterationId:   iteracionActual.id,
          iterationName: iteracionActual.nombre,
          fechaInicio:   iteracionActual.fechaInicio,
          fechaFin:      iteracionActual.fechaFin,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function handleDownloadMd() {
    if (!resultado?.markdown) return
    const nombre = `Reporte-Sprint-${iteracionActual?.nombre?.replace(/\s+/g, '-') || 'sprint'}.md`
    const blob   = new Blob([resultado.markdown], { type: 'text/markdown;charset=utf-8' })
    const url    = URL.createObjectURL(blob)
    const a      = Object.assign(document.createElement('a'), { href: url, download: nombre })
    a.click(); URL.revokeObjectURL(url)
  }

  function handleDownloadPDF() {
    if (!resultado?.markdown) return

    const bodyHtml  = marked.parse(resultado.markdown)
    const sprint    = iteracionActual?.nombre   || 'Sprint'
    const fechaIni  = iteracionActual?.fechaInicio ? fmtFecha(iteracionActual.fechaInicio) : ''
    const fechaFin  = iteracionActual?.fechaFin    ? fmtFecha(iteracionActual.fechaFin)    : ''
    const generadoEn = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Sprint — ${sprint}</title>
<style>
  @page { margin: 2.2cm 2.4cm; size: A4; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt;
    color: #111;
    line-height: 1.65;
    background: #fff;
  }

  /* ── Cabecera del documento ── */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 18px;
    margin-bottom: 24px;
    border-bottom: 2px solid #111;
  }
  .doc-brand { font-size: 11pt; font-weight: 700; letter-spacing: .04em; color: #111; }
  .doc-brand span { color: #0d9488; }
  .doc-meta { text-align: right; font-size: 9pt; color: #555; line-height: 1.5; }
  .doc-meta strong { color: #111; font-size: 10.5pt; }

  /* ── Estadísticas rápidas ── */
  .stats-row {
    display: flex;
    gap: 12px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }
  .stat-box {
    flex: 1;
    min-width: 90px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 10px 14px;
    text-align: center;
  }
  .stat-box .val { font-size: 20pt; font-weight: 700; color: #111; line-height: 1; }
  .stat-box .lbl { font-size: 8pt; color: #777; margin-top: 3px; text-transform: uppercase; letter-spacing: .05em; }
  .stat-box.accent { border-color: #0d9488; background: #f0fdfb; }
  .stat-box.accent .val { color: #0d9488; }

  /* ── Contenido Markdown ── */
  h1 { font-size: 17pt; font-weight: 700; margin: 20px 0 8px; color: #111; }
  h2 { font-size: 13pt; font-weight: 700; margin: 22px 0 6px; color: #111; padding-bottom: 5px; border-bottom: 1px solid #e5e5e5; }
  h3 { font-size: 11pt; font-weight: 600; margin: 16px 0 5px; color: #333; }

  p { margin-bottom: 8px; }

  ul, ol { padding-left: 20px; margin-bottom: 10px; }
  li { margin-bottom: 3px; }

  strong { font-weight: 600; }
  em     { font-style: italic; color: #444; }

  code {
    font-family: 'Courier New', monospace;
    font-size: 9pt;
    background: #f5f5f5;
    border: 1px solid #e5e5e5;
    border-radius: 3px;
    padding: 1px 5px;
  }

  blockquote {
    border-left: 3px solid #0d9488;
    margin: 10px 0;
    padding: 6px 14px;
    color: #444;
    background: #f9f9f9;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th {
    background: #111;
    color: #fff;
    padding: 7px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
    letter-spacing: .03em;
  }
  td {
    padding: 6px 10px;
    border-bottom: 1px solid #e5e5e5;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #fafafa; }

  hr { border: none; border-top: 1px solid #e5e5e5; margin: 16px 0; }

  /* ── Pie de página ── */
  .doc-footer {
    margin-top: 36px;
    padding-top: 12px;
    border-top: 1px solid #e5e5e5;
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    color: #999;
  }

  /* ── Saltos de página ── */
  h2 { page-break-after: avoid; }
  table, .stat-box { page-break-inside: avoid; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>

  <div class="doc-header">
    <div>
      <div class="doc-brand">INTEMPO <span>·</span> DevFlow</div>
      <div style="font-size:9pt;color:#777;margin-top:3px">Reporte Automático de Sprint</div>
    </div>
    <div class="doc-meta">
      <strong>${sprint}</strong><br>
      ${proyecto}<br>
      Equipo: ${equipoActual}<br>
      ${fechaIni && fechaFin ? `${fechaIni} — ${fechaFin}` : ''}
    </div>
  </div>

  ${resultado.stats ? `
  <div class="stats-row">
    <div class="stat-box">
      <div class="val">${resultado.stats.total}</div>
      <div class="lbl">Ítems totales</div>
    </div>
    ${Object.entries(resultado.stats.porEstado).map(([estado, count]) => `
    <div class="stat-box">
      <div class="val">${count}</div>
      <div class="lbl">${estado}</div>
    </div>`).join('')}
    ${resultado.stats.puntosTotales > 0 ? `
    <div class="stat-box accent">
      <div class="val">${resultado.stats.puntosTotales}</div>
      <div class="lbl">Story Points</div>
    </div>` : ''}
  </div>` : ''}

  <div class="content">${bodyHtml}</div>

  <div class="doc-footer">
    <span>Generado con Intempo DevFlow</span>
    <span>${generadoEn}</span>
  </div>

</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 600)
  }

  const canGenerate = !generating && iteracionActual && equipoActual

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Reporte de Sprint</h1>
        <p className="text-sm text-white/40 mt-1.5">
          Selecciona el equipo y sprint — la IA genera el reporte listo para presentar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Panel izquierdo: Selección ── */}
        <div className="bg-surface border border-white/[0.08] rounded-xl p-6 flex flex-col gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] uppercase text-teal-400 mb-1">Configuración</p>
            <h2 className="font-display text-lg font-bold text-white">Elige el sprint</h2>
          </div>

          <hr className="border-white/[0.07]" />

          {/* Equipo */}
          <Field label="Equipo">
            {loadingEquipos ? (
              <div className="input-base text-white/30 flex items-center gap-2"><Spinner small /> Cargando equipos…</div>
            ) : (
              <select
                value={equipoActual}
                onChange={e => setEquipoActual(e.target.value)}
                className="input-base"
              >
                <option value="">— Selecciona un equipo —</option>
                {equipos.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            )}
          </Field>

          {/* Iteración */}
          <Field label="Sprint / Iteración">
            {loadingIteraciones ? (
              <div className="input-base text-white/30 flex items-center gap-2"><Spinner small /> Cargando sprints…</div>
            ) : (
              <select
                value={iteracionActual?.id || ''}
                onChange={e => setIteracionActual(iteraciones.find(i => i.id === e.target.value) || null)}
                disabled={!equipoActual}
                className="input-base disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">— Selecciona un sprint —</option>
                {iteraciones.map(it => (
                  <option key={it.id} value={it.id}>
                    {it.nombre}{it.timeFrame === 'current' ? ' · Actual' : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* Info del sprint seleccionado */}
          {iteracionActual && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  iteracionActual.timeFrame === 'current'
                    ? 'text-teal-400 bg-teal-400/10 border-teal-400/20'
                    : iteracionActual.timeFrame === 'past'
                      ? 'text-white/30 bg-white/5 border-white/10'
                      : 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                }`}>
                  {iteracionActual.timeFrame === 'current' ? 'Sprint actual'
                    : iteracionActual.timeFrame === 'past' ? 'Finalizado'
                    : 'Futuro'}
                </span>
                <span className="text-sm font-medium text-white">{iteracionActual.nombre}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-white/40">
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-0.5">Inicio</p>
                  <p>{iteracionActual.fechaInicio ? fmtFecha(iteracionActual.fechaInicio) : 'N/D'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-0.5">Fin</p>
                  <p>{iteracionActual.fechaFin ? fmtFecha(iteracionActual.fechaFin) : 'N/D'}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerar}
            disabled={!canGenerate}
            className="bg-white hover:bg-zinc-100 disabled:bg-white/[0.05] disabled:text-white/20 disabled:cursor-not-allowed text-black font-semibold text-sm py-2.5 px-5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {generating ? <><Spinner /> Generando reporte…</> : 'Generar Reporte de Sprint'}
          </button>

          {!equipoActual && !loadingEquipos && (
            <p className="text-[11px] text-white/25 text-center -mt-2">Selecciona un equipo primero</p>
          )}
        </div>

        {/* ── Panel derecho: Output ── */}
        <div className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
              <strong className="font-medium">Error: </strong>{error}
            </div>
          )}

          {!resultado && !generating && !error && (
            <div className="bg-surface border border-dashed border-white/[0.08] rounded-xl p-12 flex flex-col items-center justify-center text-center gap-3 min-h-[320px]">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                <IconSprint />
              </div>
              <p className="text-sm text-white/30">El reporte aparecerá aquí</p>
              <p className="text-xs text-white/20 max-w-xs">
                Elige equipo y sprint, luego haz clic en Generar
              </p>
            </div>
          )}

          {generating && (
            <div className="bg-surface border border-white/[0.08] rounded-xl p-12 flex flex-col items-center justify-center gap-3 min-h-[320px]">
              <div className="w-7 h-7 border-2 border-teal-500/50 border-t-teal-400 rounded-full animate-spin" />
              <p className="text-sm text-white/50">Analizando sprint y generando reporte…</p>
              <p className="text-xs text-white/25">Puede tomar unos segundos</p>
            </div>
          )}

          {resultado && (
            <div className="bg-surface border border-white/[0.08] rounded-xl overflow-hidden">

              {/* Header con métricas rápidas */}
              <div className="px-5 py-4 border-b border-white/[0.07]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold tracking-[.16em] uppercase text-teal-400">Reporte generado</p>
                    <p className="text-sm text-white/60 mt-0.5">{iteracionActual?.nombre} · {equipoActual}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-1.5 text-xs text-white bg-teal-500/90 hover:bg-teal-500 px-3 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      <DownloadIcon /> PDF
                    </button>
                    <button
                      onClick={handleDownloadMd}
                      className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/90 border border-white/[0.08] hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <DownloadIcon /> .md
                    </button>
                  </div>
                </div>

                {/* Métricas rápidas */}
                {resultado.stats && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <StatBadge label="Total" value={resultado.stats.total} />
                    {Object.entries(resultado.stats.porEstado).map(([estado, count]) => (
                      <StatBadge key={estado} label={estado} value={count} />
                    ))}
                    {resultado.stats.puntosTotales > 0 && (
                      <StatBadge label="Story points" value={resultado.stats.puntosTotales} accent />
                    )}
                  </div>
                )}
              </div>

              {/* Preview del markdown */}
              <pre className="p-5 text-xs text-white/60 font-mono leading-relaxed overflow-auto max-h-[520px] whitespace-pre-wrap break-words">
                {resultado.markdown}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-white/60">{label}</label>
      {children}
    </div>
  )
}

function StatBadge({ label, value, accent }) {
  return (
    <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
      accent
        ? 'text-teal-400 bg-teal-400/10 border-teal-400/20'
        : 'text-white/40 bg-white/[0.04] border-white/[0.08]'
    }`}>
      <span className={`font-semibold ${accent ? 'text-teal-300' : 'text-white/70'}`}>{value}</span>
      {label}
    </span>
  )
}

function fmtFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Spinner({ small }) {
  return (
    <svg className={`animate-spin ${small ? 'h-3 w-3' : 'h-4 w-4'}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

function IconSprint() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6 text-white/20">
      <path d="M2 14V10M6 14V6M10 14V8M14 14V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
