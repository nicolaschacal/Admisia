# AdmisIA

Asistente de admisiones con IA para colegios: chat estilo WhatsApp para las familias, agenda de visitas y panel de gestión.

## Instalación en 4 pasos

1. **Base de datos.** Creá una base PostgreSQL (Neon, Supabase, Railway o tu servidor) y copiá su URL.
2. **Variables mínimas.** En Vercel (o en tu `.env`) definí solo:
   - `DATABASE_URL`
   - `CRM_JWT_SECRET` (cualquier texto largo y aleatorio)
   - `CRON_SECRET` (otro texto largo)
3. **Migraciones.** `npm install && npm run db:migrate`. Se puede correr las veces que haga falta: aplica solo lo nuevo.
4. **Asistente inicial.** Entrá a `/dashboard`. Como no hay usuarios, aparece “Configuración inicial”: cargás el nombre del negocio y creás tu cuenta de administrador.

Después, en **Configuración → Primeros pasos** tenés la lista de lo que falta:

| Paso | Dónde |
|---|---|
| Datos del negocio (nombre, logo, dirección, redes, horario) | Configuración → Negocio |
| Horarios de visitas y bloqueos | Configuración → Agenda |
| Clave de IA (Gemini) | Configuración → Integraciones |
| Correo saliente (Gmail, Microsoft 365, Zoho u otro) | Configuración → Integraciones |
| Google Calendar (opcional) | Configuración → Integraciones |
| Información para el asistente | Base de conocimiento |
| Equipo y roles | Configuración → Equipo |

Cada integración tiene un botón de prueba. Las claves se guardan cifradas (AES-256-GCM) y nunca se envían al navegador. Si una integración ya está definida por variables de entorno, el panel lo indica y sigue funcionando sin cambios.

En una instalación nueva, el contenido de ejemplo de la base de conocimiento queda archivado: el asistente responde solo con lo que cargue el nuevo negocio.

---

## Qué incluye

- Chat público de admisiones con Gemini.
- Memoria temporal de conversación.
- Registro persistente de conversaciones en PostgreSQL.
- Agenda desde el día siguiente, de 09:00 a 16:00.
- Prevención de reservas superpuestas.
- Captura de datos de la familia y estudiante con consentimiento.
- Email al colegio y confirmación a la familia.
- Integración opcional con Google Calendar.
- Dashboard privado de gestores.
- Pipeline de candidatos.
- Agenda de entrevistas.
- Seguimientos y recordatorios.
- Tareas automáticas posteriores a una entrevista.
- Historial completo de cada candidato.
- Análisis interno con IA: resumen, nivel de interés, principal preocupación y próxima acción.
- Registro de origen UTM para medir campañas.
- Modo Vercel y modo servidor privado con Docker/PostgreSQL.

## Estados del pipeline

- Nuevo
- Interesado
- Visita agendada
- Seguimiento
- Inscripción iniciada
- Lista de espera
- Inscripto
- No continúa

## Flujo de agenda

1. La familia pide coordinar una visita.
2. El sistema consulta disponibilidad real.
3. Solo ofrece días desde mañana en adelante.
4. Horarios disponibles: 09:00 a 16:00.
5. La familia elige un horario.
6. Recién entonces se solicitan:
   - nombre y apellido
   - correo
   - teléfono
   - nombre del estudiante
   - fecha de nacimiento
   - institución de procedencia, si aplica
   - comentarios
   - consentimiento de tratamiento para el proceso de admisión
7. El backend revalida el horario.
8. Crea candidato, estudiante y entrevista.
9. Vincula la conversación previa del chat.
10. Envía notificaciones por email si SMTP está configurado.
11. Si Google Calendar está configurado, crea también el evento.

## Seguimiento posterior

Cuando un gestor marca una entrevista como realizada:

- el candidato pasa a seguimiento;
- se crea automáticamente una tarea para contactarlo;
- por defecto vence dos días después;
- el dashboard la muestra como pendiente;
- el sistema envía recordatorios al equipo;
- el gestor puede completar la tarea o crear una nueva.

El tiempo puede cambiarse con `FOLLOWUP_DELAY_DAYS`.

## Dashboard

Ruta:

`/dashboard`

Incluye:

- métricas;
- pipeline;
- agenda;
- seguimientos;
- consultas del chat;
- ficha detallada;
- historial de conversación;
- notas internas;
- próxima acción;
- análisis con IA.

## Opción recomendada para datos privados: servidor propio

El repositorio incluye:

- `Dockerfile`
- `docker-compose.yml`
- PostgreSQL privado
- Caddy con HTTPS automático
- Express para servir frontend y API

En esta modalidad PostgreSQL vive en una red Docker interna y el puerto 5432 no se publica a Internet.

### Instalación

1. Copiar `.env.server.example` a `.env`.
2. Configurar dominio, passwords y claves.
3. Apuntar el DNS del dominio al servidor.
4. Ejecutar:

```bash
docker compose up -d --build
```

La aplicación ejecuta la migración al iniciar y crea/actualiza el administrador si `CRM_ADMIN_PASSWORD` está definido.

## Vercel

También puede funcionar en Vercel, pero para el CRM necesita que `DATABASE_URL` sea accesible de forma segura desde Vercel.

Variables mínimas:

- `GEMINI_API_KEY`
- `DATABASE_URL`
- `DB_SSL`
- `CRM_JWT_SECRET`
- `CRON_SECRET`
- `ADMISSIONS_EMAIL`

Para emails:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

## Google Calendar opcional

Configurar:

- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

El calendario debe compartirse con la cuenta de servicio indicada en el JSON.

Cuando está activo:

- la disponibilidad tiene en cuenta eventos del calendario;
- una nueva entrevista crea un evento;
- una cancelación elimina el evento.

## Base de datos

Migración:

```bash
npm run db:migrate
```

Administrador:

```bash
npm run db:create-admin
```

## Seguridad

- Nunca subir archivos `.env`.
- La API key de Gemini no llega al navegador.
- Las contraseñas del CRM se guardan con bcrypt.
- La sesión del dashboard utiliza cookie HttpOnly.
- PostgreSQL no se expone en el despliegue Docker recomendado.
- Los datos personales se almacenan solo después de consentimiento.
- El análisis con IA utiliza la conversación ya procesada por el asistente; no necesita enviar fecha de nacimiento u otros datos de la ficha.
