CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'manager' CHECK (role IN ('admin','manager','viewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adult_name text,
  email text,
  phone text,
  source text NOT NULL DEFAULT 'chat',
  status text NOT NULL DEFAULT 'new_inquiry'
    CHECK (status IN (
      'new_inquiry','qualified','visit_scheduled','interview_completed',
      'followup','application_started','waitlist','enrolled','lost'
    )),
  level_interest text CHECK (level_interest IN ('inicial','primaria') OR level_interest IS NULL),
  assigned_manager_id uuid REFERENCES managers(id) ON DELETE SET NULL,
  notes text,
  privacy_consent_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ai_summary text,
  ai_interest_level text CHECK (ai_interest_level IN ('low','medium','high') OR ai_interest_level IS NULL),
  ai_primary_concern text,
  ai_next_action text,
  ai_analyzed_at timestamptz,
  last_contact_at timestamptz,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON leads(next_action_at);
CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON leads(lower(email));
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date NOT NULL,
  previous_institution text,
  comments text,
  level_interest text CHECK (level_interest IN ('inicial','primaria') OR level_interest IS NULL),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_lead ON students(lead_id);

CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text NOT NULL UNIQUE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_lead ON conversation_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversation_last_message ON conversation_sessions(last_message_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES managers(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','completed','no_show','cancelled')),
  source text NOT NULL DEFAULT 'chat',
  external_calendar_event_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status IN ('scheduled','confirmed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_start ON blocked_slots(start_at);

CREATE TABLE IF NOT EXISTS followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  assigned_manager_id uuid REFERENCES managers(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'manager_contact',
  title text NOT NULL,
  notes text,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','cancelled')),
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followups_due ON followups(status, due_at);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON followups(lead_id);

CREATE TABLE IF NOT EXISTS activities (
  id bigserial PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES managers(id) ON DELETE SET NULL,
  type text NOT NULL,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_pending ON email_jobs(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS crm_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO crm_settings(key, value) VALUES
  ('booking', '{"slotMinutes":30,"openHour":9,"closeHour":16,"minDaysAhead":1,"maxDaysAhead":30,"weekdays":[1,2,3,4,5]}'::jsonb),
  ('followup', '{"daysAfterInterview":2}'::jsonb)
ON CONFLICT (key) DO NOTHING;
