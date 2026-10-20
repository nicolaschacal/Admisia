# AdmisIA — Colegio Horizonte

Proyecto académico de Inteligencia Artificial: un asistente virtual para responder consultas iniciales de familias interesadas en inscribir a sus hijos en un colegio.

> **Importante:** Colegio Horizonte, sus aranceles, horarios y demás datos son ficticios y se utilizan exclusivamente para esta demostración académica.

## Problema

Un colegio recibe muchas consultas repetitivas sobre propuesta educativa, niveles, horarios, costos e inscripciones. Cuando el equipo de Admisiones tarda en responder, las familias pueden abandonar la consulta o elegir otra institución.

## Solución

AdmisIA brinda una primera orientación 24/7. El frontend recibe la pregunta, el backend la envía a Gemini junto con un prompt institucional y devuelve una respuesta controlada. El modelo tiene reglas para no inventar vacantes, becas ni datos que no estén autorizados.

## Arquitectura

`Familia → Frontend → POST /api/chat → Backend → Gemini → Backend → Frontend`

## Tecnologías

- HTML, CSS y JavaScript
- Node.js / Express para desarrollo local
- Gemini mediante `@google/genai`
- Vercel para despliegue
- GitHub para versionado

## Ejecutar en local

1. Copiar `.env.example` a `backend/.env`.
2. Agregar una clave válida en `GEMINI_API_KEY`.
3. En `backend/`, ejecutar `npm install` y luego `npm run dev`.
4. Abrir `frontend/index.html` con Live Server.

El frontend usa `http://localhost:3000/api/chat` cuando detecta localhost.

## Publicar en Vercel

1. Importar este repositorio en Vercel.
2. Crear la variable de entorno `GEMINI_API_KEY` en Vercel.
3. Desplegar.

En producción el frontend usa `/api/chat`, que corresponde a `api/chat.js`.

## Seguridad

- Nunca subir `.env` al repositorio.
- Nunca poner la API key en el frontend.
- No solicitar información sensible de menores desde el asistente.
