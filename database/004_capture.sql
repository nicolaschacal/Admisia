-- Captación de contactos sin visita: de dónde llegó cada candidato y qué pidió.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS capture_source text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS capture_detail text;
UPDATE leads SET capture_source='booking' WHERE capture_source IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_capture_source ON leads(capture_source);

INSERT INTO crm_settings(key, value) VALUES
  ('capture', '{"contactOffer":true,"vacancyAlerts":true,"vacancyText":"","brochure":true,"callback":true,"autoDetect":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
