export function buildReadmePrompt(repo, archivos) {
  const filesList = archivos
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n')

  const systemPrompt = `Eres un ingeniero de software senior experto en documentación técnica.
Genera READMEs profesionales y completos en español para proyectos de software internos.

El README debe incluir (solo las secciones que puedas inferir del código):
1. Título y descripción del módulo/repositorio
2. Tecnologías y dependencias principales
3. Estructura del proyecto
4. Instalación y configuración
5. Variables de entorno requeridas (si existen)
6. Cómo ejecutar en desarrollo y producción
7. Descripción de los módulos o componentes principales
8. Notas técnicas relevantes

Usa Markdown válido. No inventes información que no esté en el código proporcionado.
Responde únicamente con el contenido del README, sin texto adicional.`

  const userPrompt = `Genera un README.md completo para el repositorio "${repo}".

Archivos del proyecto:

${filesList}`

  return { systemPrompt, userPrompt }
}

export function buildApiPrompt(repo, archivos) {
  const filesList = archivos
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n')

  const systemPrompt = `Eres un ingeniero de software senior experto en documentación de APIs REST.
Genera documentación técnica completa y precisa de endpoints en español.

Para cada endpoint documenta:
- Método HTTP y ruta completa
- Descripción del propósito
- Parámetros: query params, path params y body (nombre, tipo, si es requerido, descripción)
- Respuesta exitosa: código HTTP y estructura JSON
- Posibles errores con sus códigos HTTP
- Ejemplo de request y response en JSON

Usa Markdown con tablas donde sea apropiado. Documenta únicamente lo que esté en el código.
Si detectas autenticación o middlewares, descríbelos al inicio.
Responde únicamente con el contenido de la documentación, sin texto adicional.`

  const userPrompt = `Genera la documentación de API/Endpoints para el repositorio "${repo}".

Archivos de rutas y endpoints:

${filesList}`

  return { systemPrompt, userPrompt }
}
