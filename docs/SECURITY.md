# Seguridad y privacidad

Este sistema almacena datos de familias y menores, por lo que debe operarse con controles más estrictos que el prototipo académico original.

## Controles incluidos

- consentimiento obligatorio antes de confirmar una entrevista;
- sesiones del dashboard en cookie HttpOnly;
- passwords con bcrypt;
- API keys solo en variables de entorno;
- separación entre chat público y APIs autenticadas;
- PostgreSQL privado en Docker;
- HTTPS mediante Caddy;
- registro de actividades;
- límite de tamaño en inputs;
- agenda validada en backend, nunca por Gemini.

## Recomendaciones de producción

- usar contraseñas aleatorias largas;
- rotar secretos si se filtran;
- limitar usuarios administradores;
- realizar backups;
- aplicar actualizaciones del sistema;
- habilitar firewall;
- no exponer el puerto 5432;
- revisar periódicamente los gestores activos;
- definir política de retención/borrado de datos.

## Datos enviados a Gemini

Las consultas del chat se envían al modelo para generar respuestas.

Los datos estructurados capturados en el formulario de reserva, como fecha de nacimiento, no son enviados al modelo para poder crear la entrevista.

El análisis interno con IA se basa prioritariamente en el historial de conversación y en datos no sensibles de gestión.
