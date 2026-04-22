export function buildSprintPrompt({ sprint, equipo, proyecto, items, resumen }) {
  const fmt = (fecha) => fecha
    ? new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/D'

  const itemsList = items.map(item =>
    `| #${item.id} | ${item.tipo} | ${item.titulo} | ${item.estado} | ${item.asignado || '—'} | ${item.puntos ?? '—'} |`
  ).join('\n')

  const porEstado = Object.entries(resumen.porEstado)
    .map(([estado, count]) => `- **${estado}:** ${count}`)
    .join('\n')

  const porPersona = Object.entries(resumen.porPersona)
    .map(([persona, items]) => `- **${persona}:** ${items.length} ítem(s) — ${items.map(i => `#${i.id}`).join(', ')}`)
    .join('\n')

  const systemPrompt = `Eres un Scrum Master experto que genera reportes de sprint profesionales en español.
El reporte debe ser directo, visualmente claro con Markdown y útil para retrospectivas y presentaciones a stakeholders.

Estructura obligatoria del reporte:
1. Encabezado con nombre del sprint, proyecto, equipo y fechas
2. Resumen ejecutivo (2-3 líneas que sinteticen el sprint)
3. Tabla de métricas clave: ítems totales, completados, en progreso, pendientes, puntos completados vs planificados, % completado
4. Ítems completados (lista agrupada por tipo)
5. Ítems en progreso o pendientes (con observación si hay riesgo)
6. Distribución del equipo (quién trabajó en qué)
7. Observaciones y próximos pasos (máximo 3 puntos concretos basados en los datos)

Usa emojis de forma muy sutil para los encabezados de sección. Sé directo, no rellenes con texto genérico.
Responde solo con el contenido del reporte en Markdown, sin texto adicional.`

  const userPrompt = `Genera el reporte de sprint con esta información:

**Proyecto:** ${proyecto}
**Equipo:** ${equipo}
**Sprint:** ${sprint.nombre}
**Período:** ${fmt(sprint.fechaInicio)} → ${fmt(sprint.fechaFin)}

**Distribución por estado:**
${porEstado}

**Distribución por persona:**
${porPersona.length > 0 ? porPersona : '- Sin datos de asignación'}

**Puntos story planificados:** ${resumen.puntosTotales || 'N/D'}
**Total ítems en el sprint:** ${items.length}

**Tabla completa de ítems:**
| ID | Tipo | Título | Estado | Asignado | Puntos |
|----|------|--------|--------|----------|--------|
${itemsList}

Genera el reporte completo en Markdown.`

  return { systemPrompt, userPrompt }
}
