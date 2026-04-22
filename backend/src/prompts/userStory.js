export function buildSystemPrompt() {
  return `Eres un experto en metodologías ágiles especializado en redactar historias de usuario de alta calidad para equipos de software.
Tu tarea es transformar descripciones en lenguaje natural en historias de usuario estructuradas y profesionales.
Responde SIEMPRE con un JSON válido, sin texto adicional, sin markdown, sin bloques de código.`;
}

export function buildUserPrompt(descripcion, rol, contexto) {
  return `Genera una historia de usuario completa para la siguiente funcionalidad.

DESCRIPCIÓN DE LA FUNCIONALIDAD:
${descripcion}

ROL DEL USUARIO: ${rol || 'usuario'}
${contexto ? `CONTEXTO / ÉPICA: ${contexto}` : ''}

Devuelve ÚNICAMENTE este JSON (sin markdown):
{
  "titulo": "Título conciso, máximo 10 palabras, empieza con verbo infinitivo",
  "historia": "Como [${rol || 'usuario'}], quiero [acción específica], para [beneficio claro y medible].",
  "criterios_aceptacion": [
    "DADO [contexto inicial] CUANDO [el usuario realiza acción] ENTONCES [resultado observable y verificable]"
  ],
  "estimacion_puntos": 3,
  "prioridad": "Media",
  "etiquetas": ["etiqueta1", "etiqueta2"],
  "notas": "Consideraciones técnicas, dependencias o restricciones relevantes"
}

REGLAS:
- La historia sigue estrictamente: "Como [rol], quiero [qué], para [por qué]."
- Incluye entre 3 y 6 criterios de aceptación, todos verificables y sin ambigüedad
- Estimación en Fibonacci: 1, 2, 3, 5, 8, 13
- Prioridad: "Alta", "Media" o "Baja"
- Máximo 4 etiquetas relevantes
- Si no hay notas relevantes, deja "notas" como cadena vacía`;
}
