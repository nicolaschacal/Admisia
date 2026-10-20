# AdmisIA — Colegio Nubarian

Proyecto académico de Inteligencia Artificial: un asistente virtual de admisiones para el Colegio Nubarian.

## Alcance

El asistente trabaja únicamente con los niveles que ofrece el Colegio Nubarian:

- Inicial
- Primaria

Dentro de Inicial puede orientar sobre Maternal, medio horario y tiempo completo.

## Objetivo

Dar una primera orientación a familias interesadas en conocer la propuesta educativa, horarios, modalidades, proceso de inscripción y valores estimativos de referencia.

Por política interna, el asistente no presenta los costos como información definitiva. Puede orientar con importes estimativos y recomienda conocer las instalaciones y conversar con Admisiones para recibir el detalle final.

## Arquitectura

`Familia → Frontend → POST /api/chat → Vercel Function / Backend → Gemini API → respuesta → Frontend`

## Memoria de conversación

El navegador conserva temporalmente hasta las últimas 10 intervenciones mediante `sessionStorage`. Así el asistente puede mantener el hilo de una conversación. Al seleccionar “Nueva consulta” se borra ese historial.

## Tecnologías

- HTML, CSS y JavaScript
- Node.js / Express para desarrollo local
- Vercel Functions para producción
- Gemini 3.5 Flash-Lite mediante API REST
- GitHub para versionado
- Vercel para despliegue

## Seguridad

- La variable `GEMINI_API_KEY` se guarda únicamente en el backend/Vercel.
- Nunca subir archivos `.env` al repositorio.
- El frontend nunca recibe la API key.
- El asistente no debe solicitar información sensible de menores.

## Ejecutar en local

1. Copiar `.env.example` a `backend/.env`.
2. Agregar una clave válida en `GEMINI_API_KEY`.
3. Desde `backend/`, ejecutar `npm install` y luego `npm run dev`.
4. Abrir `frontend/index.html` con Live Server.

## Producción

El proyecto está preparado para Vercel. El frontend utiliza `/api/chat`, que corresponde a `api/chat.js`.
