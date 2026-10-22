-- Captación de contactos sin visita. El origen se guarda en leads.source
-- (info, vacancy, brochure, callback, detected) y el detalle en activities,
-- así no hace falta modificar tablas existentes.
INSERT INTO crm_settings(key, value) VALUES
  ('capture', '{"contactOffer":true,"vacancyAlerts":true,"vacancyText":"","brochure":true,"callback":true,"autoDetect":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
