CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS knowledge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual','document','url','import')),
  source_name text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','archived')),
  priority integer NOT NULL DEFAULT 0,
  valid_from date,
  valid_until date,
  created_by uuid REFERENCES managers(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES managers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_category ON knowledge_items(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_validity ON knowledge_items(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_fts
ON knowledge_items USING GIN (
  to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,''))
);

INSERT INTO knowledge_categories (name,description,sort_order) VALUES
('Institucional','Información general de la institución',10),
('Propuesta educativa','Propuesta pedagógica por nivel',20),
('Horarios y modalidades','Horarios, jornadas y extensiones',30),
('Costos','Valores de referencia y política económica',40),
('Admisiones','Proceso de inscripción, vacantes y visitas',50),
('Instalaciones y apoyos','Infraestructura y equipo de apoyo',60)
ON CONFLICT (name) DO NOTHING;

-- Plantillas en borrador: el asistente no las usa hasta que se completen y activen.
INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority,status)
SELECT c.id,
'Plantilla: institucional',
'Niveles, edades y datos generales.',
'[Completá] Qué niveles ofrecen (por ejemplo Inicial y Primaria), desde qué edad y hasta qué año.
Ubicación y barrio.
Años de trayectoria, enfoque o identidad institucional.',
ARRAY['institucional','niveles'],
50,
'draft'
FROM knowledge_categories c WHERE c.name='Institucional'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Plantilla: institucional');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority,status)
SELECT c.id,
'Plantilla: propuesta educativa',
'Qué incluye la propuesta en cada nivel.',
'[Completá] Para cada nivel: idiomas, tecnología, deportes, arte, proyectos especiales y certificaciones.
Qué distingue la propuesta de otras instituciones.',
ARRAY['propuesta','idiomas','tecnología','deportes'],
50,
'draft'
FROM knowledge_categories c WHERE c.name='Propuesta educativa'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Plantilla: propuesta educativa');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority,status)
SELECT c.id,
'Plantilla: horarios y modalidades',
'Horarios de entrada y salida y modalidades.',
'[Completá] Horario de cada nivel, jornada simple o completa, extensión horaria y su costo si corresponde.',
ARRAY['horarios','jornada','extensión'],
50,
'draft'
FROM knowledge_categories c WHERE c.name='Horarios y modalidades'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Plantilla: horarios y modalidades');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority,status)
SELECT c.id,
'Plantilla: costos',
'Cómo se informan los costos y valores orientativos.',
'[Completá] Si se informan valores por chat o solo después de la visita.
Matrícula, cuota mensual por nivel, alimentación y materiales.
Aclarar siempre que son valores de referencia.',
ARRAY['costos','cuota','matrícula'],
50,
'draft'
FROM knowledge_categories c WHERE c.name='Costos'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Plantilla: costos');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority,status)
SELECT c.id,
'Plantilla: admisiones',
'Pasos para inscribirse.',
'[Completá] Pasos del proceso: primera consulta, visita o entrevista, documentación, confirmación de vacante e inscripción.',
ARRAY['inscripción','admisión','vacantes'],
50,
'draft'
FROM knowledge_categories c WHERE c.name='Admisiones'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Plantilla: admisiones');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority,status)
SELECT c.id,
'Plantilla: instalaciones y apoyos',
'Espacios y equipo interdisciplinario.',
'[Completá] Espacios con los que cuenta (laboratorio, comedor, deportes, áreas al aire libre) y equipo de apoyo (psicología, psicopedagogía, etc.).',
ARRAY['instalaciones','apoyos'],
50,
'draft'
FROM knowledge_categories c WHERE c.name='Instalaciones y apoyos'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Plantilla: instalaciones y apoyos');

