/*
  # Wiki — Phase 2A seed (6 categories + 5 placeholder articles)

  Phase 2A scaffolding. Real content will be loaded from MANUAL PARTE 1.pdf
  ("Técnicas y Buenas Prácticas de Armado 2025") in a future migration or
  via the proposal workflow once 2B ships. Stubs below demonstrate the
  expected article structure; each should be replaced by the real content.
*/

INSERT INTO wiki_categories (slug, name, description, icon, sort_order) VALUES
  ('welcome',    'Bienvenida',       'Introducción al manual de armado Evita 2025.',     'BookOpenCheck', 10),
  ('assembly',   'Armado',           'Técnicas de armado de gabinetes.',                 'Hammer',        20),
  ('safety',     'Seguridad',        'Protocolos y EPP en planta.',                      'Shield',        30),
  ('quality',    'Control de Calidad','Inspecciones, tolerancias, retrabajos.',          'CheckSquare',   40),
  ('training',   'Capacitación',     'Materiales de onboarding y entrenamiento.',        'GraduationCap', 50),
  ('workflow',   'Flujo de Taller',  'Jidoka, 5S, layout de estaciones y kanban.',       'Workflow',      60)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO wiki_articles (slug, title, summary, category_id, body_md, tags, reading_time_min) VALUES
  ('welcome-introduccion',
   'Introducción al Manual de Armado Evita 2025',
   'Punto de partida del manual: cómo leerlo, a quién va dirigido y qué esperar.',
   (SELECT id FROM wiki_categories WHERE slug = 'welcome'),
   $md$### Introducción

Este manual consolida las **técnicas y buenas prácticas** de armado de Evita Cabinets, organizadas por área funcional: armado, seguridad, control de calidad, capacitación y flujo de taller.

**Audiencia:** operarios de planta, supervisores, personal de nuevo ingreso.

**Cómo leerlo:**

1. Cada sección se puede consultar de forma independiente.
2. Los enlaces `[[kb:slug|Nombre]]` apuntan a entradas de la Knowledge Base (precios, constantes, reglas operativas) que complementan el contenido de fabricación.
3. Los términos técnicos están definidos en el glosario del KB (por ejemplo, [[kb:glossary-cds|CDS]], [[kb:glossary-rta|RTA]], [[kb:glossary-cutlist|Cut List]]).

> **Este es un artículo stub.** Reemplázalo con la introducción real del manual cuando el PDF esté disponible.
$md$,
   ARRAY['intro','welcome','manual'],
   3),

  ('assembly-correderas-ocultas',
   'Instalación de correderas ocultas (undermount)',
   'Pasos estándar para instalar correderas ocultas en cajones premium con soft-close.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$### Instalación de correderas ocultas

**Referencia de costo:** ver [[kb:hardware-slides|Correderas (Slides)]] en el KB.

**Pasos:**

1. Verificar escuadra del cabinet antes de montar la corredera.
2. Marcar línea de referencia a la altura indicada por el fabricante.
3. Fijar los cuerpos laterales con los tornillos especificados.
4. Instalar los clips bajo el drawer box.
5. Deslizar el drawer box sobre los cuerpos hasta que enganche.
6. Probar apertura/cierre y ajustar con los tornillos de regulación.

**Checklist de calidad:**

- [ ] Apertura total uniforme.
- [ ] Soft-close funcionando en ambos lados.
- [ ] Drawer face centrado en la abertura.
- [ ] Sin juego lateral.

> **Este es un artículo stub.** Reemplázalo con el contenido real del manual de armado.
$md$,
   ARRAY['assembly','slides','undermount','soft-close'],
   5),

  ('safety-epp-diario',
   'EPP diario en planta',
   'Equipo de protección personal requerido para cada estación de trabajo.',
   (SELECT id FROM wiki_categories WHERE slug = 'safety'),
   $md$### Equipo de Protección Personal (EPP)

**Mínimo obligatorio para todas las estaciones:**

- Lentes de seguridad.
- Protección auditiva (tapones u orejeras) en zonas de corte y ensamble.
- Calzado antiderrapante con punta de seguridad.

**Por estación:**

| Estación | EPP adicional |
|----------|---------------|
| Panelado / seccionadora | Guantes resistentes al corte, mangas largas |
| Chapeadora | Guantes térmicos |
| Ensamble | Rodilleras en operaciones al piso |
| Empaque | Guantes de nitrilo para manejo de esquineros |
| Acabados | Respirador con filtro según ficha MSDS |

> **Este es un artículo stub.** Valida contra la política real de EPP de Evita antes de publicar.
$md$,
   ARRAY['safety','epp','ppe','shopfloor'],
   4),

  ('quality-alineacion-puertas',
   'Alineación de puertas con bisagras Blum',
   'Protocolo de regulación de puertas después del ensamble: profundidad, altura, lateral.',
   (SELECT id FROM wiki_categories WHERE slug = 'quality'),
   $md$### Alineación de puertas con bisagras Blum

**Aplica a:** gabinetes con bisagras [[supplier:blum|Blum]] estándar de 35mm 110°.

**Tres ejes de regulación:**

1. **Profundidad** (tornillo frontal): mueve la puerta hacia/desde el frente del cabinet.
2. **Altura** (tornillo de cazoleta): sube o baja la puerta.
3. **Lateral** (tornillo posterior): corre la puerta izquierda/derecha.

**Tolerancia objetivo:** gap uniforme entre puertas adyacentes — cita [[kb:rules-cutlist-doors-drawers|Cut List EB — Puertas y Drawer Faces]] para tolerancias de corte.

**Secuencia recomendada:**

1. Regular profundidad de ambas bisagras de la puerta.
2. Regular altura en pares (ambas bisagras al mismo paso).
3. Ajuste final lateral en la bisagra superior.
4. Repetir en pares de puertas adyacentes hasta lograr el gap uniforme.

> **Este es un artículo stub.** Completar con fotos y medidas de tolerancia reales.
$md$,
   ARRAY['quality','doors','blum','hinges','alignment'],
   6),

  ('workflow-empaque-rta',
   'Protocolo de empaque RTA',
   'Procedimiento estándar de empaque Ready-to-Assemble: 16 boxes por pallet.',
   (SELECT id FROM wiki_categories WHERE slug = 'workflow'),
   $md$### Protocolo de empaque RTA

**Regla:** `16 boxes por pallet` — ver [[kb:production-rta|Sistema RTA]] en el KB.

**Pasos:**

1. Verificar que cada caja lleva SKU y número de proyecto marcados.
2. Colocar esquineros de cartón en las cuatro esquinas visibles.
3. Estibar en el pallet en patrón 4×4.
4. Flejar en cruz (mínimo dos vueltas por eje).
5. Etiquetar pallet con destino + conteo total.

**Conectores incluidos en cada box** — ver [[kb:production-connectors|Conectores Estándar]]:

- Minifix: $27 por conexión.
- Rafix: $40 por conexión (premium, desmontable).

**Checklist de entrega:**

- [ ] 16 boxes contados.
- [ ] Esquineros en todas las cajas exteriores.
- [ ] Etiqueta de pallet legible.
- [ ] SKUs visibles sin retirar flejes.

> **Este es un artículo stub.** Reemplazar con el procedimiento completo del manual.
$md$,
   ARRAY['workflow','rta','packaging','pallet'],
   4)
ON CONFLICT (slug) DO NOTHING;

-- Snapshot v1 of every seeded article
INSERT INTO wiki_article_versions (
  article_id, version_num, title, slug, summary, category_id, body_md, tags, edit_summary
)
SELECT
  a.id, 1, a.title, a.slug, a.summary, a.category_id, a.body_md, a.tags,
  'Phase 2A seed — placeholder article, to be replaced with MANUAL PARTE 1.pdf content'
FROM wiki_articles a
WHERE NOT EXISTS (
  SELECT 1 FROM wiki_article_versions v WHERE v.article_id = a.id AND v.version_num = 1
);
