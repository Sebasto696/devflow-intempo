import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserPrompt } from '../prompts/userStory.js';

const router = Router();

router.post('/', async (req, res) => {
  const { descripcion, rol, contexto } = req.body;

  if (!descripcion || descripcion.trim().length < 10) {
    return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor.' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: buildSystemPrompt(),
      messages: [
        { role: 'user', content: buildUserPrompt(descripcion, rol, contexto) }
      ],
    });

    const raw = message.content[0].text.trim();

    // Extraer JSON aunque venga con texto extra
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('Respuesta IA sin JSON:', raw);
      return res.status(500).json({ error: 'La IA no devolvió un formato válido. Intenta de nuevo.' });
    }

    const historia = JSON.parse(match[0]);

    // Validación básica de campos obligatorios
    const required = ['titulo', 'historia', 'criterios_aceptacion', 'estimacion_puntos', 'prioridad'];
    for (const field of required) {
      if (historia[field] === undefined) {
        return res.status(500).json({ error: `Campo "${field}" faltante en la respuesta.` });
      }
    }

    return res.json({ success: true, historia });

  } catch (err) {
    console.error('Error al generar historia:', err);

    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'No se pudo parsear la respuesta de la IA.' });
    }
    if (err.status === 401) {
      return res.status(500).json({ error: 'API Key de Anthropic inválida.' });
    }

    return res.status(500).json({ error: err.message || 'Error interno al generar la historia.' });
  }
});

export default router;
