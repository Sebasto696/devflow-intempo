import { Router } from 'express';

const router = Router();

const IGNORE_FOLDERS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', '.vscode', 'vendor', 'bin', 'obj'])
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib', '.class', '.jar', '.bin', '.cache'])

function getConfig(project) {
  const org = process.env.AZURE_DEVOPS_ORG
  const pat = process.env.AZURE_DEVOPS_PAT
  if (!org || !pat) throw new Error('Faltan AZURE_DEVOPS_ORG o AZURE_DEVOPS_PAT en el .env')
  if (!project)     throw new Error('No se especificó proyecto')
  const token   = Buffer.from(`:${pat}`).toString('base64')
  const baseUrl = `https://dev.azure.com/${org}`
  return { project, token, baseUrl }
}

function authHeader(token) {
  return { Authorization: `Basic ${token}` }
}

async function parseResponse(r) {
  const text = await r.text()
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { _raw: text } }
}

function isBinary(path) {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  return BINARY_EXTENSIONS.has(ext)
}

function isIgnored(path) {
  const parts = path.split('/').filter(Boolean)
  return parts.some(p => IGNORE_FOLDERS.has(p))
}

// ── GET /api/repos?project=X ──────────────────────────────────────
// Lista todos los repositorios del proyecto.

router.get('/', async (req, res) => {
  try {
    const { project, token, baseUrl } = getConfig(req.query.project)
    const url  = `${baseUrl}/${encodeURIComponent(project)}/_apis/git/repositories?api-version=7.1`
    const r    = await fetch(url, { headers: authHeader(token) })
    const data = await parseResponse(r)

    if (!r.ok) return res.status(r.status).json({ error: data?.message || data?._raw || `HTTP ${r.status} al listar repos` })

    const repos = (data.value || []).map(repo => ({
      id:            repo.id,
      nombre:        repo.name,
      defaultBranch: repo.defaultBranch?.replace('refs/heads/', '') || 'main',
    }))

    return res.json({ repos })
  } catch (err) {
    console.error('Error listando repos:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /api/repos/:repoId/tree?project=X&path=/ ─────────────────
// Devuelve los hijos directos de un path (un nivel, lazy load).

router.get('/:repoId/tree', async (req, res) => {
  try {
    const { project, token, baseUrl } = getConfig(req.query.project)
    const scopePath = req.query.path || '/'

    const url  = `${baseUrl}/${encodeURIComponent(project)}/_apis/git/repositories/${req.params.repoId}/items?scopePath=${encodeURIComponent(scopePath)}&recursionLevel=OneLevel&includeContentMetadata=true&api-version=7.1`
    const r    = await fetch(url, { headers: authHeader(token) })
    const data = await parseResponse(r)

    if (!r.ok) return res.status(r.status).json({ error: data?.message || data?._raw || `HTTP ${r.status} al listar archivos` })

    const items = (data.value || [])
      .filter(item => item.path !== scopePath)
      .filter(item => !isIgnored(item.path))
      .filter(item => item.isFolder || !isBinary(item.path))
      .map(item => ({
        path:     item.path,
        nombre:   item.path.split('/').pop(),
        isFolder: item.isFolder ?? (item.gitObjectType === 'tree'),
        size:     item.size ?? 0,
      }))
      .sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
        return a.nombre.localeCompare(b.nombre)
      })

    return res.json({ items })
  } catch (err) {
    console.error('Error listando árbol:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /api/repos/content?project=X ────────────────────────────
// Devuelve el contenido de hasta 10 archivos seleccionados.
// Body: { repoId, paths: ['/src/index.js', ...] }

router.post('/content', async (req, res) => {
  try {
    const { project, token, baseUrl } = getConfig(req.query.project)
    const { repoId, paths } = req.body

    if (!repoId || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'Faltan repoId o paths' })
    }

    const MAX_CHARS  = 8000
    const MAX_FILES  = 10

    const archivos = await Promise.all(
      paths.slice(0, MAX_FILES).map(async path => {
        try {
          const url = `${baseUrl}/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/items?path=${encodeURIComponent(path)}&api-version=7.1`
          const r   = await fetch(url, {
            headers: { ...authHeader(token), Accept: 'text/plain' },
          })

          if (!r.ok) return { path, content: null, error: true }

          const content   = await r.text()
          const truncated = content.length > MAX_CHARS

          return {
            path,
            content:   truncated ? content.slice(0, MAX_CHARS) + '\n\n// ... (archivo truncado por tamaño)' : content,
            truncated,
          }
        } catch {
          return { path, content: null, error: true }
        }
      })
    )

    return res.json({ archivos: archivos.filter(f => f.content !== null) })
  } catch (err) {
    console.error('Error obteniendo contenido:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router;
