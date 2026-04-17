/*
  # Wiki — MANUAL PARTE 1.pdf ingestion v1

  Source: C:\Users\alber\Downloads\_Organizado\Documentos\MANUAL PARTE 1.pdf
         (36 pages, "Técnicas y Buenas Prácticas de Armado 2025")

  Replaces the 5 Phase 2A placeholder stubs with 20+ real articles whose
  body_md preserves the MANUAL content verbatim (modulo light Markdown
  formatting to render cleanly).

  Content inconsistency to resolve (flagged for Alberto):
    - MANUAL §30 calls the Alvic line "Evita Premium (Alvic)".
    - KB §1.3 calls the Alvic line "Evita Elite".
    These should be the same line. The KB is likely the canonical naming
    (it drives quotation pricing). The Wiki entry below uses the MANUAL
    phrasing verbatim and cross-links to kb:finishes-elite so the reader
    sees both names. Resolve the naming mismatch in a follow-up.

  This migration is idempotent: DELETE from wiki_articles cascades to
  wiki_article_versions, then INSERT fresh rows. Re-running will replay.
*/

-- Blow away the Phase 2A stubs (there are only 5).
DELETE FROM wiki_articles
WHERE slug IN (
  'welcome-introduccion',
  'assembly-correderas-ocultas',
  'safety-epp-diario',
  'quality-alineacion-puertas',
  'workflow-empaque-rta'
);

-- ============================================================================
-- welcome
-- ============================================================================
INSERT INTO wiki_articles (slug, title, summary, category_id, body_md, tags, reading_time_min) VALUES
  ('welcome-introduccion',
   'Introducción al Manual de Armado Evita 2025',
   'Manual de técnicas fundamentales y mejores prácticas para el armado de gabinetes.',
   (SELECT id FROM wiki_categories WHERE slug = 'welcome'),
   $md$En este manual se presentan las **técnicas fundamentales** y las **mejores prácticas** para el armado de gabinetes, con el objetivo de garantizar la **calidad, durabilidad y estética** de cada gabinete.

La correcta aplicación de estos procedimientos es esencial para optimizar el proceso productivo y asegurar la satisfacción del cliente final.

---

### Secciones del manual

- **Armado** — prácticas generales, piezas base del gabinete, entrepaños, armadores, puertas/frentes, paneles/fillers, elementos de fijación, correderas, bisagras, herrajes especiales.
- **Calidad** — metodología **Jidoka**, cubrecantos por pieza, orientación de veta, vistas principales del gabinete.
- **Seguridad** — Equipo de Protección Personal (EPP).
- **Flujo de taller** — metodología **5S**, manejo del proceso (antes / durante / después).

### Referencias cruzadas al KB

Para precios, constantes financieras (FX, waste, labor) y códigos de material específicos, consulta la [[kb:rules-project-constants|Knowledge Base]]. Términos técnicos definidos en el [[kb:glossary-cds|glosario del KB]].
$md$,
   ARRAY['intro','welcome','manual'],
   3),

-- ============================================================================
-- assembly
-- ============================================================================
  ('assembly-practicas-generales',
   'Prácticas Generales de Armado',
   '12 puntos obligatorios antes, durante y después del ensamble de un gabinete.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$### Prácticas Generales de Armado (12 puntos)

1. Verificar que todas las piezas del gabinete estén completas y en buen estado antes de iniciar el ensamble.
2. Tener a la mano los insumos, herrajes y herramientas necesarias para el armado.
3. Mantener el área de trabajo limpia y ordenada antes, durante y después del proceso.
4. Realizar el montaje únicamente sobre superficies **planas, firmes y niveladas**.
5. Ensamblar todas las piezas respetando las medidas y especificaciones de diseño.
6. Asegurar que la orientación de la veta, los colores y los cubrecantos correspondan a lo establecido en el proyecto.
7. Utilizar siempre los herrajes adecuados y colocarlos en la posición indicada.
8. Garantizar un ajuste firme en todas las uniones, evitando holguras, desniveles o movimientos.
9. Seguir el orden de ensamble definido por el área de producción.
10. Aplicar el principio de **Jidoka**: en caso de detectar un fallo, detener el proceso y realizar la corrección necesaria. Ver [[wiki:quality-jidoka|Jidoka]].
11. Informar de inmediato al supervisor de producción en caso de cualquier duda o situación que afecte la calidad del gabinete.
12. Revisar el gabinete terminado para confirmar estabilidad, uniformidad y calidad en el acabado.
$md$,
   ARRAY['assembly','checklist','prácticas-generales'],
   4),

  ('assembly-piezas-base-gabinete',
   'Piezas base de un gabinete',
   'Componentes estructurales: costados, piso, techo, trasero, y sustituciones con armadores.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$Un **gabinete básico** está compuesto por las siguientes **piezas base**:

1. **Costado izquierdo**
2. **Costado derecho**
3. **Piso**
4. **Techo**
5. **Trasero**

### Sustituciones de la pieza 4 (Techo)

En algunos casos la pieza 4 (Techo) puede ser sustituida por **2 armadores** según lo requiera el encargado de producción. Estos son principalmente **gabinetes con cubiertas especiales**.

### Sustituciones de piezas 4 y 5 (Techo y Trasero)

Pueden presentarse casos donde la pieza 4 (Techo) **y** la pieza 5 (Trasero) sean sustituidas por **2 armadores cada una** (total 4 armadores), según lo requiera el encargado de producción. Aplica principalmente a **gabinetes diseñados para integrar fregaderos**.

### Complementos

Además de las piezas base, se incorporan **piezas adicionales**:

- **Entrepaños** (ver [[wiki:assembly-entrepanos|Entrepaños]])
- **Armadores frontales** (ver [[wiki:assembly-armadores-frontales|Armadores]])
- **Puertas y frentes de cajón** (ver [[wiki:assembly-puertas-frentes|Puertas y Frentes]])
$md$,
   ARRAY['assembly','piezas-base','estructura','costados','armadores'],
   5),

  ('assembly-entrepanos',
   'Entrepaños — Ajustables y Fijos',
   'Dos tipos de entrepaño manejados por Evita y sus reglas de uso.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$Dentro de la línea de Gabinetes Evita se manejan **2 tipos de entrepaño**: **ajustable** y **fijo**.

### Entrepaños Ajustables

- Cubrecanto por **sus 4 cantos**.
- Se usan en **gabinetes de mayor altura**.
- Ver [[kb:rules-cutlist-shelves-adjustable|Cut List EB — Entrepaños Ajustables]] para el mapeo de cubrecanto.

### Entrepaños Fijos

- Cubrecanto **solo por un canto** (frontal).
- De **menor fondo** que los ajustables.
- Se usan principalmente en **gabinetes tipo Base**.
- Ver [[kb:rules-cutlist-shelves-fixed|Cut List EB — Entrepaños Fijos]].

> **Nota:** la cantidad y las medidas de los entrepaños pueden variar según los requerimientos específicos del diseño.
$md$,
   ARRAY['assembly','entrepaño','shelves','ajustable','fijo'],
   3),

  ('assembly-armadores-frontales',
   'Armadores Frontales — Normal y Vista',
   'Armadores como divisores estructurales y estéticos en gabinetes tipo cajonero.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$Los **Armadores Frontales** se utilizan en **gabinetes tipo cajonero**, cumpliendo funciones tanto **estructurales como estéticas**. Sirven como divisores entre cajones o como frentes visibles, según el diseño del mueble.

### Armador Normal

- Montaje en posición **horizontal**.
- Se utiliza como **elemento divisor entre cajones**.

### Armador Vista

- Funciona como **parte visible del gabinete** en configuraciones con cajones de corte a 40°.
- Instalación en posición **vertical**.

> **Nota:** la cantidad y las medidas de los armadores pueden variar según los requerimientos específicos del diseño.

### Cubrecanto

El cubrecanto del armador va **únicamente en su lado más largo**, tanto en el armador de vista como en el horizontal. Ver [[kb:rules-cutlist-shelves-adjustable|reglas de cubrecanto]].
$md$,
   ARRAY['assembly','armador','frontales','cajonero'],
   3),

  ('assembly-puertas-frentes',
   'Puertas y Frentes — tipos de corte',
   'Tres estilos de puerta/frente: Liso (Flat), Corte 40°, y Shaker.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$Las **Puertas y Frentes** constituyen los componentes más **relevantes** de un gabinete, ya que representan su **vista principal**. Deben manipularse con **especial cuidado** durante todo el proceso de manejo e instalación.

### Tipos

- **Puerta / Frente Liso (Flat)** — acabado plano estándar.
- **Puerta / Frente Corte 40°** — corte angular para configuraciones con armador vista.
- **Puerta / Frente Shaker** — estilo con marco y panel central.

### Cubrecanto

Puertas y frentes llevan cubrecanto **en sus 4 lados**, siempre en el mismo color de la puerta/frente. En casos especiales con corte a 40°, se aplica cubrecanto del mismo color pero con **diferente grosor**, según lo requiera el encargado de producción. Ver [[kb:rules-cutlist-doors-drawers|Cut List EB — Puertas y Drawer Faces]].

### Veta (grain)

Orientación **vertical** en puertas y frentes. Ver [[wiki:quality-orientacion-veta|Orientación de veta]].
$md$,
   ARRAY['assembly','puertas','frentes','shaker','40-grados','flat'],
   3),

  ('assembly-paneles-fillers',
   'Paneles laterales y Ajustes (Fillers)',
   'Paneles como parte de la vista principal, y fillers para corregir descuadres.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$Los **paneles** son complementos **delicados** que forman parte esencial de la vista principal del gabinete. Requieren **manejo cuidadoso** para preservar su acabado y apariencia.

Los **ajustes (fillers)** son piezas diseñadas para **corregir errores de descuadre** durante la instalación, facilitando un ensamblaje preciso y funcional.

### Cubrecanto

- **Paneles:** cubrecanto en los **4 lados**, siempre en el mismo tono de la pieza.
- **Fillers:** cubrecanto únicamente en sus **2 lados más largos**, mismo tono.

### Reglas de material (KB)

- [[kb:panels-fillers|Fillers]] → **calcular doble** en material.
- [[kb:panels-refrigerator|Paneles de refrigerador]] → **calcular doble** en material.
- [[kb:panels-side|Paneles laterales]] → cortar **+1"** sobre medida nominal.
$md$,
   ARRAY['assembly','paneles','filler','fillers','ajustes'],
   3),

  ('assembly-elementos-fijacion',
   'Elementos de Fijación',
   'Pijas, grapas, clavillos y tornillos SPAX usados en el ensamble.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$En el armado de gabinetes, los **elementos de fijación** unen y dan firmeza a cada pieza del mueble. Aseguran que costados, entrepaños, cubiertas y frentes queden correctamente ensamblados, garantizando **resistencia, estabilidad y buen acabado**.

### Pijas Zinc / Niqueladas Cruz

**Medidas:** 5/8" – 1" – 1 1/4" – 1 1/2" – 2"

### Grapa Calibre 18

**Medidas:** 3/4" – 7/8" – 1" – 1 1/4" – 1 1/2"

### Clavillo Calibre 18

**Medidas:** 3/4" – 1" – 1 1/4" – 1 1/2" – 2"

### SPAX

**Medidas:** 3.5 × 40 – 3.5 × 16
$md$,
   ARRAY['assembly','fijación','pijas','grapas','clavillos','spax'],
   3),

  ('assembly-correderas',
   'Correderas — Ocultas, Extensión, Optimo',
   'Tres tipos de corredera que permiten el deslizamiento suave de cajones.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$Las **correderas** son herrajes que permiten que los cajones deslicen suavemente y soporten el peso de su contenido, garantizando **funcionalidad, comodidad y durabilidad** en el uso del gabinete.

### Correderas Ocultas

Permiten que los cajones deslicen suavemente **sin que la guía sea visible**, ofreciendo un acabado estético limpio.

**Medidas comunes:** 350mm · 400mm · 450mm · 500mm

### Correderas Extensión

Permiten que los cajones **se extraigan por completo**, facilitando el acceso a todo su contenido.

**Medidas comunes:** 250mm · 350mm · 400mm · 450mm · 500mm · 550mm

### Correderas Optimo

**Costados de aluminio** que proporcionan resistencia y durabilidad, con diseño integrado y moderno.

**Medidas comunes:** 550mm

Se usan **solo en Gabinetes de cocina** según lo requiera el cliente.

### Referencias KB

Ver [[kb:hardware-slides|Correderas (Slides)]] para precios por juego.
$md$,
   ARRAY['assembly','slides','correderas','ocultas','optimo','undermount'],
   4),

  ('assembly-bisagras',
   'Bisagras',
   'Cuatro tipos de bisagra: 35mm con/sin soft-close, 3×3 inox, Tip-On TITUS.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$Las **bisagras** permiten que las puertas de los gabinetes se abran y cierren correctamente, asegurando **alineación precisa y movimiento controlado** que evita golpes y desgastes prematuros.

### Bisagra 35mm Recta 110° **sin Cierre Suave**

Solo se usa cuando el diseño solicita **TIP-ON**.

### Bisagra 35mm Recta 110° **con Cierre Suave** *(estándar)*

**Siempre utilizada** en todo tipo de Gabinete que requiera una puerta.

### Bisagra 3" × 3" Acero Inox. con Balero

Utilizada para **Puertas de Acceso**.

### Tip-On TITUS

Utilizado para puertas con **Sistema Push** (push-to-open).

### Referencias

- [[kb:hardware-hinges|Hardware — Bisagras]] en KB.
- [[wiki:quality-jidoka|Jidoka]] para inspección de defectos en alineación.
$md$,
   ARRAY['assembly','bisagras','hinges','soft-close','tip-on','titus'],
   3),

  ('assembly-herrajes-especiales',
   'Herrajes Especiales',
   'Accesorios para mejorar la funcionalidad y adaptabilidad de los gabinetes.',
   (SELECT id FROM wiki_categories WHERE slug = 'assembly'),
   $md$Los **herrajes especiales** son accesorios diseñados para mejorar la **funcionalidad y adaptabilidad** de los gabinetes.

### Ejemplos

| Herraje | Aplicación |
|---------|------------|
| **Hailo Eurocargo 450** | Bote de basura extraíble. Proveedor: [[supplier:hailo|Hailo]]. |
| **Especiero Extraíble** | Organizador vertical de especias. |
| **Barra Abatible** | Barra de colgado para closets bajos. |
| **Pantalón Extraíble** | Closets de vestidor. |
| **Colgador Extraíble** | Closets de vestidor. |
| **Joyero** | Cajón interior con divisiones para joyería. |
| **Herrajes para Closet** | Variantes específicas para closets. |
| **Cerraduras** | Mecánicas y digitales. Ver [[kb:hardware-locks|Cerraduras]] en KB. |

### Referencias

- [[kb:hardware-special-accessories|Accesorios Especiales]] en KB.
$md$,
   ARRAY['assembly','herrajes','especiales','hailo','cerraduras'],
   3),

-- ============================================================================
-- quality
-- ============================================================================
  ('quality-jidoka',
   'Jidoka — Detectar, detener, corregir, prevenir',
   'Metodología Toyota aplicada al armado: calidad en origen, sin retrabajos.',
   (SELECT id FROM wiki_categories WHERE slug = 'quality'),
   $md$**Jidoka** es una metodología del **Sistema de Producción Toyota** que consiste en **detectar y detener el proceso ante cualquier defecto, corregir la causa y prevenir su recurrencia**.

En la fabricación de gabinetes, su aplicación garantiza la **calidad en cada etapa**, evitando retrabajos y asegurando un producto final conforme a los estándares establecidos.

### Reglamento para la Aplicación de Jidoka

#### 1. Detección inmediata de anormalidades

- Todo colaborador deberá estar atento a defectos en piezas, herrajes, adhesivos o acabados.
- Identificar desviaciones en medidas, perforaciones o alineaciones.

#### 2. Suspensión del proceso en caso de irregularidad

- El operador está **autorizado a detener la operación** inmediatamente al detectar un problema.
- La detención se realizará de manera segura, evitando riesgos al equipo y al personal.

#### 3. Corrección y notificación del problema

- Todo defecto deberá corregirse de forma **inmediata** antes de continuar.
- El operador deberá **informar al supervisor** sobre la incidencia.
- Los ajustes realizados deberán **documentarse** para control y análisis.

#### 4. Prevención de recurrencia

- Establecer **controles visuales o indicadores** que faciliten la detección temprana.
- Capacitación constante en detección de defectos y buenas prácticas.
- Los procedimientos de inspección y control deberán **estandarizarse** y actualizarse según los hallazgos.

### Ver también

- [[wiki:assembly-practicas-generales|Prácticas Generales de Armado]] — punto 10.
- [[wiki:workflow-5s|5S — organización y mejora continua]].
- [[kb:glossary-jidoka|Glosario: Jidoka]].
$md$,
   ARRAY['quality','jidoka','toyota','lean','defectos','calidad'],
   5),

  ('quality-cubrecantos-por-pieza',
   'Cubrecantos por pieza — reglas completas',
   'Reglas de aplicación de cubrecanto por tipo de pieza: costados, piso/techo, trasero, entrepaños, armadores, paneles, puertas.',
   (SELECT id FROM wiki_categories WHERE slug = 'quality'),
   $md$Todas las piezas que conforman el gabinete deberán llevar **cubrecanto en la totalidad de sus bordes expuestos**, sin excepción. Esta norma garantiza la **protección del material**, la **durabilidad del producto** y la obtención de un **acabado final de alta calidad**.

---

### Costados

Los costados (izquierdo y derecho) deberán llevar cubrecanto en sus **4 lados**, ya sea en un solo color o en combinación de dos colores.

- **Caso 1:** cubrecanto del mismo color aplicado en los 4 lados.
- **Caso 2:** cubrecanto aplicado en 3 lados con el mismo color y color diferente en el lado restante.
- **Caso 3:** cubrecanto aplicado en 3 lados con el mismo color y en 2 lados con color diferente. **Solo aplica a gabinetes tipo alacena.**

Ver [[kb:rules-cutlist-sides-base-tall|Cut List EB — Costados Base/Tall]] y [[kb:rules-cutlist-sides-wall|Costados Wall]].

---

### Piso y Techo

Cubrecanto **únicamente en el lado frontal**, siempre del mismo color que la puerta o frente.

Ver [[kb:rules-cutlist-top-bottom|Cut List EB — Piso/Techo]].

---

### Trasero

Cubrecanto en **2 de sus lados**, en un solo color o en combinación de dos.

- **Caso 1:** cubrecanto del mismo color en ambos lados.
- **Caso 2:** cubrecanto en la parte inferior en el **mismo color de las puertas** o del piso del gabinete, según lo requiera el diseño final.

Ver [[kb:rules-cutlist-back|Cut List EB — Trasero]].

---

### Entrepaños

- **Entrepaños Fijos:** cubrecanto **únicamente en la parte frontal**, en el color del entrepaño o del interior del gabinete. Ver [[kb:rules-cutlist-shelves-fixed|reglas EB]].
- **Entrepaños Ajustables:** cubrecanto en sus **4 lados**, en el color del entrepaño o del interior del gabinete. Ver [[kb:rules-cutlist-shelves-adjustable|reglas EB]].

---

### Armadores

Los armadores llevan cubrecanto **únicamente en su lado más largo**, tanto en el armador de vista como en el horizontal.

---

### Paneles y Ajustes (Fillers)

- **Paneles:** cubrecanto en sus **4 lados**, en el mismo tono de la pieza.
- **Fillers:** cubrecanto **solo en sus 2 lados más largos**, en el mismo tono.

---

### Puertas y Frentes

Cubrecanto en sus **4 lados**, siempre en el mismo color de la puerta/frente. En **corte a 40°** se aplica cubrecanto del mismo color pero con **diferente grosor**, según lo requiera el encargado de producción.

Ver [[kb:rules-cutlist-doors-drawers|Cut List EB — Puertas y Drawer Faces]].

---

### Mapeo numérico (cut list)

- `0` = sin cubrecanto.
- `1` = Type A / Box EB ([[kb:edge-bands-type-a-pvc|PVC Type A]]).
- `2` = Type B / Door EB ([[kb:edge-bands-type-b-pvc|PVC Type B]]).
$md$,
   ARRAY['quality','cubrecanto','edgeband','reglas','por-pieza'],
   8),

  ('quality-orientacion-veta',
   'Orientación de la veta (grain)',
   'Reglas uniformes de orientación de veta para continuidad estética.',
   (SELECT id FROM wiki_categories WHERE slug = 'quality'),
   $md$La **orientación de la veta** se mantendrá uniforme en todas las piezas del gabinete para asegurar **continuidad estética**.

| Pieza | Orientación |
|-------|-------------|
| **Puertas y Frentes** | Vertical |
| **Costados y Paneles Laterales** | Vertical |
| **Trasero** | Vertical |
| **Piso y Techo** | Horizontal |
| **Entrepaños** | Horizontal (dirección del conjunto) |
| **Ajustes (Fillers)** | Dirección del conjunto |
| **Armadores (Horizontal y Frontal)** | Horizontal (según montaje) |

> Estas reglas se cumplen en **todos los casos** — la veta debe mantener la misma orientación aunque el diseño del material tenga variantes visuales.

Ver también [[kb:rules-grain-orientation|Veta por tipo de pieza (KB)]].
$md$,
   ARRAY['quality','veta','grain','orientación'],
   2),

  ('quality-vistas-principales',
   'Vistas principales del gabinete',
   'Qué superficies son visibles al cliente final y cómo protegerlas.',
   (SELECT id FROM wiki_categories WHERE slug = 'quality'),
   $md$Las **vistas principales** de un gabinete son la **frontal, superior y lateral externa**. Son las más importantes — **definen la estética ante el cliente final** y deben mantenerse libres de daños o imperfecciones.

### Parte Frontal

La zona **más visible** del gabinete, define su estética. Incluye puertas, frentes y cajones. Debe mantenerse libre de **rayaduras, golpes o manchas** para garantizar calidad ante el cliente final.

### Parte Inferior

Solo adquiere relevancia en **gabinetes tipo alacena** (donde la parte inferior queda expuesta). En estos casos debe cuidarse especialmente para evitar rayaduras o manchas que afecten la percepción del cliente final.

### Reglas de manejo asociadas

- Ver [[wiki:workflow-manejo-proceso|Manejo del proceso — antes / durante / después]].
- Ver [[wiki:quality-jidoka|Jidoka]] para detención del proceso ante daños visibles.
$md$,
   ARRAY['quality','vistas','estética','alacena','inspección'],
   2),

-- ============================================================================
-- safety — EPP
-- ============================================================================
  ('safety-epp-overview',
   'Equipo de Protección Personal (EPP)',
   'Los 6 EPP obligatorios en planta y cuándo usarlos.',
   (SELECT id FROM wiki_categories WHERE slug = 'safety'),
   $md$El uso adecuado del **Equipo de Protección Personal (EPP)** es esencial para garantizar la seguridad de los trabajadores durante el armado de gabinetes, protegiendo contra riesgos en distintas etapas del proceso.

> La seguridad debe ser **siempre una prioridad** — garantiza no solo la protección individual sino también la **continuidad y calidad** de las operaciones.

---

### 1. Lentes de Protección

- **Objetivo:** proteger los ojos de partículas, polvo, fragmentos de material o exposición a luz intensa.
- **Situación de uso:** durante el armado del gabinete — prevenir lesiones por virutas, tornillos, astillas o piezas que salten durante el ensamblaje.
- **Recomendación:** mantener los lentes **limpios y sin rayaduras** para asegurar visibilidad y protección.

---

### 2. Guantes de Protección

- **Objetivo:** proteger las manos de cortes, astillas o abrasiones.
- **Situación de uso:** al manipular **melaminas sin cubrecanto**, evitando contacto directo con bordes afilados o superficies rugosas.
- **Recomendación:** guantes resistentes adecuados al material que se manipula. Revisar que **no tengan agujeros ni desgaste** que comprometa la seguridad.

---

### 3. Calzado de Seguridad

- **Objetivo:** evitar lesiones en los pies por objetos que puedan caer o superficies punzantes.
- **Situación de uso:** **siempre que se está dentro de la empresa y áreas de trabajo**, garantizando protección continua.
- **Recomendación:** revisar que no estén dañados y que ajusten correctamente.

---

### 4. Protectores Auditivos

- **Objetivo:** proteger la audición frente a ruidos generados por herramientas y maquinaria.
- **Situación de uso:** durante el uso de **taladros, sierras o equipos eléctricos ruidosos**.
- **Recomendación:** tapones u orejeras según el nivel de ruido. Mantener limpios y en buen estado.

---

### 5. Faja de Seguridad

- **Objetivo:** proteger la espalda y prevenir lesiones lumbares durante el levantamiento de cargas.
- **Situación de uso:** al **descargar material pesado** (melaminas, componentes de gabinete).
- **Recomendación:** ajustar correctamente la faja al cuerpo. **Técnica correcta de levantamiento:** flexión de rodillas, espalda recta.

---

### 6. Mascarillas o Cubrebocas

- **Objetivo:** proteger las vías respiratorias de polvo, partículas o vapores generados durante el trabajo.
- **Situación de uso:** durante la **limpieza de polvo** y al usar **routers de banco** — donde se generan partículas finas.
- **Recomendación:**
  - Mascarillas desechables para tareas generales.
  - Respiradores con filtros para exposición prolongada o polvos muy finos.

---

### Cierre

Implementar el uso del EPP de manera constante y en las situaciones adecuadas **reduce riesgos, previene accidentes y fomenta una cultura de trabajo responsable**.
$md$,
   ARRAY['safety','epp','ppe','lentes','guantes','calzado','auditivo','faja','mascarilla'],
   8),

-- ============================================================================
-- workflow
-- ============================================================================
  ('workflow-5s',
   '5S — Clasificar, Ordenar, Limpiar, Estandarizar, Mantener',
   'Metodología japonesa de organización de planta aplicada al taller de gabinetes.',
   (SELECT id FROM wiki_categories WHERE slug = 'workflow'),
   $md$Las **5S** son una metodología japonesa enfocada en la **organización, limpieza y mejora continua** del área de trabajo. Su aplicación permite optimizar procesos, reducir desperdicios, garantizar seguridad y mantener un entorno productivo.

Cada principio — **Seiri (Clasificar), Seiton (Ordenar), Seiso (Limpiar), Seiketsu (Estandarizar) y Shitsuke (Mantener la Disciplina)** — aporta a un espacio de trabajo organizado, visualmente controlado y orientado a la calidad.

---

### 1. Clasificar (Seiri)

- Identificar y **separar** materiales, herramientas e insumos necesarios de los innecesarios dentro del área de trabajo.
- Retirar de manera inmediata todo elemento que no aporte al proceso o genere desorden.
- Establecer **puntos de almacenamiento temporal** para materiales que no se usan frecuentemente.
- Revisar periódicamente la lista de herramientas e insumos esenciales para actualizar los elementos clasificados como necesarios.

### 2. Ordenar (Seiton)

- Asignar un **lugar específico, identificado y señalizado** para cada herramienta, insumo y pieza.
- Organizar los materiales de manera que se facilite su acceso y flujo durante la fabricación.
- Utilizar **etiquetas, códigos de color, estantes o bandejas** para identificar claramente los espacios asignados.
- Asegurar que los caminos de trabajo y áreas de manipulación permanezcan **libres de obstáculos**.

### 3. Limpiar (Seiso)

- Mantener limpias **todas las superficies**, gabinetes, equipos y herramientas antes, durante y al final de la jornada.
- Eliminar polvo, residuos de corte, adhesivos, silicón u otros materiales que puedan afectar calidad o seguridad.
- Establecer **rutinas de limpieza diaria y semanal** (suelos, estanterías, superficies verticales).
- Inspeccionar visualmente las piezas durante la limpieza para detectar defectos o daños.

### 4. Estandarizar (Seiketsu)

- **Documentar procedimientos claros** de limpieza, orden y almacenamiento.
- Implementar **controles visuales**: letreros, marcas en el piso, colores codificados, señalizaciones de seguridad.
- Definir **responsabilidades** de cada miembro del equipo.
- Revisar periódicamente los procedimientos estandarizados y actualizarlos cuando se identifiquen mejoras.

### 5. Mantener la Disciplina (Shitsuke)

- Promover la **responsabilidad individual y colectiva** en la aplicación constante de las 5S.
- **Capacitar al personal** en la importancia de las 5S.
- Realizar **auditorías periódicas** para verificar el cumplimiento, registrando hallazgos y acciones correctivas.
- Fomentar la cultura de mejora continua mediante retroalimentación y reconocimiento de buenas prácticas.

### Ver también

- [[wiki:quality-jidoka|Jidoka]] — detención del proceso ante defectos.
- [[kb:glossary-5s|Glosario KB: 5S]].
$md$,
   ARRAY['workflow','5s','lean','organización','seiri','seiton','seiso','seiketsu','shitsuke'],
   8),

  ('workflow-manejo-proceso',
   'Manejo del proceso — antes, durante y después',
   'Protocolo de área de trabajo, herramientas y piezas en las tres fases del ensamble.',
   (SELECT id FROM wiki_categories WHERE slug = 'workflow'),
   $md$### Antes del Proceso

**Área de trabajo:**

- Verificar que el espacio esté **libre de polvo, residuos** y otros elementos.
- Mantener las superficies **lisas, niveladas y limpias** para evitar daños en las piezas.

**Herramientas e insumos:**

- Revisar que las herramientas estén **en buen estado y libres de grasa o suciedad**.
- Asegurar que los insumos (adhesivos, tornillería, herrajes) estén **organizados y completos**.

**Piezas del gabinete:**

- Retirar **polvo o excesos de pegamento** de cada pieza antes de iniciar el armado.

---

### Durante el Proceso

**Área de trabajo:**

- Mantener el espacio ordenado, **retirando continuamente desperdicios** (virutas, plásticos, empaques).
- Evitar acumulación de materiales que puedan entorpecer el ensamble.

**Herramientas:**

- Limpiar periódicamente la zona de contacto de herramientas eléctricas y manuales.
- Evitar el uso de herramientas con residuos que manchen o rayen el material.

**Piezas del gabinete:**

- Limpiar constantemente el gabinete si presenta **excedentes de adhesivos, silicón** u otros residuos.
- Manipular las piezas con cuidado — **evitar arrastrarlas o dejarlas caer** para prevenir daños.
- **No colocar herramientas, insumos o materiales sobre o dentro de los gabinetes** — previene rayaduras, manchas y deformaciones superficiales.

---

### Después del Proceso

**Área de trabajo:**

- Retirar todos los residuos de corte, empaques y sobrantes.
- Mantener limpia el área de producción — barrer y retirar residuos generados.

**Herramientas:**

- **Guardar limpias** y en su lugar asignado.
- Revisar y dar **mantenimiento preventivo** si es necesario.

**Gabinete terminado:**

- Retirar excedentes de silicón, adhesivos u otros materiales.
- Trasladar el gabinete al área designada para **almacenamiento y posterior empaque**.

---

### Ver también

- [[wiki:workflow-5s|5S — organización del área]].
- [[wiki:workflow-empaque-rta|Protocolo de empaque RTA]].
$md$,
   ARRAY['workflow','proceso','antes','durante','después','limpieza','manejo'],
   6),

  ('workflow-empaque-rta',
   'Protocolo de empaque RTA',
   'Procedimiento estándar de empaque Ready-to-Assemble: 16 boxes por pallet.',
   (SELECT id FROM wiki_categories WHERE slug = 'workflow'),
   $md$### Protocolo de empaque RTA

**Regla:** `16 boxes por pallet` — ver [[kb:production-rta|Sistema RTA]] en el KB.

**Pasos:**

1. Verificar que cada caja lleva **SKU y número de proyecto** marcados.
2. Colocar **esquineros de cartón** en las cuatro esquinas visibles.
3. Estibar en el pallet en patrón **4×4**.
4. **Flejar en cruz** (mínimo dos vueltas por eje).
5. **Etiquetar pallet** con destino + conteo total.

**Conectores incluidos en cada box** — ver [[kb:production-connectors|Conectores Estándar]]:

- **Minifix:** $27 por conexión.
- **Rafix:** $40 por conexión (premium, desmontable).

### Checklist de entrega

- [ ] 16 boxes contados.
- [ ] Esquineros en todas las cajas exteriores.
- [ ] Etiqueta de pallet legible.
- [ ] SKUs visibles sin retirar flejes.

> **Nota:** este artículo no proviene directamente del MANUAL PARTE 1.pdf (el manual cubre armado, no empaque); su contenido se mantiene del seed 2A. Si hay un manual de empaque separado, reemplazar.
$md$,
   ARRAY['workflow','rta','packaging','pallet','empaque'],
   4),

-- ============================================================================
-- training — materials reference
-- ============================================================================
  ('training-materiales-melamina',
   'Materiales — Melamina',
   'Tablero de aglomerado o MDF recubierto con papel melamínico.',
   (SELECT id FROM wiki_categories WHERE slug = 'training'),
   $md$### Melamina

**Descripción:** tablero de aglomerado o MDF recubierto con papel impregnado de resinas melánicas termo endurecibles. Superficie **dura, lisa y decorativa**, disponible en múltiples colores y texturas.

**Uso más común:**

- Fabricación de muebles modulares y gabinetes.
- Superficies decorativas interiores: puertas, repisas, frentes de cajón.

**Ventajas:**

- Variedad estética (colores, diseños, acabados).
- Resistencia moderada a rayones y manchas.
- Fácil limpieza y mantenimiento.

**Limitaciones:**

- **Bordes vulnerables** — requieren cubrecanto (ver [[wiki:quality-cubrecantos-por-pieza|reglas]]).

### Líneas de melamina Evita

- [[kb:finishes-plus|Evita Plus]] — proveedores [[supplier:barcocinas|Barcocinas]] y [[supplier:polanco|Polanco]]. Espesor 15mm. Formato 4×8.
- [[kb:finishes-premium|Evita Premium]] — proveedor [[supplier:arauco|Arauco]]. Espesores 15/18/28mm. Formato 4×8 y 6×8.
- [[kb:finishes-elite|Evita Elite]] — proveedor [[supplier:alvic|Alvic]]. Espesor 18mm. Formato 48×108".
$md$,
   ARRAY['training','materiales','melamina','mdf','aglomerado'],
   3),

  ('training-materiales-mdf-natural',
   'Materiales — MDF Natural',
   'Medium Density Fiberboard: tablero de fibras de madera prensadas.',
   (SELECT id FROM wiki_categories WHERE slug = 'training'),
   $md$### MDF Natural

**Descripción:** Medium Density Fiberboard — tablero elaborado con fibras de madera unidas con resinas sintéticas, prensadas a alta presión.

**Uso más común:** muebles y carpintería interior, **especialmente cuando requieren acabados pintados**.

**Ventajas:**

- Superficie **lisa**, ideal para pintura y acabados.
- Permite **cortes y mecanizados precisos**.

**Limitaciones:**

- **Sensible a la humedad** — puede hincharse si no está sellado.
- No recomendable para exteriores o ambientes húmedos.
$md$,
   ARRAY['training','materiales','mdf','pintura'],
   2),

  ('training-materiales-laminados-hpl',
   'Materiales — Laminados HPL (Fórmica)',
   'High Pressure Laminate para superficies de alta resistencia.',
   (SELECT id FROM wiki_categories WHERE slug = 'training'),
   $md$### Laminados (Fórmica / Formicas)

**Descripción técnica:** material decorativo de alta presión (**HPL**), compuesto por capas de papel impregnado en resinas fenólicas y melamínicas, prensadas a alta temperatura.

**Uso más común:** recubrimiento de superficies de muebles, gabinetes y **cubiertas** que requieren alta resistencia al desgaste y humedad.

**Ventajas:**

- **Resistente** a rayones, calor y humedad.
- Amplia variedad de colores y acabados.
- Fácil limpieza.

**Limitaciones:**

- Necesita una **base** (MDF o aglomerado).
- **Instalación requiere adhesivos y técnica adecuada**.

### Referencias

Línea [[kb:finishes-laminate|Evita Laminate]] en KB — proveedores [[supplier:greenlam|Greenlam]] y [[supplier:wilsonart|Wilsonart]].
$md$,
   ARRAY['training','materiales','hpl','laminado','formica','wilsonart','greenlam'],
   2),

  ('training-materiales-triplay',
   'Materiales — Triplay (Contrachapado)',
   'Tablero de chapas de madera prensadas — alta resistencia mecánica.',
   (SELECT id FROM wiki_categories WHERE slug = 'training'),
   $md$### Triplay (Contrachapado)

**Descripción técnica:** tablero compuesto por varias capas finas de madera (chapas) unidas con resinas y prensadas.

**Uso más común:**

- Estructuras de muebles, paneles, **bases y molduras**.
- Aplicaciones que requieren **mayor resistencia mecánica y estabilidad dimensional**.

**Ventajas:**

- **Alta resistencia y durabilidad**.
- Buena estabilidad frente a deformaciones.

**Limitaciones:**

- Sensible a la humedad si no está tratado.
- Superficie requiere **acabado adicional** si se busca estética.

### Regla relacionada

Para cálculo de Plywood Base D24", ver [[kb:rules-plywood-base-d24|Regla Plywood Base D24"]] en KB.
$md$,
   ARRAY['training','materiales','triplay','contrachapado','plywood'],
   2)
;

-- ============================================================================
-- Snapshot v1 of every seeded article into wiki_article_versions
-- ============================================================================
INSERT INTO wiki_article_versions (
  article_id, version_num, title, slug, summary, category_id, body_md, tags, edit_summary
)
SELECT
  a.id, 1, a.title, a.slug, a.summary, a.category_id, a.body_md, a.tags,
  'MANUAL PARTE 1.pdf ingest v1 (2026-04-18)'
FROM wiki_articles a
WHERE NOT EXISTS (
  SELECT 1 FROM wiki_article_versions v
  WHERE v.article_id = a.id AND v.version_num = 1
);

-- ============================================================================
-- Verification (run manually):
--   SELECT count(*) FROM wiki_articles;          -- expected ~21
--   SELECT count(*) FROM wiki_article_versions;  -- expected ~21
-- ============================================================================
