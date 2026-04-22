import { Router }          from 'express';
import Anthropic           from '@anthropic-ai/sdk';
import { buildReadmePrompt, buildApiPrompt } from '../prompts/techDoc.js';

const router = Router();

// ── POST /api/docs/generate ───────────────────────────────────────
// Genera documentación Markdown a partir de archivos de código.
// Body: { tipo: 'readme' | 'api', repo: string, archivos: [{ path, content }] }

router.post('/generate', async (req, res) => {
  const { tipo, repo, archivos } = req.body

  if (!tipo || !repo || !Array.isArray(archivos) || archivos.length === 0) {
    return res.status(400).json({ error: 'Faltan tipo, repo o archivos' })
  }

  if (!['readme', 'api'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo no válido. Usa "readme" o "api"' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const { systemPrompt, userPrompt } = tipo === 'readme'
      ? buildReadmePrompt(repo, archivos)
      : buildApiPrompt(repo, archivos)

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const markdown = message.content[0]?.text?.trim() || ''
    return res.json({ markdown })

  } catch (err) {
    console.error('Error generando documentación:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router;
