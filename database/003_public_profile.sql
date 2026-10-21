-- Perfil público inicial (neutro). Cada institución lo completa desde
-- Panel → Configuración → Negocio.
INSERT INTO crm_settings(key, value) VALUES
(
  'profile',
  '{
    "name":"Admisiones",
    "category":"Educación",
    "openHour":8,
    "closeHour":18,
    "weekdays":[1,2,3,4,5],
    "badgeEnabled":true
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
