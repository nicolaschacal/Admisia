# Guía de entrega y exposición — AdmisIA / Colegio Nubarian

## 1. Problema

El Colegio Nubarian recibe consultas de familias interesadas en Inicial y Primaria. Muchas preguntas se repiten: propuesta educativa, horarios, modalidades, proceso de inscripción y orientación económica. El equipo de Admisiones no siempre puede responder inmediatamente.

## 2. Solución

AdmisIA funciona como primer punto de contacto. La familia escribe en una interfaz de chat y recibe respuestas basadas en información institucional autorizada.

La IA no reemplaza al equipo de Admisiones: orienta y deriva a una entrevista o recorrida cuando la consulta necesita confirmación humana.

## 3. Uso de un LLM

El backend se comunica con el modelo Gemini de Google mediante su API.

Flujo:

1. La familia escribe una consulta.
2. El frontend envía un POST a `/api/chat`.
3. El backend valida el mensaje y agrega el contexto institucional.
4. Se envían a Gemini el system prompt, el historial reciente y la nueva pregunta.
5. Gemini genera una respuesta.
6. El backend devuelve JSON.
7. El frontend muestra la respuesta.

## 4. Contexto y prompt

### Rol
Asistente virtual de admisiones del Colegio Nubarian.

### Alcance
Exclusivamente Inicial y Primaria.

### Contexto
El prompt contiene información sobre propuesta educativa, modalidades, horarios, instalaciones, proceso de inscripción, contacto y valores estimativos 2026.

### Política económica
El colegio no comunica el detalle económico definitivo por WhatsApp o chat. El asistente puede brindar valores estimativos de referencia y debe aclarar que el detalle final se informa luego de conocer la propuesta y las instalaciones.

### Restricciones
- No inventar vacantes ni información institucional.
- No presentar costos estimativos como definitivos.
- No solicitar datos sensibles de menores.
- No mencionar niveles que el colegio no ofrece.
- Derivar a Admisiones cuando algo requiera confirmación.

## 5. Memoria temporal

El frontend guarda hasta las últimas 10 intervenciones en `sessionStorage`. Gemini no aprende permanentemente: el historial se vuelve a enviar en cada nueva consulta. Al tocar “Nueva consulta” el historial se elimina.

## 6. Demo sugerida

1. “¿Qué niveles tienen?”
2. “Mi hijo entra a Primaria, ¿qué propuesta ofrecen?”
3. “¿Y cuánto cuesta?” — debe mantener el contexto de Primaria.
4. “¿Tienen vacante?” — debe derivar a Admisiones.
5. Mostrar “Nueva consulta” para explicar cómo se borra la memoria temporal.

## 7. Frase de cierre

“Desarrollamos una aplicación cuyo backend se comunica con Gemini mediante API. En cada solicitud enviamos el contexto institucional, las reglas y el historial reciente de la conversación. De esa forma el modelo responde dentro del marco definido por el colegio.”
