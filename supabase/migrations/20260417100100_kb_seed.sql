/*
  # Knowledge Base — Seed v1 (70 entries, 12 suppliers, 12 categories)

  Source: Evita_Knowledge_Base_Seed_v1.md (reviewed 2026-04-17)

  Conventions:
    - Section numbering preserved in kb_categories.section_num and entry bodies.
    - Business-critical constants (FX, waste, labor, material UUIDs) quoted
      verbatim inside fenced code blocks so Markdown doesn't reflow them.
    - Entries referencing products_catalog material UUIDs populate
      product_refs arrays AND mention them inline in body_md.
    - Every entry gets a version 1 snapshot in kb_entry_versions.

  Idempotency: INSERT ... ON CONFLICT (slug) DO NOTHING so the migration can be
  re-applied safely after initial seed.
*/

-- ============================================================================
-- Categories (12)
-- ============================================================================

INSERT INTO kb_categories (slug, name, section_num, description, sort_order) VALUES
  ('finishes',       'Finishes',              '§1',     'Acabados: Plus, Premium, Elite, Laminate, Stain',     10),
  ('edge-bands',     'Edge Bands',            '§2',     'Cubrecantos: Type A, Type B, Chapacinta, Special',    20),
  ('toe-kicks',      'Toe Kicks',             '§3',     'Zoclos: rendimiento por hoja y reglas',               30),
  ('hardware',       'Hardware',              '§4',     'Herrajes: slides, hinges, LED, accessories',          40),
  ('panels-shelves', 'Panels & Shelves',      '§5',     'Paneles, entrepaños, fillers',                        50),
  ('glass-aluminum', 'Glass & Aluminum',      '§6',     'Vidrios y perfilería de aluminio',                    60),
  ('countertops',    'Countertops',           '§7',     'Cubiertas: solid surface, cuarzo',                    70),
  ('blinds',         'Blinds & Textiles',     '§8',     'Persianas, telas, motor y fórmulas',                  80),
  ('production',     'Production & Packaging','§9',     'RTA, conectores, empaque',                            90),
  ('costs',          'Production Costs',      '§10',    'Costos diarios, labor, waste',                       100),
  ('rules',          'Rules & Constants',     '§11/§13','Reglas generales, constantes, cut list EB',          110),
  ('glossary',       'Glossary',              '§14',    'Definiciones de términos técnicos',                  120)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Suppliers (12) — §12
-- ============================================================================

INSERT INTO kb_suppliers (slug, name, categories, notes_md) VALUES
  ('barcocinas',   'Barcocinas',
   ARRAY['finishes','panels'],
   'Proveedor principal de la línea **Evita Plus** (tableros 15mm, formato 4×8 ft, 32 SF).'),

  ('polanco',      'Polanco',
   ARRAY['finishes'],
   'Proveedor complementario de tableros para la línea **Evita Plus**.'),

  ('arauco',       'Arauco',
   ARRAY['finishes','panels'],
   'Proveedor de la línea **Evita Premium**. Grosores disponibles: 15mm, 18mm, 28mm. Formato 4×8 ft.'),

  ('alvic',        'Alvic',
   ARRAY['finishes'],
   'Proveedor de la línea **Evita Elite** (18mm, formato 48×108 in = 36 SF) — acabados brillantes y matte premium.'),

  ('greenlam',     'Greenlam',
   ARRAY['laminates'],
   'Laminados HPL para la línea **Laminate** (proyectos de alta resistencia a impacto/abrasión).'),

  ('wilsonart',    'Wilsonart',
   ARRAY['laminates','countertops'],
   'Laminados HPL y solid surfaces. Usado tanto en línea Laminate como en countertops.'),

  ('blum',         'Blum',
   ARRAY['hardware'],
   'Herrajes: bisagras y correderas. Material ID en products_catalog: `bfeb4500` — $130 MXN por unidad.'),

  ('stetik',       'Stetik',
   ARRAY['hardware'],
   'Correderas estándar. Material ID en products_catalog: `79dfa4d0` — $626.63 MXN por juego.'),

  ('titus',        'TITUS',
   ARRAY['hardware'],
   'Herrajes especiales: sistemas **Tip-On** (push-to-open) y bisagras especiales para puertas sin jaladera.'),

  ('hailo',        'Hailo',
   ARRAY['hardware','accessories'],
   'Accesorios interiores. Producto estrella: **Eurocargo 450** (bote de basura extraíble).'),

  ('distribuidora-orli', 'Distribuidora Orli',
   ARRAY['textiles','blinds'],
   'Telas para persianas (blinds). Evita compra vía TADSI Comercial con código cliente **T-0593**.'),

  ('tadsi-comercial', 'TADSI Comercial',
   ARRAY['distribution'],
   'Distribuidor intermediario para compra de telas de Distribuidora Orli. Código cliente Evita: **T-0593**.')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §1 Finishes (5)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, supplier_ids, tags) VALUES
  ('finishes-plus',
   'Evita Plus',
   (SELECT id FROM kb_categories WHERE slug = 'finishes'),
   'finish',
   $md$### §1.1 Evita Plus

- **Proveedor:** Barcocinas, Polanco.
- **Grosor estándar:** 15mm.
- **Aplicación:** Proyectos de entrada de gama — volumen, renta, specs.
- **Formato típico de hoja:** 4×8 ft (32 SF).
$md$,
   '{"line":"plus","thickness_mm":[15],"sheet_size":"4x8","sheet_area_sf":32,"supplier":"Barcocinas"}'::jsonb,
   ARRAY(SELECT id FROM kb_suppliers WHERE slug IN ('barcocinas','polanco')),
   ARRAY['finish','plus','15mm','barcocinas','polanco']
  ),

  ('finishes-premium',
   'Evita Premium',
   (SELECT id FROM kb_categories WHERE slug = 'finishes'),
   'finish',
   $md$### §1.2 Evita Premium

- **Proveedor:** Arauco.
- **Grosores disponibles:** 15mm, 18mm, 28mm.
- **Aplicación:** Proyectos estándar residenciales y comerciales ligeros.
- **Formato típico de hoja:** 4×8 ft (32 SF).
$md$,
   '{"line":"premium","thickness_mm":[15,18,28],"sheet_size":"4x8","sheet_area_sf":32,"supplier":"Arauco"}'::jsonb,
   ARRAY(SELECT id FROM kb_suppliers WHERE slug = 'arauco'),
   ARRAY['finish','premium','arauco']
  ),

  ('finishes-elite',
   'Evita Elite',
   (SELECT id FROM kb_categories WHERE slug = 'finishes'),
   'finish',
   $md$### §1.3 Evita Elite

- **Proveedor:** Alvic.
- **Grosor estándar:** 18mm.
- **Formato de hoja:** 48"×108" (36 SF) — **formato distinto a Plus/Premium**.
- **Aplicación:** Proyectos de alta gama, acabados brillantes/matte premium.
$md$,
   '{"line":"elite","thickness_mm":[18],"sheet_size":"48x108","sheet_area_sf":36,"supplier":"Alvic"}'::jsonb,
   ARRAY(SELECT id FROM kb_suppliers WHERE slug = 'alvic'),
   ARRAY['finish','elite','alvic','18mm']
  ),

  ('finishes-laminate',
   'Laminate',
   (SELECT id FROM kb_categories WHERE slug = 'finishes'),
   'finish',
   $md$### §1.4 Laminate

- **Descripción:** Línea con laminados HPL (Greenlam, Wilsonart).
- **Aplicación:** Cuando se requiere resistencia alta a impacto/abrasión o coordinación con countertops laminados.
$md$,
   '{"line":"laminate","substrate":"HPL","suppliers":["Greenlam","Wilsonart"]}'::jsonb,
   ARRAY(SELECT id FROM kb_suppliers WHERE slug IN ('greenlam','wilsonart')),
   ARRAY['finish','laminate','hpl']
  ),

  ('finishes-stain',
   'Stain (Chapa / Madera Teñida)',
   (SELECT id FROM kb_categories WHERE slug = 'finishes'),
   'finish',
   $md$### §1.5 Stain (Chapa / Madera Teñida)

- **Descripción:** Chapa natural con acabado teñido.
- **Aplicación:** Proyectos donde se requiere veta real de madera.
$md$,
   '{"line":"stain","substrate":"veneer"}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['finish','stain','veneer','wood']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §2 Edge Bands (5)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, product_refs, tags, needs_enrichment, enrichment_notes) VALUES
  ('edge-bands-chapacinta',
   'Chapacinta (melamínico económico)',
   (SELECT id FROM kb_categories WHERE slug = 'edge-bands'),
   'edge_band',
   $md$### §2.1 Chapacinta

- **Aplicación:** cantos ocultos o proyectos de bajo costo.
- **Material:** papel melamínico.
- **Durabilidad:** baja.
$md$,
   '{"type":"chapacinta","substrate":"melamine_paper","durability":"low"}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['edgeband','chapacinta','melamine'],
   false, NULL
  ),

  ('edge-bands-type-a-pvc',
   'PVC Type A — Box EB',
   (SELECT id FROM kb_categories WHERE slug = 'edge-bands'),
   'edge_band',
   $md$### §2.2 PVC Estándar — Type A (Box EB)

- **Material ID en Supabase:** `6d877ed9`
- **Precio:** `$8.30 MXN / metro lineal`
- **Aplicación:** box interior, áreas no visibles o semi-visibles.
- **Color:** coordinado con material de caja (box material).
- **Cut-list mapping:** `1` = Type A.
$md$,
   '{"type":"pvc_standard","role":"box","price_mxn_per_m":8.30,"material_id":"6d877ed9","cutlist_code":1}'::jsonb,
   ARRAY[]::uuid[], -- see note below — 6d877ed9 is a short prefix; full UUIDs populated at runtime via app
   ARRAY['edgeband','pvc','type-a','box'],
   false, NULL
  ),

  ('edge-bands-type-b-pvc',
   'PVC Type B — Doors EB',
   (SELECT id FROM kb_categories WHERE slug = 'edge-bands'),
   'edge_band',
   $md$### §2.3 PVC Premium — Type B (Doors EB)

- **Material ID en Supabase:** `e3e9c098`
- **Precio:** `$11.30 MXN / metro lineal`
- **Aplicación:** puertas, cajones, panel lateral expuesto.
- **Color:** coordinado con material de puerta (door material).
- **Cut-list mapping:** `2` = Type B.
$md$,
   '{"type":"pvc_premium","role":"doors","price_mxn_per_m":11.30,"material_id":"e3e9c098","cutlist_code":2}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['edgeband','pvc','type-b','doors','premium'],
   false, NULL
  ),

  ('edge-bands-special-pvc',
   'PVC Especial',
   (SELECT id FROM kb_categories WHERE slug = 'edge-bands'),
   'edge_band',
   $md$### §2.4 PVC Especial

- Cubrecantos con textura, color metálico, o con efecto de profundidad.
- **Precio:** variable, requiere cotización específica.
$md$,
   '{"type":"pvc_special","price":"variable"}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['edgeband','pvc','special'],
   true,
   'Seed §2.4: variantes especiales sin SKU específico — completar con catálogo del proveedor.'
  ),

  ('edge-bands-not-apply',
   'NOT APPLY (placeholder)',
   (SELECT id FROM kb_categories WHERE slug = 'edge-bands'),
   'edge_band',
   $md$### §2.5 NOT APPLY (placeholder edgeband)

- **Material ID:** `2ddf271c`
- **Uso:** áreas sin cubrecanto (closets sin puerta, series 460 sin box, etc.).
- **Cut-list mapping:** `0` = sin cubrecanto.
$md$,
   '{"type":"not_apply","material_id":"2ddf271c","cutlist_code":0}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['edgeband','not-apply','placeholder'],
   false, NULL
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §3 Toe Kicks (1)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, tags) VALUES
  ('toe-kicks-overview',
   'Zoclos (Toe Kicks) — rendimiento y reglas',
   (SELECT id FROM kb_categories WHERE slug = 'toe-kicks'),
   'toe_kick',
   $md$### §3 Zoclos (Toe Kicks)

**Rendimiento por hoja:** `18 zoclos por hoja estándar 4×8 ft`. Usar este rendimiento para calcular material total por proyecto.

**Consideraciones:**

- Zoclo estándar: 4" de altura × profundidad del cabinet.
- Cuando el zoclo va forrado con door material, considerar cubrecanto **Type B** en canto frontal visible.
- En proyectos con piso preinstalado, verificar altura libre antes de fabricar.
$md$,
   '{"yield_per_4x8_sheet":18,"standard_height_in":4,"front_edge_band":"type_b_when_door_material"}'::jsonb,
   ARRAY['toe-kick','zoclo','yield']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §4 Hardware (6)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, supplier_ids, tags, needs_enrichment, enrichment_notes) VALUES
  ('hardware-slides',
   'Correderas (Slides)',
   (SELECT id FROM kb_categories WHERE slug = 'hardware'),
   'hardware',
   $md$### §4.1 Correderas (Slides)

| Tipo | Descripción | Longitudes | Aplicación típica |
|------|-------------|------------|-------------------|
| Ocultas (undermount) | Bajo cajón, no visibles | 350–500 mm | Cajones premium, soft-close |
| Extensión completa | Laterales, extensión total | 250–550 mm | Cajones estándar |
| Optimo | Corredera Optimo | 550 mm | Cajones grandes |

**Referencias de costo (en products_catalog):**

- **Stetik (corredera estándar):** Material ID `79dfa4d0` — `$626.63 MXN` por juego.
- **Blum (herrajes):** Material ID `bfeb4500` — `$130 MXN` por unidad.
$md$,
   '{"category":"slides","variants":["undermount","full_extension","optimo"],"references":{"stetik":{"id":"79dfa4d0","price_mxn":626.63},"blum":{"id":"bfeb4500","price_mxn":130}}}'::jsonb,
   ARRAY(SELECT id FROM kb_suppliers WHERE slug IN ('stetik','blum')),
   ARRAY['hardware','slides','stetik','blum'],
   true,
   'Seed §4.1: detalle de SKU/código de fabricante por variante pendiente.'
  ),

  ('hardware-hinges',
   'Bisagras (Hinges)',
   (SELECT id FROM kb_categories WHERE slug = 'hardware'),
   'hardware',
   $md$### §4.2 Bisagras (Hinges)

| Tipo | Descripción | Aplicación |
|------|-------------|------------|
| 35mm recta 110° sin cierre suave | Bisagra básica de cazoleta | Puertas estándar |
| 35mm recta 110° con cierre suave | Bisagra con soft-close integrado | Puertas premium |
| 3×3 acero inoxidable | Bisagra de pivote | Puertas tipo inset o acceso especial |
| Tip-On TITUS | Sistema push-to-open | Puertas sin jaladera |
$md$,
   '{"category":"hinges","variants":["35mm_110_standard","35mm_110_softclose","3x3_ss_pivot","tip_on_titus"]}'::jsonb,
   ARRAY(SELECT id FROM kb_suppliers WHERE slug IN ('blum','titus')),
   ARRAY['hardware','hinges','soft-close','tip-on'],
   true,
   'Seed §4.2: SKU de cada variante + precios unitarios pendientes.'
  ),

  ('hardware-led',
   'LED (iluminación)',
   (SELECT id FROM kb_categories WHERE slug = 'hardware'),
   'hardware',
   $md$### §4.3 LED

- Tiras LED para iluminación bajo gabinete / interior.
- Drivers, sensores de movimiento, perfiles de aluminio.
- **Capturar por SKU en KB:** potencia (W/m), color (Kelvin), índice IP, perfil compatible.
$md$,
   '{"category":"led","attributes":["power_w_per_m","color_kelvin","ip_rating","profile_compatibility"]}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['hardware','led','lighting'],
   true,
   'Seed §4.3: catálogo de SKUs de LED pendiente de cargar.'
  ),

  ('hardware-interior-accessories',
   'Accesorios Interiores',
   (SELECT id FROM kb_categories WHERE slug = 'hardware'),
   'hardware',
   $md$### §4.4 Accesorios Interiores

- Organizadores de cubiertos.
- Separadores de cajón.
- Bandejas extraíbles.
- Cestos metálicos.

**Capturar:** medidas (ancho × profundidad × alto), compatibilidad con ancho de cabinet interior.
$md$,
   '{"category":"interior_accessory","items":["cutlery_organizer","drawer_divider","pull_out_tray","metal_basket"]}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['hardware','interior','accessories'],
   true,
   'Seed §4.4: SKUs específicos pendientes.'
  ),

  ('hardware-locks',
   'Cerraduras',
   (SELECT id FROM kb_categories WHERE slug = 'hardware'),
   'hardware',
   $md$### §4.5 Cerraduras

- Cerraduras de gabinete (mecánicas y digitales).
- **Aplicación:** archivos, cajones de documentos, gabinetes de farmacia.
$md$,
   '{"category":"lock","variants":["mechanical","digital"],"applications":["file_cabinet","pharmacy_cabinet"]}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['hardware','lock','cerradura'],
   true,
   'Seed §4.5: SKUs específicos pendientes.'
  ),

  ('hardware-special-accessories',
   'Accesorios Especiales',
   (SELECT id FROM kb_categories WHERE slug = 'hardware'),
   'hardware',
   $md$### §4.6 Accesorios Especiales

| Accesorio | Aplicación |
|-----------|------------|
| Hailo Eurocargo 450 | Bote de basura extraíble |
| Especiero extraíble | Organizador vertical de especias |
| Barra abatible | Barra de colgado para closets bajos |
| Pantalonero / Colgador extraíble | Closets de vestidor |
| Joyero | Cajón interior con divisiones para joyería |
$md$,
   '{"category":"special_accessory","featured_items":["hailo_eurocargo_450","spice_rack","folding_rod","pants_rack","jewelry_drawer"]}'::jsonb,
   ARRAY(SELECT id FROM kb_suppliers WHERE slug = 'hailo'),
   ARRAY['hardware','special','hailo'],
   true,
   'Seed §4.6: SKUs específicos de cada accesorio pendientes.'
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §5 Panels & Shelves (5)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, tags) VALUES
  ('panels-side',
   'Paneles Laterales',
   (SELECT id FROM kb_categories WHERE slug = 'panels-shelves'),
   'panel',
   $md$### §5.1 Paneles Laterales

Panel lateral **debe cortarse +1"** respecto al ancho nominal del cabinet (para ajuste y canto).
$md$,
   '{"cut_rule":"nominal_width_plus_1_inch","reason":"allow_for_adjustment_and_edge"}'::jsonb,
   ARRAY['panel','side-panel','cut-rule']
  ),

  ('panels-refrigerator',
   'Paneles de Refrigerador',
   (SELECT id FROM kb_categories WHERE slug = 'panels-shelves'),
   'panel',
   $md$### §5.2 Paneles de Refrigerador

> **Regla crítica:** el panel de refrigerador se calcula **doble** en material (dos caras vistas o profundidad mayor al estándar).
$md$,
   '{"material_multiplier":2,"reason":"dual_visible_face_or_extra_depth"}'::jsonb,
   ARRAY['panel','refrigerator','double-material']
  ),

  ('panels-fillers',
   'Fillers',
   (SELECT id FROM kb_categories WHERE slug = 'panels-shelves'),
   'panel',
   $md$### §5.3 Fillers

**Los fillers se calculan doble** en material, dado que casi siempre se trabajan en pares o llevan cubrecanto en dos cantos.
$md$,
   '{"material_multiplier":2,"reason":"paired_install_or_two_visible_edges"}'::jsonb,
   ARRAY['panel','filler','double-material']
  ),

  ('shelves-overview',
   'Entrepaños (Shelves)',
   (SELECT id FROM kb_categories WHERE slug = 'panels-shelves'),
   'shelf',
   $md$### §5.4 Entrepaños (Shelves)

**Regla de profundidad:** entrepaños se cortan **−2"** respecto a la profundidad nominal del cabinet.

*Razón: permitir ventilación y evitar tope con trasero/espalda.*

**Tipos:**

- **Ajustables:** cubrecanto en 4 lados (sup, inf, izq, der).
- **Fijos:** cubrecanto solo en canto frontal (sup).
$md$,
   '{"depth_rule":"nominal_depth_minus_2_inches","types":{"adjustable":{"edgeband":"all_four_sides"},"fixed":{"edgeband":"front_only"}}}'::jsonb,
   ARRAY['shelf','entrepaño','cut-rule','edgeband']
  ),

  ('panels-depth-optimization',
   'Optimización de Profundidad (corte de hoja)',
   (SELECT id FROM kb_categories WHERE slug = 'panels-shelves'),
   'rule',
   $md$### §5.5 Optimización de Profundidad

| Profundidad nominal | Corte optimizado | Rendimiento |
|---------------------|------------------|-------------|
| 12" | 300 mm | 1/4 de hoja |
| 16" | 400 mm | 1/3 de hoja |
| 24" | 600 mm | 1/2 de hoja |
$md$,
   '{"depth_map":[{"nominal_in":12,"cut_mm":300,"yield":"1/4"},{"nominal_in":16,"cut_mm":400,"yield":"1/3"},{"nominal_in":24,"cut_mm":600,"yield":"1/2"}]}'::jsonb,
   ARRAY['depth','optimization','sheet-yield']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §6 Glass & Aluminum (2)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, tags) VALUES
  ('glass-overview',
   'Vidrios',
   (SELECT id FROM kb_categories WHERE slug = 'glass-aluminum'),
   'general',
   $md$### §6.1 Vidrios

- **Tipos:** claro, esmerilado, reeded, templado.
- **Espesores:** 4, 5, 6 mm (templado mínimo 6 mm).
- Se cotiza por **SF instalado** con marco de aluminio.
$md$,
   '{"types":["clear","frosted","reeded","tempered"],"thickness_mm":[4,5,6],"tempered_min_mm":6,"pricing_unit":"sf_installed"}'::jsonb,
   ARRAY['glass','vidrio','tempered']
  ),

  ('aluminum-profiles',
   'Perfilería de Aluminio',
   (SELECT id FROM kb_categories WHERE slug = 'glass-aluminum'),
   'general',
   $md$### §6.2 Perfilería de aluminio

- Marcos de puerta de aluminio.
- Jaladeras integradas tipo **gola**.
- **Acabados:** anodizado natural, negro mate, oro mate.
$md$,
   '{"items":["door_frames","gola_pulls"],"finishes":["natural_anodized","matte_black","matte_gold"]}'::jsonb,
   ARRAY['aluminum','gola','profile','finish']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §7 Countertops (2)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, supplier_ids, tags) VALUES
  ('countertops-solid-surface',
   'Solid Surface',
   (SELECT id FROM kb_categories WHERE slug = 'countertops'),
   'countertop',
   $md$### §7.1 Solid Surface

- **Materiales:** Corian, Staron, Hi-Macs.
- **Aplicación:** baños, comercios, áreas con curvas o juntas invisibles.
- **Costo:** por SF instalado, rango medio–alto.
$md$,
   '{"material_type":"solid_surface","brands":["Corian","Staron","Hi-Macs"],"pricing_unit":"sf_installed","cost_tier":"mid_to_high"}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['countertop','solid-surface','corian']
  ),

  ('countertops-quartz',
   'Cuarzo (Quartz)',
   (SELECT id FROM kb_categories WHERE slug = 'countertops'),
   'countertop',
   $md$### §7.2 Cuarzo (Quartz)

- **Marcas:** Silestone, Caesarstone, Cambria, MSI.
- **Aplicación:** cocinas, baños premium.
- **Costo:** por SF instalado, varía por grado/tier.
$md$,
   '{"material_type":"quartz","brands":["Silestone","Caesarstone","Cambria","MSI"],"pricing_unit":"sf_installed","cost_tier":"varies_by_grade"}'::jsonb,
   ARRAY[]::uuid[],
   ARRAY['countertop','quartz','silestone','caesarstone']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §8 Blinds (1 consolidated)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, supplier_ids, tags) VALUES
  ('blinds-overview',
   'Persianas y Textiles — tiers, motor, fórmula',
   (SELECT id FROM kb_categories WHERE slug = 'blinds'),
   'blind',
   $md$### §8 Persianas y Textiles (Blinds)

#### §8.1 Tiers de tela (factores)

| Tier | Fabric Factor |
|------|---------------|
| Plus | 0.245683 |
| Premium | 0.367393 |
| Elite | 0.536595 |
| Elite Pro | 0.85218 |

#### §8.2 Motor

- **Costo:** `$4,664.36 MXN` (verificar FX al momento de cotizar).

#### §8.3 Instalación y Entrega

- **`$65.00 USD`** por cantidad (unit).

#### §8.4 Fórmula del Shades Estimator

```
Subtotal = ((Width × Height × FabricFactor) + MotorCost) ÷ Profit × (1 + CostTax%)
```

**Defaults:**

- `Profit` = 0.5
- `CostTax` = 8.25%

#### §8.5 Reglas de fabricación

- Agregar **10"** de exceso a **W** y a **H**.
- Ancho máximo de tela: **94.49"** (2.4 m).
- Si excede: dividir en paneles iguales.

#### §8.6 Proveedor principal

Distribuidora Orli — telas para blinds. Evita compra vía **TADSI Comercial**, código cliente **T-0593**.
$md$,
   '{"fabric_factors":{"plus":0.245683,"premium":0.367393,"elite":0.536595,"elite_pro":0.85218},"motor_cost_mxn":4664.36,"install_usd_per_unit":65.00,"formula":"((W × H × FabricFactor) + MotorCost) / Profit × (1 + CostTax%)","defaults":{"profit":0.5,"cost_tax":0.0825},"fab_rules":{"excess_w_h_in":10,"max_fabric_width_in":94.49},"supplier":"Distribuidora Orli via TADSI","client_code":"T-0593"}'::jsonb,
   ARRAY(SELECT id FROM kb_suppliers WHERE slug IN ('distribuidora-orli','tadsi-comercial')),
   ARRAY['blind','shade','fabric','formula','orli','tadsi']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §9 Production & Packaging (3)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, tags) VALUES
  ('production-rta',
   'Sistema RTA (Ready To Assemble)',
   (SELECT id FROM kb_categories WHERE slug = 'production'),
   'rule',
   $md$### §9.1 Sistema RTA

**`16 boxes por pallet`** (estándar de empaque Evita).
$md$,
   '{"boxes_per_pallet":16}'::jsonb,
   ARRAY['rta','packaging','pallet']
  ),

  ('production-connectors',
   'Conectores Estándar',
   (SELECT id FROM kb_categories WHERE slug = 'production'),
   'cost_constant',
   $md$### §9.2 Conectores estándar

| Conector | Costo | Aplicación |
|----------|-------|------------|
| Minifix | `$27` | Conexión estándar de melamina |
| Rafix | `$40` | Conexión premium (desmontable, invisible) |
$md$,
   '{"minifix":{"cost":27,"application":"standard_melamine"},"rafix":{"cost":40,"application":"premium_invisible_demountable"}}'::jsonb,
   ARRAY['connector','minifix','rafix']
  ),

  ('production-packaging',
   'Empaque',
   (SELECT id FROM kb_categories WHERE slug = 'production'),
   'general',
   $md$### §9.3 Empaque

- Cajas de cartón corrugado con esquineros.
- Marcado con SKU y número de proyecto.
- Etiqueta QR/código de barras para trazabilidad *(roadmap)*.
$md$,
   '{"corner_protectors":true,"marked_with":["sku","project_number"],"qr_label":"roadmap"}'::jsonb,
   ARRAY['packaging','corrugated','qr']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §10 Production Costs (3)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, tags) VALUES
  ('costs-daily-operation',
   'Costos Diarios Base',
   (SELECT id FROM kb_categories WHERE slug = 'costs'),
   'cost_constant',
   $md$### §10.1 Costos diarios base (operación)

| Concepto | USD/día |
|----------|---------|
| Salarios | `$20,016` |
| Utilidad (profit) | `$2,000` |
| Tiempo extra | `$2,500` |
$md$,
   '{"daily_usd":{"salaries":20016,"profit":2000,"overtime":2500}}'::jsonb,
   ARRAY['cost','daily','salary','profit']
  ),

  ('costs-labor',
   'Labor (Box / Door)',
   (SELECT id FROM kb_categories WHERE slug = 'costs'),
   'cost_constant',
   $md$### §10.2 Labor (Evita)

- **Box labor:** `$400`
- **Door labor:** `$600`

> **Nota:** En `settings` (tabla de Supabase) y en `CLAUDE.md` estas mismas cantidades aparecen como `laborCostNoDrawers = 400` y `laborCostWithDrawers = 600`. Son la misma regla expresada en términos del motor de cotización. La unidad canónica se mantiene en la tabla `settings`.
$md$,
   '{"box_labor":400,"door_labor":600,"settings_keys":{"laborCostNoDrawers":400,"laborCostWithDrawers":600}}'::jsonb,
   ARRAY['cost','labor','box','door']
  ),

  ('costs-waste-multipliers',
   'Waste Multipliers',
   (SELECT id FROM kb_categories WHERE slug = 'costs'),
   'cost_constant',
   $md$### §10.3 Factor de desperdicio (waste)

- **Box:** `×1.10`
- **Door:** `×1.60`

Aplicar al square footage de box/door antes de cotizar material.
$md$,
   '{"box_multiplier":1.10,"door_multiplier":1.60,"applies_to":"sqft_before_material_pricing"}'::jsonb,
   ARRAY['cost','waste','multiplier']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §11 Rules & Constants (14)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, tags) VALUES
  ('rules-project-constants',
   'Constantes Financieras del Proyecto Evita',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'cost_constant',
   $md$### §11.1 Constantes Financieras (Supabase `rludrzyrpsotvzizlztg`)

| Constante | Valor |
|-----------|-------|
| FX (USD → MXN) | `17` |
| Box waste multiplier | `×1.10` |
| Door waste multiplier | `×1.60` |
| Box labor | `$400 USD` |
| Door labor | `$600 USD` |

> Estas constantes viven en la tabla `settings` y son la fuente de verdad del motor de cotización.
$md$,
   '{"supabase_project":"rludrzyrpsotvzizlztg","fx_usd_mxn":17,"box_waste":1.10,"door_waste":1.60,"box_labor_usd":400,"door_labor_usd":600}'::jsonb,
   ARRAY['constants','fx','waste','labor','supabase']
  ),

  ('rules-material-ids',
   'Material IDs Críticos',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.2 Material IDs críticos — preservar exactamente

| Rol | UUID | Precio |
|-----|------|--------|
| Box material | `f4953b9f` | `$550 / 32 SF` |
| Door material | `d0eb99a2` | `$1,250 / 32 SF` |
| Box EB (Type A) | `6d877ed9` | `$8.30 / m` |
| Door EB (Type B) | `e3e9c098` | `$11.30 / m` |
| Blum | `bfeb4500` | `$130` |
| Stetik | `79dfa4d0` | `$626.63` |
| NOT APPLY material | `b7e31784` | — |
| NOT APPLY edgeband | `2ddf271c` | — |

**Reglas de uso de NOT APPLY:**

- **Closets sin puerta:** usar NOT APPLY en `doors_material_id` + `doors_edgeband_id`.
- **Series 460 sin box:** usar NOT APPLY en campos de box (`box_material_id` + `box_edgeband_id`).
- Los closets se capturan en `products_catalog`.
$md$,
   '{"material_ids":{"box":"f4953b9f","door":"d0eb99a2","box_eb":"6d877ed9","door_eb":"e3e9c098","blum":"bfeb4500","stetik":"79dfa4d0","not_apply_material":"b7e31784","not_apply_edgeband":"2ddf271c"},"not_apply_rules":{"closets_without_doors":["doors_material_id","doors_edgeband_id"],"series_460_without_box":["box_material_id","box_edgeband_id"]}}'::jsonb,
   ARRAY['constants','material-id','not-apply','closet','460-series']
  ),

  ('rules-edgeband-waste',
   'Cubrecanto Waste',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-1 Cubrecanto Waste

**`3 cm` de desperdicio por tramo + `10 cm` por lado del cabinet.**

Aplicar al calcular metros lineales totales por proyecto.
$md$,
   '{"waste_per_run_cm":3,"waste_per_cabinet_side_cm":10}'::jsonb,
   ARRAY['edgeband','waste','rule']
  ),

  ('rules-toe-kick-yield',
   'Zoclos — 18 por Hoja',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-2 Zoclos

**`18 zoclos por hoja 4×8`** estándar.
$md$,
   '{"yield_per_sheet":18,"sheet_size":"4x8"}'::jsonb,
   ARRAY['toe-kick','yield','rule']
  ),

  ('rules-side-panel-oversize',
   'Side Panels — +1" Oversize',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-3 Panel lateral

Cortar **`+1"`** sobre medida nominal.
$md$,
   '{"oversize_in":1,"applies_to":"nominal_width"}'::jsonb,
   ARRAY['panel','side','rule']
  ),

  ('rules-shelf-undersize',
   'Shelves — −2" Undersize',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-4 Entrepaños

Cortar **`−2"`** en profundidad respecto al cabinet nominal.
$md$,
   '{"undersize_in":2,"applies_to":"nominal_depth"}'::jsonb,
   ARRAY['shelf','rule','depth']
  ),

  ('rules-filler-double',
   'Fillers — Doble Material',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-5 Fillers

Calcular **doble** en material.
$md$,
   '{"material_multiplier":2}'::jsonb,
   ARRAY['filler','rule','material']
  ),

  ('rules-refrigerator-panel-double',
   'Refrigerator Panel — Doble Material',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-6 Panel de refrigerador

Calcular **doble** en material.
$md$,
   '{"material_multiplier":2}'::jsonb,
   ARRAY['panel','refrigerator','rule']
  ),

  ('rules-bracket-customs',
   'Bracket Customs — 1 cada 40 cm',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-7 Bracket customs

**1 por cada `40 cm` de tramo.**
$md$,
   '{"brackets_per_cm":{"every":40,"qty":1}}'::jsonb,
   ARRAY['bracket','rule']
  ),

  ('rules-production-days',
   'Días de Producción = Días Reales ÷ 2',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-8 Días de producción

**Días de producción = días reales ÷ 2**.

Razón: buffer por curva de aprendizaje, retrabajos y coordinación.
$md$,
   '{"formula":"production_days = real_days / 2","rationale":"buffer_for_learning_rework_coordination"}'::jsonb,
   ARRAY['production','days','formula']
  ),

  ('rules-drawer-box-thickness',
   'Drawer Box Thickness — Siempre 15 mm',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.3-10 Drawer box thickness

Siempre **`15 mm`**, excepto drawer face (que usa material de puerta).
$md$,
   '{"thickness_mm":15,"exception":"drawer_face_uses_door_material"}'::jsonb,
   ARRAY['drawer','thickness','rule']
  ),

  ('rules-cds-series',
   'Cabinet Design Series (CDS)',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.4 Cabinet Design Series (CDS)

Sistema de numeración estándar basado en AWI/NAAWS (series **100, 200, 300, 400, 500**).

**Pre-requisito** para que la plataforma y `evita-ia` funcionen — todos los departamentos deben adoptar CDS unificado.

**Regla de sustitución:** si no existe CDS al ancho requerido, sustituir por el siguiente tier superior.

| Serie | Descripción |
|-------|-------------|
| 100 | Base cabinets without drawers |
| 200 | Base cabinets with drawers |
| 300 | Wall hung cabinets |
| 400 | Tall storage cabinets |
| 500 | Tall wardrobe cabinets |

**SKU format:** `{series}-{width}×{height}×{depth}` (p.ej. `102-36×30×18`).
**Sufijo `M`** = modified design (p.ej. `102M` = 102 con entrepaño extra).
$md$,
   '{"standard":"AWI/NAAWS","series":{"100":"base_no_drawers","200":"base_with_drawers","300":"wall_hung","400":"tall_storage","500":"tall_wardrobe"},"sku_format":"{series}-{W}x{H}x{D}","modifier_suffix_M":"modified_design","substitution_rule":"next_tier_up_if_width_unavailable"}'::jsonb,
   ARRAY['cds','awi','naaws','cabinet-series']
  ),

  ('rules-plywood-base-d24',
   'Plywood Base D24" — Cálculo',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.5 Plywood Base D24"

1. Sumar anchos (en pulgadas) de cabinets que tocan el piso.
2. Dividir entre **36** y redondear hacia arriba.
3. Resultado = piezas de plywood base requeridas.
$md$,
   '{"formula":"ceil(sum(floor_cabinet_widths_in) / 36)","unit":"pieces"}'::jsonb,
   ARRAY['plywood','base','d24','rule']
  ),

  ('rules-grain-orientation',
   'Veta (Grain) por Tipo de Pieza',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §11.6 Veta (Grain)

| Pieza | Orientación |
|-------|-------------|
| Costados (sides) | Vertical |
| Trasero (back) | Vertical |
| Puertas (doors) | Vertical |
| Piso, Techo | Horizontal |
| Entrepaños (shelves) | Horizontal |
| Rails | Horizontal |
| Internos de cajón | Sin veta (none) |
$md$,
   '{"vertical":["sides","back","doors"],"horizontal":["top","bottom","shelves","rails"],"none":["drawer_internals"]}'::jsonb,
   ARRAY['grain','veta','orientation']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §13 Cut List Edgeband Rules per Piece (9)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, structured_data, tags) VALUES
  ('rules-cutlist-sides-base-tall',
   'Cut List EB — Costados (Base / Tall)',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.1a Costados — Base / Tall cabinets

`{sup:2, inf:1, izq:1, der:1}`

Notación: `0` = sin EB, `1` = Type A (Box EB), `2` = Type B (Door EB).
$md$,
   '{"eb":{"sup":2,"inf":1,"izq":1,"der":1},"piece":"side_panel","cabinet_type":"base_or_tall"}'::jsonb,
   ARRAY['cutlist','edgeband','sides','base','tall']
  ),

  ('rules-cutlist-sides-wall',
   'Cut List EB — Costados (Wall)',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.1b Costados — Wall cabinets

`{sup:2, inf:2, izq:1, der:1}`
$md$,
   '{"eb":{"sup":2,"inf":2,"izq":1,"der":1},"piece":"side_panel","cabinet_type":"wall"}'::jsonb,
   ARRAY['cutlist','edgeband','sides','wall']
  ),

  ('rules-cutlist-top-bottom',
   'Cut List EB — Piso / Techo',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.2 Piso / Techo

`{sup:2, inf:0, izq:0, der:0}`
$md$,
   '{"eb":{"sup":2,"inf":0,"izq":0,"der":0},"piece":"top_or_bottom"}'::jsonb,
   ARRAY['cutlist','edgeband','top','bottom']
  ),

  ('rules-cutlist-back',
   'Cut List EB — Trasero',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.3 Trasero

`{sup:1, inf:1, izq:0, der:0}`
$md$,
   '{"eb":{"sup":1,"inf":1,"izq":0,"der":0},"piece":"back"}'::jsonb,
   ARRAY['cutlist','edgeband','back']
  ),

  ('rules-cutlist-shelves-fixed',
   'Cut List EB — Entrepaños Fijos',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.4 Entrepaños Fijos

`{sup:1, inf:0, izq:0, der:0}`
$md$,
   '{"eb":{"sup":1,"inf":0,"izq":0,"der":0},"piece":"fixed_shelf"}'::jsonb,
   ARRAY['cutlist','edgeband','shelf','fixed']
  ),

  ('rules-cutlist-shelves-adjustable',
   'Cut List EB — Entrepaños Ajustables',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.5 Entrepaños Ajustables

`{sup:1, inf:1, izq:1, der:1}`
$md$,
   '{"eb":{"sup":1,"inf":1,"izq":1,"der":1},"piece":"adjustable_shelf"}'::jsonb,
   ARRAY['cutlist','edgeband','shelf','adjustable']
  ),

  ('rules-cutlist-doors-drawers',
   'Cut List EB — Puertas y Drawer Faces',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.6 Puertas y Drawer Faces

`{sup:2, inf:2, izq:2, der:2}`
$md$,
   '{"eb":{"sup":2,"inf":2,"izq":2,"der":2},"piece":"door_or_drawer_face"}'::jsonb,
   ARRAY['cutlist','edgeband','doors','drawer-face']
  ),

  ('rules-cutlist-drawer-box-sides',
   'Cut List EB — Drawer Box Sides',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.7 Drawer Box Sides

`{sup:1, inf:1, izq:0, der:0}`
$md$,
   '{"eb":{"sup":1,"inf":1,"izq":0,"der":0},"piece":"drawer_box_side"}'::jsonb,
   ARRAY['cutlist','edgeband','drawer','side']
  ),

  ('rules-cutlist-drawer-ends-bottom',
   'Cut List EB — Drawer Ends / Bottom',
   (SELECT id FROM kb_categories WHERE slug = 'rules'),
   'rule',
   $md$### §13.8 Drawer Ends / Drawer Bottom

`{sup:0, inf:0, izq:0, der:0}` — **sin cubrecanto**.
$md$,
   '{"eb":{"sup":0,"inf":0,"izq":0,"der":0},"piece":"drawer_end_or_bottom"}'::jsonb,
   ARRAY['cutlist','edgeband','drawer','ends','bottom']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Entries — §14 Glossary (13)
-- ============================================================================

INSERT INTO kb_entries (slug, title, category_id, entry_type, body_md, tags) VALUES
  ('glossary-cds',
   'CDS',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$**Cabinet Design Series** — sistema de numeración estándar AWI/NAAWS de 100 a 500.$md$,
   ARRAY['glossary','cds']
  ),

  ('glossary-awi-naaws',
   'AWI / NAAWS',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$**Architectural Woodwork Institute** / **North American Architectural Woodwork Standards**.$md$,
   ARRAY['glossary','awi','naaws','standard']
  ),

  ('glossary-rta',
   'RTA',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$**Ready To Assemble** — gabinete preparado para ensamble en sitio.$md$,
   ARRAY['glossary','rta']
  ),

  ('glossary-eb',
   'EB',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$**Edge Band** — cubrecanto.$md$,
   ARRAY['glossary','eb','edgeband']
  ),

  ('glossary-type-a-eb',
   'Type A EB',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Cubrecanto **Box** (`$8.30/m`). Material ID `6d877ed9`.$md$,
   ARRAY['glossary','type-a','box-eb']
  ),

  ('glossary-type-b-eb',
   'Type B EB',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Cubrecanto **Doors** (`$11.30/m`). Material ID `e3e9c098`.$md$,
   ARRAY['glossary','type-b','door-eb']
  ),

  ('glossary-filler',
   'Filler',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Pieza de ajuste para rellenar espacios entre gabinetes o muros.$md$,
   ARRAY['glossary','filler']
  ),

  ('glossary-jidoka',
   'Jidoka',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Metodología Toyota — automatización con toque humano, calidad en origen.$md$,
   ARRAY['glossary','jidoka','toyota','lean']
  ),

  ('glossary-5s',
   '5S',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$**Seiri, Seiton, Seiso, Seiketsu, Shitsuke** — metodología de organización de planta.$md$,
   ARRAY['glossary','5s','lean','shopfloor']
  ),

  ('glossary-waste-multiplier',
   'Waste Multiplier',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Factor multiplicador de desperdicio aplicado al cálculo de material. Box = `×1.10`, Door = `×1.60`.$md$,
   ARRAY['glossary','waste','multiplier']
  ),

  ('glossary-profit-multiplier',
   'Profit Multiplier',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Factor aplicado para derivar precio de venta desde costo.$md$,
   ARRAY['glossary','profit','margin']
  ),

  ('glossary-not-apply',
   'NOT APPLY',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Material/edgeband placeholder UUID usado cuando un slot no aplica (closets sin puerta, series 460 sin box, etc.). Material `b7e31784`, Edgeband `2ddf271c`.$md$,
   ARRAY['glossary','not-apply','placeholder']
  ),

  ('glossary-takeoff',
   'Takeoff',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Proceso de identificar y contar gabinetes desde planos arquitectónicos.$md$,
   ARRAY['glossary','takeoff']
  ),

  ('glossary-cutlist',
   'Cut List / Despiece',
   (SELECT id FROM kb_categories WHERE slug = 'glossary'),
   'glossary',
   $md$Lista de piezas individuales a cortar para fabricar un gabinete.$md$,
   ARRAY['glossary','cutlist','despiece']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Snapshot v1 of every seeded entry into kb_entry_versions
-- ============================================================================

INSERT INTO kb_entry_versions (
  entry_id, version_num, title, slug, category_id, entry_type,
  body_md, structured_data, tags, supplier_ids, product_refs, price_item_refs,
  edit_summary
)
SELECT
  e.id, 1, e.title, e.slug, e.category_id, e.entry_type,
  e.body_md, e.structured_data, e.tags, e.supplier_ids, e.product_refs, e.price_item_refs,
  'Seed v1 (2026-04-17) — initial ingest from Evita_Knowledge_Base_Seed_v1.md'
FROM kb_entries e
WHERE NOT EXISTS (
  SELECT 1 FROM kb_entry_versions v
  WHERE v.entry_id = e.id AND v.version_num = 1
);

-- ============================================================================
-- Verification comment (run manually if desired)
-- ============================================================================
--   SELECT (SELECT count(*) FROM kb_categories) AS categories,
--          (SELECT count(*) FROM kb_suppliers) AS suppliers,
--          (SELECT count(*) FROM kb_entries) AS entries,
--          (SELECT count(*) FROM kb_entry_versions) AS versions;
-- Expected: categories=12, suppliers=12, entries=70, versions=70
