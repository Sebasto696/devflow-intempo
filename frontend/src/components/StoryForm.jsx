export default function StoryForm({ onGenerate, loading }) {
  function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onGenerate({
      descripcion: fd.get('descripcion'),
      rol:         fd.get('rol')      || undefined,
      contexto:    fd.get('contexto') || undefined,
    })
  }

  return (
    <div className="bg-surface border border-white/[0.08] rounded-xl p-6 flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-bold tracking-[.16em] uppercase text-teal-400 mb-1">Entrada</p>
        <h2 className="font-display text-lg font-bold text-white">Describe la funcionalidad</h2>
        <p className="text-xs text-white/40 mt-1 leading-relaxed">
          Explícala como se la contarías a un colega. Sin tecnicismos obligatorios.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <Field label="Descripción" required>
          <textarea
            name="descripcion"
            required
            minLength={10}
            rows={5}
            placeholder="Ej: El usuario debe poder filtrar la lista de productos por categoría, precio y disponibilidad desde la pantalla principal del catálogo."
            className="input-base resize-none"
          />
        </Field>

        <Field label="Rol del usuario" hint="opcional">
          <input
            type="text"
            name="rol"
            placeholder="Ej: cliente, administrador, vendedor…"
            className="input-base"
          />
        </Field>

        <Field label="Contexto o épica" hint="opcional">
          <textarea
            name="contexto"
            rows={2}
            placeholder="Ej: Módulo de catálogo — Sprint 12"
            className="input-base resize-none"
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 bg-white hover:bg-zinc-100 disabled:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed text-black font-semibold text-sm py-2.5 px-5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Spinner /> Generando…</> : 'Generar Historia de Usuario'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="text-xs font-medium text-white/60">{label}</label>
        {required && <span className="text-teal-400 text-xs">*</span>}
        {hint && <span className="text-[11px] text-white/25">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}
