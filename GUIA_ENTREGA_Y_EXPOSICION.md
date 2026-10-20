# Guía de entrega y exposición — AdmisIA

## 1. Descripción del problema

El Colegio Horizonte recibe diariamente consultas de familias interesadas en una posible inscripción. Muchas preguntas se repiten: propuesta educativa, niveles, horarios, aranceles, descuentos y pasos para inscribirse. El equipo de Admisiones no siempre puede responder de inmediato y una demora puede hacer que una familia pierda interés.

## 2. Solución propuesta y justificación del uso de IA

Se propone AdmisIA, un asistente virtual disponible las 24 horas que responde consultas iniciales basándose exclusivamente en información autorizada del colegio.

Un LLM es adecuado porque las familias no formulan las preguntas siempre de la misma manera. La IA puede comprender lenguaje natural, identificar la intención de la consulta y transformar información institucional en una respuesta clara y contextualizada.

La IA no reemplaza al equipo de Admisiones: funciona como primera orientación y deriva a una entrevista cuando la consulta requiere confirmación humana.

## 3. Desarrollo e integración del LLM

Se utiliza Gemini con la librería `@google/genai`.

Flujo:

1. La familia escribe una consulta en el frontend.
2. JavaScript envía un POST a `/api/chat`.
3. El backend valida el mensaje.
4. El backend envía a Gemini el mensaje junto con el `systemInstruction`.
5. Gemini genera una respuesta siguiendo el contexto y las restricciones.
6. El backend devuelve JSON al frontend.
7. La respuesta se muestra en pantalla.

## 4. Configuración del sistema y diseño del prompt

### Rol
Asistente virtual de admisiones del Colegio Horizonte.

### Objetivo
Orientar a familias sobre propuesta educativa, niveles, horarios, aranceles y proceso de inscripción, y facilitar el paso a una entrevista.

### Contexto
El prompt contiene la información institucional ficticia autorizada: propuesta pedagógica, niveles, horarios, aranceles, descuentos y proceso de admisión.

### Estilo
Español, cálido, profesional, breve y fácil de entender.

### Restricciones
- No inventar vacantes, costos, descuentos ni becas.
- Si no existe información, derivar a Admisiones.
- No pedir datos sensibles ni documentación de menores.
- Limitar las respuestas al tema de admisiones.

### Estructura de respuestas
1. Respuesta directa.
2. Información relevante.
3. Próximo paso recomendado.

## 5. Guion sugerido para la exposición (5–10 minutos)

### Minuto 0–1: problema
“Elegimos trabajar sobre el proceso de admisiones de un colegio. Las familias suelen consultar las mismas cosas y esperan respuestas rápidas. Si el colegio demora, puede perder una potencial inscripción.”

### Minuto 1–2: solución
“Creamos AdmisIA, un asistente que brinda una primera orientación las 24 horas. No reemplaza al personal del colegio, sino que responde las consultas frecuentes y deriva las situaciones que requieren confirmación.”

### Minuto 2–4: cómo funciona
Mostrar la arquitectura: frontend → backend → Gemini → respuesta. Explicar que la API key está únicamente en el backend y que el frontend nunca accede a ella.

### Minuto 4–6: prompt
Mostrar `gemini.service.js` o `api/chat.js` y señalar rol, objetivo, contexto, estilo, restricciones y estructura. Explicar que estas instrucciones reducen respuestas inventadas y limitan a la IA a información autorizada.

### Minuto 6–8: demo
Probar tres preguntas:
- “¿Cuál es la propuesta educativa?”
- “Mi hijo entra a Primaria, ¿cuánto cuesta?”
- “¿Tienen vacantes para Primaria?”

La tercera es importante: la IA debería explicar que no puede asegurar una vacante y que debe confirmarla Admisiones.

### Cierre
“El valor del proyecto no es solamente usar Gemini, sino integrarlo dentro de un flujo real de atención y controlar su comportamiento mediante contexto y restricciones.”

## Preguntas que pueden hacer en la defensa

**¿Por qué usar IA y no respuestas predefinidas?**  
Porque un LLM puede interpretar distintas formas de preguntar y responder de manera contextual, sin obligar al usuario a navegar un menú rígido.

**¿Por qué hay un backend?**  
Para proteger la API key y controlar qué información se envía al modelo.

**¿Cómo evitamos que invente información?**  
Con un prompt explícito, contexto cerrado y reglas que le indican no inventar datos y derivar a Admisiones cuando algo no está definido.

**¿La IA confirma vacantes?**  
No. La disponibilidad debe confirmarla una persona del equipo de Admisiones.

**¿Qué mejoraríamos en una versión real?**  
Conectar una base de datos institucional, integrar formularios de contacto o CRM, agregar analítica de consultas y permitir que el equipo actualice los datos sin modificar código.
