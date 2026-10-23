# Guía de entrega y exposición — AdmisIA / Colegio privado

## 1. Problema

Un colegio privado recibe consultas de familias interesadas en su propuesta educativa. Muchas preguntas se repiten: propuesta educativa, horarios, modalidades, proceso de inscripción y orientación económica. El equipo de Admisiones no siempre puede responder inmediatamente.

## 2. Solución

AdmisIA funciona como primer punto de contacto. La familia escribe en una interfaz de chat y recibe respuestas basadas en información institucional autorizada.

La IA no reemplaza al equipo de Admisiones: orienta y deriva a una entrevista o recorrida cuando la consulta necesita confirmación humana.

## 3. Uso de un LLM

El sistema no está atado exclusivamente a Gemini. Desde el panel de configuración, el administrador puede seleccionar qué modelo LLM utilizar para el asistente y definir un segundo modelo como respaldo.

El modelo principal procesa las consultas normalmente. Si se configura un modelo secundario, este puede utilizarse como alternativa cuando el principal no está disponible o falla.

El sistema permite así trabajar con distintos proveedores de modelos, según las credenciales y configuraciones disponibles para cada instalación, sin tener que modificar la lógica del asistente ni el contexto institucional.

Flujo:

1. La familia escribe una consulta.
2. El frontend envía un POST a `/api/chat`.
3. El backend valida el mensaje y agrega el contexto institucional.
4. El sistema utiliza el modelo LLM seleccionado como principal, junto con el system prompt, el historial reciente y la nueva pregunta.
5. Si corresponde y está configurado, puede recurrir al modelo secundario como respaldo.
6. El backend devuelve JSON.
7. El frontend muestra la respuesta.

## 4. Selección de modelos

Desde **Configuración → Integraciones / IA**, el administrador puede definir:

- **Modelo principal:** LLM utilizado por defecto para responder las consultas.
- **Modelo secundario:** LLM de respaldo, opcional, utilizado cuando el principal no puede procesar la solicitud.

Esto permite elegir libremente entre los modelos compatibles con la instalación, en lugar de depender exclusivamente de Gemini. Las credenciales de cada proveedor se configuran en el entorno de la aplicación y no se exponen al navegador.

## 5. Contexto y prompt

### Rol
Asistente virtual de admisiones de un colegio privado.

### Alcance
El asistente responde exclusivamente sobre los niveles, servicios y procesos que el colegio tenga configurados en su información institucional.

### Contexto
El prompt contiene información sobre propuesta educativa, modalidades, horarios, instalaciones, proceso de inscripción, contacto y valores estimativos que el colegio decida proporcionar.

### Política económica
El colegio puede definir desde su configuración qué información económica puede comunicar el asistente. Cuando corresponda, debe aclarar si los valores son estimativos y derivar al equipo de Admisiones para el detalle definitivo.

### Restricciones
- No inventar vacantes ni información institucional.
- No presentar costos estimativos como definitivos.
- No solicitar datos sensibles de menores.
- No mencionar niveles o servicios que el colegio no tenga configurados.
- Derivar a Admisiones cuando algo requiera confirmación.

## 6. Memoria temporal

El frontend guarda hasta las últimas 10 intervenciones en `sessionStorage`. El historial se vuelve a enviar en cada nueva consulta junto con el contexto al modelo LLM seleccionado. Al tocar “Nueva consulta” el historial se elimina.

## 7. Demo sugerida

1. “¿Qué niveles tienen?”
2. “¿Qué propuesta educativa ofrecen?”
3. “¿Y cuánto cuesta?” — debe mantener el contexto de la conversación.
4. “¿Tienen vacante?” — debe derivar a Admisiones.
5. Mostrar la configuración de IA para explicar que el asistente puede utilizar un modelo principal y uno secundario.
6. Mostrar “Nueva consulta” para explicar cómo se borra la memoria temporal.

## 8. Frase de cierre

“Desarrollamos una aplicación cuyo backend se comunica con un modelo LLM mediante API. El administrador puede seleccionar el proveedor y modelo principal y, opcionalmente, configurar un segundo modelo como respaldo. En cada solicitud enviamos el contexto institucional, las reglas y el historial reciente de la conversación. De esa forma el modelo responde dentro del marco definido por el colegio, sin que la aplicación quede atada a un único proveedor de IA.”
