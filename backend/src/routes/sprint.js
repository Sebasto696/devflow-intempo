import { Router }   from 'express';
import Anthropic    from '@anthropic-ai/sdk';
import { buildSprintPrompt } from '../prompts/sprintReport.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────

function getBase() {
  const org = process.env.AZURE_DEVOPS_ORG;
  const pat = process.env.AZURE_DEVOPS_PAT;
  if (!org || !pat) throw new Error('Faltan AZURE_DEVOPS_ORG o AZURE_DEVOPS_PAT en el .env');
  const token   = Buffer.from(`:${pat}`).toString('base64');
  const baseUrl = `https://dev.azure.com/${org}`;
  return { org, token, baseUrl };
}

function auth(token) {
  return { Authorization: `Basic ${token}` };
}

async function parseResponse(r) {
  const text = await r.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

// ── GET /api/sprint/equipos?project=X ────────────────────────────
// Lista los equipos del proyecto.

router.get('/equipos', async (req, res) => {
  try {
    const { token, baseUrl } = getBase();
    const { project } = req.query;
    if (!project) return res.status(400).json({ error: 'Falta el parámetro project' });

    const url  = `${baseUrl}/_apis/projects/${encodeURIComponent(project)}/teams?api-version=7.1`;
    const r    = await fetch(url, { headers: auth(token) });
    const data = await parseResponse(r);

    if (!r.ok) return res.status(r.status).json({ error: data?.message || data?._raw || `HTTP ${r.status}` });

    const equipos = (data.value || []).map(t => ({ id: t.id, nombre: t.name }));
    return res.json({ equipos });

  } catch (err) {
    console.error('Error listando equipos:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sprint/iteraciones?project=X&team=Y ─────────────────
// Lista las iteraciones (sprints) de un equipo.

router.get('/iteraciones', async (req, res) => {
  try {
    const { token, baseUrl } = getBase();
    const { project, team } = req.query;
    if (!project || !team) return res.status(400).json({ error: 'Faltan project o team' });

    const url  = `${baseUrl}/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?api-version=7.1`;
    const r    = await fetch(url, { headers: auth(token) });
    const data = await parseResponse(r);

    if (!r.ok) return res.status(r.status).json({ error: data?.message || data?._raw || `HTTP ${r.status}` });

    const iteraciones = (data.value || [])
      .map(it => ({
        id:           it.id,
        nombre:       it.name,
        path:         it.path,
        fechaInicio:  it.attributes?.startDate   || null,
        fechaFin:     it.attributes?.finishDate  || null,
        timeFrame:    it.attributes?.timeFrame   || null,
      }))
      .sort((a, b) => {
        if (!a.fechaInicio) return 1;
        if (!b.fechaInicio) return -1;
        return new Date(b.fechaInicio) - new Date(a.fechaInicio);
      });

    return res.json({ iteraciones });

  } catch (err) {
    console.error('Error listando iteraciones:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/sprint/generar ──────────────────────────────────────
// Obtiene los datos del sprint y genera el reporte con Claude.
// Body: { project, team, iterationId, iterationName, fechaInicio, fechaFin }

router.post('/generar', async (req, res) => {
  const { project, team, iterationId, iterationName, fechaInicio, fechaFin } = req.body;

  if (!project || !team || !iterationId) {
    return res.status(400).json({ error: 'Faltan project, team o iterationId' });
  }

  try {
    const { token, baseUrl } = getBase();

    // 1. Obtener work items del sprint
    const wiUrl  = `${baseUrl}/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations/${iterationId}/workitems?api-version=7.1`;
    const wiRes  = await fetch(wiUrl, { headers: auth(token) });
    const wiData = await parseResponse(wiRes);

    if (!wiRes.ok) {
      return res.status(wiRes.status).json({ error: wiData?.message || wiData?._raw || `HTTP ${wiRes.status}` });
    }

    const ids = [...new Set(
      (wiData.workItemRelations || []).map(r => r.target?.id).filter(Boolean)
    )];

    let workItems = [];

    if (ids.length > 0) {
      // 2. Obtener detalles de los work items (máx 200)
      const fields   = 'System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo,Microsoft.VSTS.Scheduling.StoryPoints,System.Tags,Microsoft.VSTS.Common.Priority';
      const detUrl   = `${baseUrl}/_apis/wit/workitems?ids=${ids.slice(0, 200).join(',')}&fields=${fields}&api-version=7.1`;
      const detRes   = await fetch(detUrl, { headers: auth(token) });
      const detData  = await parseResponse(detRes);

      if (!detRes.ok) {
        return res.status(detRes.status).json({ error: detData?.message || `HTTP ${detRes.status}` });
      }

      workItems = (detData.value || []).map(wi => ({
        id:       wi.id,
        titulo:   wi.fields['System.Title'] || '(sin título)',
        tipo:     wi.fields['System.WorkItemType'] || 'Work Item',
        estado:   wi.fields['System.State'] || 'Unknown',
        asignado: wi.fields['System.AssignedTo']?.displayName || null,
        puntos:   wi.fields['Microsoft.VSTS.Scheduling.StoryPoints'] ?? null,
        etiquetas: wi.fields['System.Tags']
          ? wi.fields['System.Tags'].split(';').map(t => t.trim()).filter(Boolean)
          : [],
      }));
    }

    // 3. Calcular resumen estadístico
    const porEstado = workItems.reduce((acc, wi) => {
      acc[wi.estado] = (acc[wi.estado] || 0) + 1;
      return acc;
    }, {});

    const porPersona = workItems.reduce((acc, wi) => {
      const key = wi.asignado || 'Sin asignar';
      if (!acc[key]) acc[key] = [];
      acc[key].push({ id: wi.id, titulo: wi.titulo });
      return acc;
    }, {});

    const puntosTotales = workItems.reduce((sum, wi) => sum + (wi.puntos || 0), 0);

    const resumen = { porEstado, porPersona, puntosTotales };

    // 4. Generar reporte con Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const { systemPrompt, userPrompt } = buildSprintPrompt({
      sprint:   { nombre: iterationName, fechaInicio, fechaFin },
      equipo:   team,
      proyecto: project,
      items:    workItems,
      resumen,
    });

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const markdown = message.content[0]?.text?.trim() || '';
    return res.json({ markdown, stats: { total: workItems.length, porEstado, puntosTotales } });

  } catch (err) {
    console.error('Error generando reporte de sprint:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
