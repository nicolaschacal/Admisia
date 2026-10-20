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
('Institucional','Información general y canales de contacto',10),
('Propuesta educativa','Propuesta pedagógica por nivel y áreas',20),
('Horarios y modalidades','Horarios, jornadas y extensiones',30),
('Costos 2026','Valores estimativos y política económica',40),
('Admisiones','Proceso de inscripción, vacantes y visitas',50),
('Instalaciones y apoyos','Infraestructura y equipo interdisciplinario',60)
ON CONFLICT (name) DO NOTHING;

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Información general del Colegio Nubarian',
'El Colegio Nubarian ofrece Inicial y Primaria en Montevideo.',
'Institución: Colegio Nubarian, Montevideo, Uruguay.
Niveles: Inicial y Primaria.
Inicial comprende propuestas para niños de 1 a 5 años.
Primaria comprende de 1.º a 6.º año.
Dirección: Agraciada 2850, Montevideo, Uruguay.
Teléfono: 2208 0628.
Instagram: @colegionubarian.
Correo: nubarian@nubarian.edu.uy.
Sitio web: https://nubarian.edu.uy.',
ARRAY['institucional','niveles','contacto','ubicación'],
100
FROM knowledge_categories c WHERE c.name='Institucional'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Información general del Colegio Nubarian');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Propuesta educativa de Inicial',
'Inicial integra desarrollo integral, juego, expresión, inglés e informática inicial.',
'En Inicial la propuesta incluye expresión artística, música, inglés, un primer acercamiento a informática, Educación Física, Psicomotricidad y acompañamiento del equipo interdisciplinario. La propuesta busca una formación integral basada en el disfrute, la curiosidad y la felicidad de aprender.',
ARRAY['inicial','nivel 1','nivel 2','nivel 3','nivel 4','nivel 5','inglés','informática','psicomotricidad'],
100
FROM knowledge_categories c WHERE c.name='Propuesta educativa'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Propuesta educativa de Inicial');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Propuesta educativa de Primaria',
'Primaria incluye inglés ANGLO, informática, robótica, STEAM y deportes.',
'En Primaria la propuesta incluye inglés con certificación ANGLO, informática, robótica y STEAM, Educación Física y Deportes, docentes curriculares y equipo interdisciplinario. La propuesta integra tradición, innovación y dinamismo.',
ARRAY['primaria','inglés','anglo','robótica','steam','deportes'],
100
FROM knowledge_categories c WHERE c.name='Propuesta educativa'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Propuesta educativa de Primaria');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Horarios y modalidades',
'Primaria es jornada completa; Inicial tiene modalidades según edad y carga horaria.',
'Primaria: jornada completa, horario de referencia de 8:00 a 17:00.
Inicial: modalidad medio horario y tiempo completo.
Inicial medio horario: referencia de 5 horas.
Maternal dentro de Inicial: medio horario de 3 a 4 horas, intermedio de 5 a 6 horas y completo de 7 a 9 horas.
Extensión horaria de 17:00 a 18:00 disponible a partir de nivel 2, con costo estimativo UYU 2.000.
Los horarios exactos según nivel y modalidad deben confirmarse con Admisiones.',
ARRAY['horarios','primaria','inicial','maternal','extensión'],
100
FROM knowledge_categories c WHERE c.name='Horarios y modalidades'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Horarios y modalidades');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Política económica y matrícula 2026',
'Los valores por chat son estimativos; el detalle definitivo se informa luego de conocer el colegio.',
'Por política interna, el colegio no ofrece el detalle económico definitivo por WhatsApp o chat. Se prefiere informar el detalle completo luego de que la familia conozca las instalaciones y la propuesta.
Sí se pueden compartir valores estimativos de referencia, dejando claro que son orientativos y que la información final se confirma con Admisiones.
Matrícula estimativa: UYU 10.500. Puede abonarse hasta en 4 cuotas.',
ARRAY['costos','precios','matrícula','2026'],
100
FROM knowledge_categories c WHERE c.name='Costos 2026'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Política económica y matrícula 2026');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Costos estimativos Primaria 2026',
'Valores orientativos para Primaria completa.',
'Primaria completo:
Cuota educativa mensual estimativa: UYU 29.600.
Servicio de alimentación mensual estimativo: UYU 5.700.
Anualidad educativa estimativa: UYU 355.200.
Anualidad de alimentación estimativa: UYU 57.000.
Anualidad materiales estimativa: UYU 5.100.
Los valores son orientativos y deben confirmarse con Admisiones.',
ARRAY['primaria','costos','cuota','alimentación','2026'],
90
FROM knowledge_categories c WHERE c.name='Costos 2026'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Costos estimativos Primaria 2026');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Costos estimativos Inicial 2026',
'Valores orientativos para Inicial y Maternal según modalidad.',
'Inicial medio horario, 5 horas: cuota educativa mensual UYU 19.500; alimentación mensual UYU 4.800; anualidad educativa UYU 234.000; alimentación anual UYU 48.000; materiales UYU 4.050.
Inicial completo: cuota educativa mensual UYU 27.700; alimentación mensual UYU 4.800; anualidad educativa UYU 332.400; alimentación anual UYU 48.000; materiales UYU 5.100.
Maternal medio horario, 3 a 4 horas: UYU 16.800 mensuales; materiales UYU 3.000; alimentación no aplica.
Maternal intermedio, 5 a 6 horas: UYU 21.700 mensuales; materiales UYU 3.000; alimentación no aplica.
Maternal completo, 7 a 9 horas: UYU 27.200 mensuales; materiales UYU 3.000; alimentación no aplica.
Los valores son orientativos y deben confirmarse con Admisiones.',
ARRAY['inicial','maternal','costos','cuota','2026'],
90
FROM knowledge_categories c WHERE c.name='Costos 2026'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Costos estimativos Inicial 2026');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Proceso de admisión',
'Consulta, visita, presentación de propuesta, confirmación de vacante y pasos administrativos.',
'Proceso:
1. Primera consulta.
2. Coordinación de entrevista y recorrida.
3. Presentación de la propuesta educativa e instalaciones.
4. Orientación sobre vacante, documentación y pasos administrativos.
5. Confirmación de inscripción.
Las vacantes deben confirmarse con el equipo de Admisiones.',
ARRAY['inscripción','admisión','vacantes','visita','entrevista'],
100
FROM knowledge_categories c WHERE c.name='Admisiones'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Proceso de admisión');

INSERT INTO knowledge_items(category_id,title,summary,content,tags,priority)
SELECT c.id,
'Instalaciones y equipo interdisciplinario',
'Infraestructura educativa y acompañamiento profesional.',
'Las instalaciones incluyen salones amplios e iluminados, espacios artísticos y expresivos, sala de tecnologías, laboratorio, áreas al aire libre, comedor, cocina y complejo deportivo integrado al predio.
El colegio cuenta con un equipo interdisciplinario integrado por psicóloga, psicomotricista y psicopedagoga, que trabaja junto a docentes, Dirección y familias.
Las necesidades particulares se conversan individualmente en una entrevista.',
ARRAY['instalaciones','psicóloga','psicomotricista','psicopedagoga','apoyos'],
90
FROM knowledge_categories c WHERE c.name='Instalaciones y apoyos'
AND NOT EXISTS (SELECT 1 FROM knowledge_items WHERE title='Instalaciones y equipo interdisciplinario');
