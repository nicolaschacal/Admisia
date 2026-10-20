# Arquitectura de AdmisIA CRM

## Componentes

```
Familia
  |
  v
Chat web
  |
  +----> Gemini API
  |
  +----> Agenda
  |        |
  |        +----> PostgreSQL
  |        +----> Google Calendar (opcional)
  |
  +----> Registro de conversación
           |
           v
       PostgreSQL

Gestores
  |
  v
/dashboard
  |
  +----> Pipeline
  +----> Agenda
  +----> Seguimientos
  +----> Historial
  +----> Análisis IA
```

## Modelo de datos

- `managers`: usuarios internos.
- `leads`: familias/candidatos.
- `students`: estudiantes vinculados a una familia.
- `conversation_sessions`: sesiones del chat.
- `conversation_messages`: mensajes.
- `appointments`: entrevistas.
- `blocked_slots`: bloqueos manuales.
- `followups`: tareas de seguimiento.
- `activities`: auditoría y timeline.
- `email_jobs`: cola/reintentos de correo.
- `crm_settings`: reglas configurables.

## Separación IA / lógica de negocio

Gemini interpreta lenguaje y genera respuestas.

Gemini NO decide:

- si un horario está disponible;
- si una reserva existe;
- si un candidato está inscripto;
- si una tarea está completada.

Esas decisiones pertenecen al backend y PostgreSQL.

## Memoria

Hay dos niveles:

1. `sessionStorage`: mejora la continuidad inmediata en el navegador.
2. PostgreSQL: conserva conversaciones para uso del CRM.

Gemini no aprende permanentemente. El historial relevante se envía como contexto en cada llamada.

## Recordatorios

- Al marcar una entrevista como realizada se crea un seguimiento.
- El worker procesa seguimientos cada hora en servidor privado.
- En Vercel también existe un Cron de lunes a viernes.
- Los emails fallidos quedan en cola y se reintentan.

## Evolución prevista

La tabla de seguimientos y la cola de correos permiten incorporar después:

- mensajes automáticos a familias;
- plantillas;
- WhatsApp Business API;
- secuencias de nurturing;
- recordatorios de documentación;
- automatizaciones por estado.
