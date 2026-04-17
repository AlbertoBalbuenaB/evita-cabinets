/*
  # Wiki — Platform usage guide (task 3)

  Adds a new "Plataforma" category and 10 articles covering every major
  area of the Evita Cabinets web app. These are internal user-facing docs
  aimed at estimators, sales, supervisors, and admins — NOT developer
  documentation.
*/

INSERT INTO wiki_categories (slug, name, description, icon, sort_order) VALUES
  ('platform', 'Plataforma', 'Guía de uso de la plataforma web de Evita Cabinets.', 'Monitor', 70)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO wiki_articles (slug, title, summary, category_id, body_md, tags) VALUES
  ('platform-overview',
   'Guía general — qué hace la plataforma Evita',
   'Resumen end-to-end del sistema: cotización, proyectos, catálogos, inventario, optimizer, KB y Wiki.',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$La **Plataforma Evita Cabinets** centraliza los flujos operativos y comerciales de la empresa:

- **Cotización** — precios en MXN y USD con logica de FX, waste, labor y tarifas.
- **Gestión de proyectos** — hub de proyectos con cotizaciones, áreas, documentos, tareas, bitácora.
- **Catálogos** — Cabinets (CDS), Closets (Evita Plus/Premium), Prefab (Venus / Northville) y Price List de materiales.
- **Inventario** — movimientos, low stock, proveedores.
- **Optimizer** — nesting y cálculo de hojas para cortes.
- **Knowledge Base (KB)** — acabados, herrajes, cubrecantos, reglas y constantes operativas.
- **Wiki** — manual de armado, protocolos, capacitación.
- **Evita AI** — asistente con contexto de KB, Wiki y datos en vivo.

### Cómo están organizadas las secciones

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Home | `/` | Landing + tareas + bitácora. |
| Dashboard | `/dashboard` | Analítica y estado general. |
| Projects | `/projects` | Hub de proyectos. |
| Products | `/products` | Catálogo CDS + Closets + Prefab. |
| Prices | `/prices` | Price list + inventario + proveedores. |
| Templates | `/templates` | Plantillas reusables de gabinetes. |
| Tools | `/tools` | Optimizer + Plan Viewer + Draft Tool. |
| KB | `/kb` | Knowledge Base con reglas, constantes, acabados. |
| Wiki | `/wiki` | Manual de armado, protocolos, capacitación. |
| Settings | `/settings` | Configuración global (solo admins). |

### Para empezar

Sigue estos artículos en orden si eres nuevo en la plataforma:

1. [[wiki:platform-projects|Proyectos y cotizaciones]] — flujo principal.
2. [[wiki:platform-products-catalog|Catálogo de gabinetes]].
3. [[wiki:platform-price-list|Price list e inventario]].
4. [[wiki:platform-optimizer|Optimizer de hojas]].
5. [[wiki:platform-kb|Cómo usar el KB]] y [[wiki:platform-wiki|el Wiki]].
6. [[wiki:platform-evita-ai|El asistente Evita AI]].
$md$,
   ARRAY['platform','overview','guía','primer-paso']),

  ('platform-projects',
   'Proyectos y cotizaciones',
   'El flujo principal: crear un proyecto, agregar cotizaciones, capturar áreas y cabinets.',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$Un **proyecto** agrupa todas las cotizaciones para un mismo cliente o dirección. Cada **cotización** es una versión de precios con su propio conjunto de áreas, cabinets, countertops y ajustes.

### Crear un proyecto

1. Ve a **`/projects`** (Projects en el nav).
2. Botón **New Project** — captura nombre, cliente, dirección, tipo de proyecto.
3. El proyecto se crea con 0 cotizaciones. Para agregar una, abre el proyecto y usa **New Quotation**.

### Crear una cotización

Dentro del proyecto:

1. **New Quotation** → nombre (ej. "Cocina – Premium"), notas opcionales.
2. La cotización abre en **`/projects/:id/quotations/:quotationId`**.
3. Desde ahí agregas **áreas** (Kitchen, Master Closet, etc.), y dentro de cada área agregas **cabinets** del catálogo o **line items** del price list.

### Áreas

Cada área tiene:

- **Nombre** y **tipo** (Kitchen, Laundry, Bath, Closet, etc.).
- **Aplica tarifa** (`applies_tariff`) — bandera por área para sobretasa.
- **Aplica impuestos** y acabado interior por área.
- Cabinets, items, countertops, prefab items.

### Cabinets

Los cabinets se agregan desde el **catálogo** (ver [[wiki:platform-products-catalog|Catálogo]]) o desde una [[wiki:assembly-piezas-base-gabinete|plantilla]].

Cada cabinet guarda:

- SKU CDS (ej. `102-36×30×18`) o closet / prefab.
- Material de caja + material de puerta (referencias a [[kb:finishes-plus|finishes]]).
- Cubrecanto caja + cubrecanto puertas.
- Cajones + herrajes (stetik / blum / hardware customizable).
- Countertop + solera si aplican.

### Constantes financieras

Cada cotización usa los valores de `settings` que viven en el proyecto Supabase. Ver [[kb:rules-project-constants|Constantes]]:

- FX USD→MXN: `17`
- Waste box ×`1.10`, door ×`1.60`
- Labor: box `$400`, door `$600`

### Estados de cotización

- **Draft** — en captura.
- **Sent** — enviada al cliente.
- **Approved** / **Rejected** — decisión del cliente.
- **Archived** — fuera de uso.

### Breakdown / Analítica / PDF

Dentro de la cotización hay tabs:

- **Info** — totales, SF, tarifa, impuestos.
- **Breakdown** — desglose por área y pieza.
- **Analytics** — gráficas comparativas.
- **PDF** — exporta MXN o USD.
$md$,
   ARRAY['platform','projects','quotations','flow']),

  ('platform-products-catalog',
   'Catálogo de productos — CDS, Closets, Prefab',
   'Los tres catálogos integrados: cabinets CDS, Evita Closets y Prefab (Venus / Northville).',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$La pestaña **`/products`** contiene los tres catálogos de productos que puedes agregar a una cotización.

### Tab 1 — Cabinets (CDS)

Más de 1,500 productos CDS. Ver [[kb:rules-cds-series|CDS series]] en el KB:

- Series 100 (base sin cajones), 200 (base con cajones), 300 (wall), 400 (tall storage), 500 (tall wardrobe).
- SKU: `{series}-{W}×{H}×{D}` — ej. `102-36×30×18`.
- Sufijo `M` = diseño modificado.
- Cada producto trae su **despiece** (cut_pieces) precargado.

**Filtros disponibles:** colección, ancho, alto, profundidad, búsqueda por SKU.

### Tab 2 — Closets (Evita Plus / Premium)

~1,200 closets con sus componentes (shelves, hang rods, drawers).

- Líneas: [[kb:finishes-plus|Plus]] y [[kb:finishes-premium|Premium]].
- Filtros: línea, tipo, dimensiones.

### Tab 3 — Prefab Library (Venus / Northville)

~650 cabinets prefabricados importados:

- **Venus** y **Northville** — proveedores.
- Precios en **USD** con variación por **finish** (ej. "Houston Frost", "Elegant White").
- La tarifa y el multiplicador de profit se aplican por área al momento de cotizar — **NO** están incluidos en el MSRP mostrado.

### Agregar un producto a una cotización

1. Desde el catálogo, click en el producto → **Add to area**.
2. Selecciona la cotización y el área destino.
3. El producto se inserta con materiales/herrajes por default (puedes overridear en el editor de cabinet).
$md$,
   ARRAY['platform','products','catalog','cds','closet','prefab']),

  ('platform-price-list',
   'Price List e inventario',
   'Materiales, herrajes, countertops, mano de obra y el inventario que se consume de la cotización.',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$El **Price List** (`/prices`) es el catálogo de **materiales e insumos** con precios unitarios. A diferencia del [[wiki:platform-products-catalog|catálogo de productos]] (que son cabinets), aquí están las **materias primas**.

### Tabs

1. **Catalog** — vista principal del price list.
2. **Stock** — inventario actual por item.
3. **Movements** — registro de entradas y salidas.
4. **Suppliers** — catálogo de proveedores operativos.

### Qué vive aquí

- Tableros (Plus, Premium, Elite) — ver [[kb:finishes-plus|acabados en KB]].
- Cubrecantos (Type A, Type B) — ver [[kb:edge-bands-type-a-pvc|edge bands KB]].
- Herrajes ([[kb:hardware-slides|correderas]], [[kb:hardware-hinges|bisagras]], etc.).
- Countertops (solid surface, cuarzo).
- Line items genéricos (mano de obra, transporte, otros).

### Precios

Cada item tiene `price` en **MXN** (default) y campos auxiliares como `unit` (m, pza, SF, hoja), `type` (Material, Hardware, etc.). Los cambios de precio quedan en `price_change_log`.

### Suppliers

- **Cada item** puede tener 1+ proveedores asociados (`price_list_suppliers`).
- El **proveedor operativo** (`/suppliers/:id`) es el contacto comercial (teléfono, email, condiciones).
- Los **proveedores KB** (`[[supplier:barcocinas|Barcocinas]]`) son la ficha informativa. El KB enlaza al proveedor operativo via `ops_supplier_id`.

### Movimientos de inventario

- **Entrada** (compra, devolución) → `inventory_movements` con dirección `in`.
- **Salida** (consumo en proyecto, merma) → dirección `out`.
- El stock neto se calcula de los movimientos.

### Purchases

Desde un proyecto puedes generar una **purchase list** — aggregar items faltantes por stock y generar órdenes a proveedor.
$md$,
   ARRAY['platform','prices','inventory','suppliers','stock']),

  ('platform-optimizer',
   'Optimizer — nesting y cálculo de hojas',
   'Calcula cuántas hojas de material necesitas para una cotización usando un algoritmo de nesting.',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$El **Optimizer** (`/optimizer` o desde una cotización) hace **nesting** de cortes: agrupa las piezas de todos los cabinets en las hojas reales de material (4×8 ft o 48×108) y calcula cuántas hojas se necesitan.

### Para qué sirve

Dos casos de uso:

1. **Cotización real** — en lugar del método SF con waste factor (ver [[kb:costs-waste-multipliers|waste]]), usar el conteo real de hojas del optimizer.
2. **Corte en planta** — exportar el nesting con posiciones exactas para la seccionadora.

### Correr el optimizer

1. Dentro de la cotización, tab **Optimizer**.
2. Revisa o edita el **cut list** (lista de piezas con sus dimensiones y cubrecanto).
3. Click **Run** → se genera una corrida (`quotation_optimizer_runs`).
4. La corrida guarda: # de hojas por material, % de utilización, posiciones, desperdicio total.

### Métodos de precio

Cada cotización tiene un `pricing_method`:

- **`sqft`** (default) — square footage × waste factor × precio por SF.
- **`optimizer`** — basado en hojas reales de la corrida activa.

El método activo se selecciona en la cotización. Una misma cotización puede correr varias veces el optimizer y guardar cada run; solo uno se marca como **active** y ese es el que alimenta los totales.

### Cut list pre-optimizer

Antes de correr puedes **editar** nombres de pieza, dimensiones, materiales, cantidades y cubrecanto desde el tab Breakdown. Los cambios se guardan en `area_cabinets.cut_piece_overrides` (no modifican el catálogo).

### Agrupación por área

El cut list se muestra agrupado por **área**, con los cabinets bajo sus headers. Esto facilita la validación antes de correr.
$md$,
   ARRAY['platform','optimizer','nesting','hojas','cut-list']),

  ('platform-kb',
   'Cómo usar el Knowledge Base (KB)',
   'Referencia de acabados, cubrecantos, herrajes, reglas y constantes. Propuestas para contribuir.',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$El **Knowledge Base** (`/kb`) es la **fuente de verdad** para números y definiciones operativas: precios de tableros, cubrecantos, reglas de cubrecanto por pieza, constantes financieras, material IDs críticos.

### Categorías principales

- **Acabados** — [[kb:finishes-plus|Plus]], [[kb:finishes-premium|Premium]], [[kb:finishes-elite|Elite]], [[kb:finishes-laminate|Laminate]], [[kb:finishes-stain|Stain]].
- **Cubrecantos** — [[kb:edge-bands-type-a-pvc|Type A]], [[kb:edge-bands-type-b-pvc|Type B]], placeholder NOT APPLY.
- **Herrajes** — slides, hinges, LED, accesorios, cerraduras.
- **Reglas** — 10 reglas generales + 9 reglas de cubrecanto por pieza + CDS + plywood base + grain.
- **Proveedores** — Barcocinas, Arauco, Alvic, Blum, Stetik, etc.
- **Glosario** — CDS, RTA, EB, NOT APPLY, etc.

### Cómo buscar

- **Ctrl+K** abre el global search — filtra entre proyectos, cotizaciones, productos, price list, KB entries y suppliers.
- Desde `/kb` usa el buscador y los chips de categoría.

### Proponer cambios

Cualquier miembro del equipo puede proponer cambios — el flujo es estilo **Pull Request**:

1. Abre una entrada → **Propose edit**.
2. Modifica el contenido (Markdown) + tags + structured data.
3. **Submit** → la propuesta entra en estado `open`.
4. Un admin la revisa, puede pedir cambios, aprobar o rechazar.
5. Al aprobar + mergear, la entrada se actualiza y se guarda una nueva versión en el historial.

### Comentarios y versiones

- Cada propuesta tiene su thread de **comentarios**.
- Cada entrada tiene su **version timeline** — quién editó qué y cuándo.
- Los admins ven `/kb/audit` — registro inmutable de todas las mutaciones.
$md$,
   ARRAY['platform','kb','knowledge-base','propuestas','versiones']),

  ('platform-wiki',
   'Cómo usar el Wiki',
   'Manual de armado, protocolos, capacitación. Contenido narrativo — complemento del KB.',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$El **Wiki** (`/wiki`) es el **manual narrativo** — contenido largo para capacitación, protocolos de armado, calidad, seguridad y flujo de taller.

### KB vs Wiki

- **KB** = números, reglas, precios, constantes, códigos. Lookup rápido.
- **Wiki** = procedimientos paso a paso, checklists, capacitación. Lectura larga.

### Categorías

- **Bienvenida** — introducción al manual.
- **Armado** — prácticas generales, piezas base, entrepaños, correderas, bisagras, herrajes especiales.
- **Calidad** — [[wiki:quality-jidoka|Jidoka]], cubrecantos por pieza, veta, vistas principales.
- **Seguridad** — [[wiki:safety-epp-overview|EPP]].
- **Capacitación** — materiales ([[wiki:training-materiales-melamina|melamina]], [[wiki:training-materiales-triplay|triplay]], etc.).
- **Flujo de Taller** — [[wiki:workflow-5s|5S]], [[wiki:workflow-manejo-proceso|manejo del proceso]], [[wiki:workflow-empaque-rta|empaque RTA]].
- **Plataforma** (esta categoría) — guía de uso del sistema.

### Cross-links

Los artículos del Wiki enlazan al KB con `[[kb:slug|nombre]]` y a otros artículos del Wiki con `[[wiki:slug|título]]`. Los enlaces se ven en **violeta** en el renderer y son navegables con un click.

### Proponer cambios

Mismo flujo que el KB — **Propose edit** desde cualquier artículo, revisión y merge por admin, historial de versiones, audit log. Ver [[wiki:platform-kb|Cómo usar el KB]] para el detalle del workflow.
$md$,
   ARRAY['platform','wiki','manual','capacitación']),

  ('platform-evita-ai',
   'Evita AI — el asistente de la plataforma',
   'Chat con contexto de KB, Wiki, cotizaciones y catálogos. Cómo preguntar y qué puede hacer.',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$**Evita AI** es el asistente de IA integrado en la plataforma. Flotante en todas las páginas (ícono de chispa en la esquina inferior derecha).

### Qué puede hacer

- **Consultas al KB y Wiki** — "¿cuál es el factor de desperdicio de caja?" → cita [[kb:rules-project-constants|constantes]].
- **Contexto de cotización** — si abres una cotización, el chat sabe qué proyecto y qué cotización tienes abiertos, los totales, áreas y cabinets.
- **Búsqueda de productos** — "busca un cabinet base de 36 pulgadas con cajones".
- **Modificaciones** — puede actualizar materiales, herrajes, cantidades de cabinets en una cotización (con confirmación).
- **Búsqueda de materiales** — "qué es el Type B EB" → cita [[kb:edge-bands-type-b-pvc|Type B]] con precio verbatim.

### Cómo preguntar bien

- Sé específico — "cambia el material de caja a Premium en los cabinets del área Kitchen".
- Usa los nombres del KB/Wiki — "¿cómo se usa Jidoka?" → te lleva a [[wiki:quality-jidoka|el artículo]].
- Para números exactos — el asistente **cita verbatim** FX=`17`, waste ×`1.10`/`1.60`, labor `$400`/`$600`, material UUIDs. Si ves un valor distinto, es un bug — reporta.

### Cross-links en las respuestas

El asistente emite enlaces como `[[kb:slug|Name]]`, `[[wiki:slug|Title]]`, `[[supplier:slug|Name]]`, `[[project:uuid|Name]]`. El renderer los convierte en botones clicables (KB/supplier en verde, Wiki en violeta, project/material en azul).

### Limitaciones

- No modifica el catálogo (`products_catalog`) — solo las cotizaciones.
- No borra datos sin confirmación explícita.
- Si falla con "Connection error", es un problema de auth — contactar al administrador.
$md$,
   ARRAY['platform','ai','evita-ia','chat','asistente']),

  ('platform-suppliers',
   'Gestión de proveedores',
   'Dos capas: proveedores operativos (contacto + precios) y proveedores KB (fichas técnicas).',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$La plataforma maneja **dos capas** de proveedores que se complementan:

### 1. Proveedores operativos — `/suppliers`

Entidad comercial con:

- Nombre, contacto, teléfono, email, sitio web.
- Condiciones de pago, lead time default.
- Notas y bitácora (`supplier_logs`).
- Items del price list asociados vía `price_list_suppliers`.

Aquí vives cuando necesitas **comprar** algo: a quién marcarle, qué le has comprado antes, cuánto tarda en entregar.

### 2. Proveedores KB — `/kb/suppliers/:slug`

Ficha **técnica / informativa**:

- Categorías (finishes, hardware, textiles).
- Notas (Markdown) sobre líneas de producto, códigos cliente, política.
- Artículos del KB que los referencian.
- **Link opcional** a la ficha operativa (`ops_supplier_id` → `/suppliers/:id`).

Aquí vives cuando necesitas entender **qué te surte** un proveedor y **cómo encaja en el KB**.

### Cuándo usar cuál

- "¿Cuánto debe Alvic?" → **operativo** (`/suppliers/alvic`).
- "¿Qué líneas de Evita usa Alvic?" → **KB** ([[supplier:alvic|Alvic]]).
- "¿Qué correderas vende Stetik?" → **KB** ([[kb:hardware-slides|Correderas]] menciona precios y modelos).
$md$,
   ARRAY['platform','suppliers','kb','operativo']),

  ('platform-settings',
   'Settings — configuración global (admin)',
   'Constantes financieras, labor, waste, FX, taxes. Solo accesible para administradores.',
   (SELECT id FROM wiki_categories WHERE slug = 'platform'),
   $md$La página **`/settings`** es **solo admin** (enforced vía `AdminRoute`). Aquí viven las **constantes globales** que alimentan todas las cotizaciones.

### Qué vive aquí

- **FX** (`exchangeRateUsdToMxn`) — actualmente `17`.
- **Waste** (`wastePercentageBox` / `wastePercentageDoors`) — `10%` / `10%`.
- **Labor** (`laborCostNoDrawers`, `laborCostWithDrawers`, `laborCostAccessories`).
- **Taxes by type** — overrides por tipo de proyecto.
- **Custom types / units** — categorías agregadas para price list.

### Cómo se consumen

Los valores viven en la tabla `settings` de Supabase. El frontend los lee con **5 minutos de cache** (`useSettingsStore`). Al cambiar aquí, las cotizaciones nuevas usan el valor actualizado **a partir del próximo fetch** — las cotizaciones ya abiertas pueden tener el valor viejo hasta que se recarguen.

### Referencias KB

Estas constantes también aparecen en el KB como **referencia** — ver [[kb:rules-project-constants|Constantes del proyecto Evita]]. La diferencia:

- **Settings** = valores **activos**, fuente de verdad del motor de cotización.
- **KB** = **documentación** de las constantes, con contexto y reglas de uso.

### Cambios

Cambiar FX o labor tiene **impacto global**. Se recomienda:

1. Validar con el equipo de costeo antes.
2. Revisar cotizaciones abiertas para saber si hay que re-generar.
3. Loguear el cambio en el KB (via propuesta) si es cambio permanente.
$md$,
   ARRAY['platform','settings','admin','constantes','config']);

-- Version snapshots
INSERT INTO wiki_article_versions (article_id, version_num, title, slug, summary, category_id, body_md, tags, edit_summary)
SELECT a.id, 1, a.title, a.slug, a.summary, a.category_id, a.body_md, a.tags,
  'Platform usage guide v1 (2026-04-18)'
FROM wiki_articles a
WHERE a.category_id = (SELECT id FROM wiki_categories WHERE slug = 'platform')
  AND NOT EXISTS (SELECT 1 FROM wiki_article_versions v WHERE v.article_id = a.id AND v.version_num = 1);
