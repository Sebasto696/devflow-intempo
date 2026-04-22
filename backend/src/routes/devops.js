import { Router } from 'express';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────

function getConfig(projectOverride) {
  const org     = process.env.AZURE_DEVOPS_ORG;
  const project = projectOverride || process.env.AZURE_DEVOPS_PROJECT;
  const pat     = process.env.AZURE_DEVOPS_PAT;
  const wiType  = process.env.AZURE_DEVOPS_WORK_ITEM_TYPE || 'Task';

  if (!org || !pat) {
    throw new Error('Configuración de Azure DevOps incompleta. Revisa AZURE_DEVOPS_ORG y AZURE_DEVOPS_PAT en el .env');
  }
  if (!project) {
    throw new Error('No se ha seleccionado ningún proyecto de Azure DevOps.');
  }

  const token   = Buffer.from(`:${pat}`).toString('base64');
  const baseUrl = `https://dev.azure.com/${org}`;

  return { org, project, pat, wiType, token, baseUrl };
}

function authHeaders(token) {
  return { 'Authorization': `Basic ${token}` };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tryParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function parseResponse(r) {
  const text = await r.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

// ── GET /api/devops/proyectos ─────────────────────────────────────
// Lista todos los proyectos de la organización.

router.get('/proyectos', async (_req, res) => {
  try {
    const org = process.env.AZURE_DEVOPS_ORG;
    const pat = process.env.AZURE_DEVOPS_PAT;
    if (!org || !pat) {
      return res.status(500).json({ error: 'Faltan AZURE_DEVOPS_ORG o AZURE_DEVOPS_PAT en el .env' });
    }
    const token   = Buffer.from(`:${pat}`).toString('base64');
    const baseUrl = `https://dev.azure.com/${org}`;

    const url  = `${baseUrl}/_apis/projects?api-version=7.1&$top=200`;
    const r    = await fetch(url, { headers: authHeaders(token) });
    const data = await parseResponse(r);

    if (!r.ok) {
      const msg = data?.message || data?._raw || `HTTP ${r.status}`;
      return res.status(r.status).json({ error: `Azure DevOps: ${msg}` });
    }

    const proyectos = (data.value || []).map(p => ({ id: p.id, nombre: p.name }));
    return res.json({ proyectos });

  } catch (err) {
    console.error('Error al traer proyectos:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/devops/estados ───────────────────────────────────────
// Trae los estados válidos del tipo de work item configurado.

router.get('/estados', async (req, res) => {
  try {
    const { project, wiType, token, baseUrl } = getConfig(req.query.project);

    const url = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitemtypes/${encodeURIComponent(wiType)}/states?api-version=7.1`;
    const r   = await fetch(url, { headers: authHeaders(token) });
    const data = await parseResponse(r);

    if (!r.ok) {
      const msg = data?.message || data?._raw || `HTTP ${r.status}`;
      return res.status(r.status).json({ error: `Azure DevOps: ${msg}` });
    }

    const estados = (data.value || []).map(s => s.name);
    return res.json({ estados });

  } catch (err) {
    console.error('Error al traer estados:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/devops/tareas-padre ──────────────────────────────────
// Trae todas las tareas activas del proyecto para mostrar como opciones
// de tarea padre al crear una historia de usuario.

router.get('/tareas-padre', async (req, res) => {
  try {
    const { project, token, baseUrl } = getConfig(req.query.project);

    const wiqlUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`;

    // Consulta de árbol: trae solo los work items que tienen hijos (son padres)
    const wiqlBody = {
      query: `
        SELECT [System.Id]
        FROM WorkItemLinks
        WHERE [Source].[System.TeamProject] = @project
          AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
          AND [Source].[System.State] <> 'Closed'
          AND [Source].[System.State] <> 'Done'
        MODE (MustContain)
      `
    };

    const wiqlRes  = await fetch(wiqlUrl, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(wiqlBody),
    });

    const wiqlData = await wiqlRes.json();

    if (!wiqlRes.ok) {
      const msg = wiqlData?.message || wiqlData?.value?.Message || 'Error en WIQL';
      return res.status(wiqlRes.status).json({ error: `Azure DevOps: ${msg}` });
    }

    // workItemRelations devuelve pares { source, target }.
    // Extraemos los IDs únicos de los padres (source).
    const relations  = wiqlData.workItemRelations || [];
    const padreIds   = [...new Set(
      relations
        .filter(r => r.rel === 'System.LinkTypes.Hierarchy-Forward' && r.source?.id)
        .map(r => r.source.id)
    )];

    if (padreIds.length === 0) {
      return res.json({ tareas: [] });
    }

    // Traer detalles de los padres
    const ids        = padreIds.slice(0, 200).join(',');
    const fieldsUrl  = `${baseUrl}/_apis/wit/workitems?ids=${ids}&fields=System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo&api-version=7.1`;
    const fieldsRes  = await fetch(fieldsUrl, { headers: authHeaders(token) });
    const fieldsData = await fieldsRes.json();

    if (!fieldsRes.ok) {
      const msg = fieldsData?.message || 'Error al traer detalles';
      return res.status(fieldsRes.status).json({ error: `Azure DevOps: ${msg}` });
    }

    const tareas = (fieldsData.value || []).map(wi => ({
      id:       wi.id,
      titulo:   wi.fields['System.Title'],
      estado:   wi.fields['System.State'],
      tipo:     wi.fields['System.WorkItemType'],
      asignado: wi.fields['System.AssignedTo']?.displayName || null,
    }));

    return res.json({ tareas });

  } catch (err) {
    console.error('Error al traer tareas padre:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/devops/push ─────────────────────────────────────────
// Crea un work item hijo bajo la tarea padre seleccionada (opcional).

router.post('/push', async (req, res) => {
  const { historia, parentId, estado, project: projectBody } = req.body;

  if (!historia) {
    return res.status(400).json({ error: 'No se recibió la historia de usuario.' });
  }

  try {
    const { org, project, wiType, token, baseUrl } = getConfig(projectBody);

    const encodedType = encodeURIComponent(wiType);
    const createUrl   = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodedType}?api-version=7.1`;

    // Descripción en HTML para Azure DevOps
    const criteriosHTML = historia.criterios_aceptacion
      .map(c => `<li>${escapeHtml(c)}</li>`)
      .join('');

    const descripcionHTML = `
<div>
  <p><strong>Historia de Usuario</strong></p>
  <p>${escapeHtml(historia.historia)}</p>
  <br/>
  <p><strong>Criterios de Aceptación</strong></p>
  <ul>${criteriosHTML}</ul>
  ${historia.notas ? `<br/><p><strong>Notas:</strong> ${escapeHtml(historia.notas)}</p>` : ''}
</div>`.trim();

    const prioridadMap = { 'Alta': 2, 'Media': 3, 'Baja': 4 };
    const prioridad    = prioridadMap[historia.prioridad] ?? 3;

    const patchBody = [
      { op: 'add', path: '/fields/System.Title',               value: historia.titulo },
      { op: 'add', path: '/fields/System.Description',         value: descripcionHTML },
      { op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: prioridad },
      { op: 'add', path: '/fields/System.Tags',                value: (historia.etiquetas || []).join('; ') },
      ...(estado ? [{ op: 'add', path: '/fields/System.State', value: estado }] : []),
      // StoryPoints solo en tipos Agile/Scrum
      ...(wiType !== 'Task' && wiType !== 'Bug'
        ? [{ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints', value: historia.estimacion_puntos }]
        : []),
      // Relación padre-hijo si se seleccionó una tarea padre
      ...(parentId
        ? [{
            op: 'add',
            path: '/relations/-',
            value: {
              rel: 'System.LinkTypes.Hierarchy-Reverse',
              url: `${baseUrl}/_apis/wit/workitems/${parentId}`,
              attributes: { comment: 'Historia generada automáticamente' },
            },
          }]
        : []),
    ];

    const response = await fetch(createUrl, {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify(patchBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Azure DevOps error:', response.status, responseText);
      const parsed = tryParse(responseText);
      const msg    = parsed?.message || parsed?.value?.Message || responseText;
      return res.status(response.status).json({ error: `Azure DevOps: ${msg}` });
    }

    const data         = JSON.parse(responseText);
    const workItemUrl  = data._links?.html?.href
      ?? `https://dev.azure.com/${org}/${project}/_workitems/edit/${data.id}`;

    return res.json({ success: true, workItemId: data.id, url: workItemUrl });

  } catch (err) {
    console.error('Error al enviar a Azure DevOps:', err);
    return res.status(500).json({ error: err.message || 'Error al conectar con Azure DevOps.' });
  }
});

export default router;
