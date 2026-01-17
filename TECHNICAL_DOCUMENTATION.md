# Documentacion Tecnica Completa - Evita Cabinets Quotation System

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Modelo de Datos (Database Schema)](#2-modelo-de-datos-database-schema)
3. [Logica de Negocio - Calculos](#3-logica-de-negocio---calculos)
4. [Flujos de Usuario](#4-flujos-de-usuario)
5. [Componentes Principales](#5-componentes-principales)
6. [Funciones de Utilidad](#6-funciones-de-utilidad)
7. [Tipos e Interfaces](#7-tipos-e-interfaces)
8. [Limitaciones Conocidas y Consideraciones](#8-limitaciones-conocidas-y-consideraciones)

---

## 1. Arquitectura General

### 1.1 Stack Tecnologico

| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| React | 18.3.1 | Framework UI |
| TypeScript | 5.5.3 | Tipado estatico |
| Vite | 5.4.2 | Build tool y dev server |
| Supabase | 2.57.4 | Backend-as-a-Service (BaaS) |
| Tailwind CSS | 3.4.1 | Framework de estilos |
| Zustand | 5.0.8 | Estado global |
| Lucide React | 0.344.0 | Iconos |
| date-fns | 4.1.0 | Manipulacion de fechas |

### 1.2 Estructura de Carpetas

```
project/
├── public/                      # Archivos estaticos (logos, imagenes)
├── src/
│   ├── components/              # Componentes React reutilizables
│   │   ├── AreaMaterialBreakdown.tsx
│   │   ├── AutocompleteSelect.tsx
│   │   ├── BoxesPalletsBreakdown.tsx
│   │   ├── BulkMaterialChangeModal.tsx
│   │   ├── BulkPriceUpdateModal.tsx
│   │   ├── Button.tsx
│   │   ├── CabinetCard.tsx
│   │   ├── CabinetForm.tsx
│   │   ├── CountertopForm.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── FloatingActionBar.tsx
│   │   ├── Input.tsx
│   │   ├── ItemForm.tsx
│   │   ├── Layout.tsx
│   │   ├── MaterialBreakdown.tsx
│   │   ├── MaterialBreakdownByArea.tsx
│   │   ├── MaterialPriceUpdateModal.tsx
│   │   ├── Modal.tsx
│   │   ├── ProjectCharts.tsx
│   │   ├── SaveTemplateModal.tsx
│   │   └── TemplateSelectorModal.tsx
│   ├── lib/                     # Logica de negocio y utilidades
│   │   ├── boxesAndPallets.ts   # Calculo de cajas y pallets
│   │   ├── bulkHardwareChange.ts # Cambio masivo de hardware
│   │   ├── bulkMaterialChange.ts # Cambio masivo de materiales
│   │   ├── cabinetFilters.ts    # Filtros de gabinetes
│   │   ├── cabinetMaterialSummary.ts # Resumen de materiales
│   │   ├── calculations.ts      # Calculos de costos principales
│   │   ├── database.types.ts    # Tipos generados de Supabase
│   │   ├── edgebandRolls.ts     # Calculo de rollos de edgeband
│   │   ├── materialPriceUpdateSystem.ts # Sistema de actualizacion de precios
│   │   ├── priceUpdateSystem.ts # Sistema de precios obsoletos
│   │   ├── projectBrief.ts      # Generacion de resumen de proyecto
│   │   ├── settingsStore.ts     # Store de configuracion (Zustand)
│   │   ├── sheetMaterials.ts    # Calculo de hojas de material
│   │   ├── supabase.ts          # Cliente de Supabase
│   │   ├── templateManager.ts   # Gestion de plantillas
│   │   └── versioningSystem.ts  # Sistema de versionamiento
│   ├── pages/                   # Paginas principales
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── PriceList.tsx
│   │   ├── ProductsCatalog.tsx
│   │   ├── ProjectDetails.tsx
│   │   ├── Projects.tsx
│   │   ├── ProjectVersionHistory.tsx
│   │   ├── Settings.tsx
│   │   └── Templates.tsx
│   ├── types/                   # Definiciones de tipos TypeScript
│   │   └── index.ts
│   ├── utils/                   # Utilidades generales
│   │   ├── exportAreasCSV.ts    # Exportacion a CSV
│   │   ├── importCSV.ts         # Importacion desde CSV
│   │   ├── printQuotation.ts    # Generacion de PDF
│   │   └── seedData.ts          # Datos semilla
│   ├── App.tsx                  # Componente raiz
│   ├── index.css                # Estilos globales
│   ├── main.tsx                 # Entry point
│   └── vite-env.d.ts            # Tipos de Vite
├── supabase/
│   └── migrations/              # Migraciones SQL
└── package.json
```

### 1.3 Flujo de Datos entre Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                            App.tsx                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        Layout.tsx                             │   │
│  │  ┌───────────────────────────────────────────────────────┐   │   │
│  │  │                    Paginas                              │   │   │
│  │  │  ┌─────────┐  ┌──────────┐  ┌────────────────────┐   │   │   │
│  │  │  │Dashboard│  │ Projects │  │   ProjectDetails   │   │   │   │
│  │  │  └─────────┘  └──────────┘  │  ┌──────────────┐  │   │   │   │
│  │  │                              │  │ CabinetForm  │  │   │   │   │
│  │  │                              │  │ ItemForm     │  │   │   │   │
│  │  │                              │  │ CabinetCard  │  │   │   │   │
│  │  │                              │  └──────────────┘  │   │   │   │
│  │  │                              └────────────────────┘   │   │   │
│  │  └───────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Supabase                                    │
│  ┌─────────────┐  ┌───────────────┐  ┌─────────────────────────┐   │
│  │  projects   │  │ project_areas │  │     area_cabinets       │   │
│  │  price_list │  │  area_items   │  │   area_countertops      │   │
│  │  products   │  │   settings    │  │  cabinet_templates      │   │
│  └─────────────┘  └───────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.4 Sistema de Autenticacion

El sistema utiliza autenticacion simple basada en localStorage:

```typescript
// src/pages/Login.tsx
const VALID_USERNAME = 'EvitaCabinets';
const VALID_PASSWORD = 'Mw#7kQ2$xP9nL@5vR3wT';

// Verificacion
if (username === VALID_USERNAME && password === VALID_PASSWORD) {
  localStorage.setItem('isAuthenticated', 'true');
  onLogin();
}
```

---

## 2. Modelo de Datos (Database Schema)

### 2.1 Tabla: `projects`

**Proposito**: Almacena la informacion principal de cada proyecto de cotizacion.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `name` | varchar | Nombre del proyecto |
| `address` | text | Direccion del proyecto |
| `customer` | text | Nombre del cliente |
| `quote_date` | date | Fecha de la cotizacion |
| `total_amount` | numeric | Monto total calculado |
| `status` | varchar | Estado: Pending, Estimating, Lost, Awarded, Disqualified, Cancelled |
| `project_type` | text | Tipo: Custom, Bids, Prefab, Stores |
| `other_expenses` | numeric | Gastos adicionales |
| `install_delivery` | numeric | Costo de instalacion y entrega |
| `profit_multiplier` | numeric | Multiplicador de ganancia (ej: 0.5 = 50%) |
| `tariff_multiplier` | numeric | Multiplicador de tarifa (ej: 0.11 = 11%) |
| `tax_percentage` | numeric | Porcentaje de impuesto (ej: 8.25) |
| `project_details` | text | Notas y detalles del proyecto |
| `project_brief` | text | Resumen auto-generado del proyecto |
| `disclaimer_tariff_info` | text | Disclaimer de tarifa para PDF |
| `disclaimer_price_validity` | text | Disclaimer de validez de precio para PDF |
| `created_at` | timestamptz | Fecha de creacion |
| `updated_at` | timestamptz | Fecha de ultima actualizacion |

**Relaciones**:
- `project_areas.project_id` -> `projects.id`
- `project_versions.project_id` -> `projects.id`
- `project_price_staleness.project_id` -> `projects.id`

**Politicas RLS**: Permitir todas las operaciones para usuarios autenticados.

---

### 2.2 Tabla: `project_areas`

**Proposito**: Representa las areas dentro de un proyecto (Kitchen, Bedroom, etc.)

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `project_id` | uuid | FK a projects |
| `name` | varchar | Nombre del area |
| `display_order` | integer | Orden de visualizacion |
| `subtotal` | numeric | Subtotal del area |
| `created_at` | timestamptz | Fecha de creacion |
| `updated_at` | timestamptz | Fecha de actualizacion |

**Relaciones**:
- `project_areas.project_id` -> `projects.id`
- `area_cabinets.area_id` -> `project_areas.id`
- `area_items.area_id` -> `project_areas.id`
- `area_countertops.area_id` -> `project_areas.id`

---

### 2.3 Tabla: `area_cabinets`

**Proposito**: Almacena los gabinetes asignados a cada area con todos sus materiales y costos.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `area_id` | uuid | FK a project_areas |
| `product_sku` | varchar | SKU del producto (FK a products_catalog) |
| `quantity` | integer | Cantidad de gabinetes |
| `is_rta` | boolean | Es Ready-To-Assemble |
| **Materiales Box** | | |
| `box_material_id` | uuid | FK a price_list (material del box) |
| `box_edgeband_id` | uuid | FK a price_list (edgeband del box) |
| `box_interior_finish_id` | uuid | FK a price_list (acabado interior box) |
| **Materiales Doors** | | |
| `doors_material_id` | uuid | FK a price_list (material puertas) |
| `doors_edgeband_id` | uuid | FK a price_list (edgeband puertas) |
| `doors_interior_finish_id` | uuid | FK a price_list (acabado interior puertas) |
| **Back Panel** | | |
| `use_back_panel_material` | boolean | Usar material especial para panel trasero |
| `back_panel_material_id` | uuid | FK a price_list |
| `back_panel_width_inches` | numeric | Ancho del panel en pulgadas |
| `back_panel_height_inches` | numeric | Alto del panel en pulgadas |
| `back_panel_sf` | numeric | Pies cuadrados del panel |
| **Costos Calculados** | | |
| `box_material_cost` | numeric | Costo del material del box |
| `box_edgeband_cost` | numeric | Costo del edgeband del box |
| `box_interior_finish_cost` | numeric | Costo del acabado interior box |
| `doors_material_cost` | numeric | Costo del material de puertas |
| `doors_edgeband_cost` | numeric | Costo del edgeband de puertas |
| `doors_interior_finish_cost` | numeric | Costo del acabado interior puertas |
| `back_panel_material_cost` | numeric | Costo del panel trasero |
| `hardware_cost` | numeric | Costo total del hardware |
| `accessories_cost` | numeric | Costo total de accesorios |
| `labor_cost` | numeric | Costo de mano de obra |
| `subtotal` | numeric | Subtotal del gabinete |
| **Hardware y Accesorios** | | |
| `hardware` | jsonb | Array: [{hardware_id, quantity_per_cabinet}] |
| `accessories` | jsonb | Array: [{accessory_id, quantity_per_cabinet}] |
| **Precios Originales** | | |
| `original_box_material_price` | numeric | Precio unitario al momento de crear |
| `original_box_edgeband_price` | numeric | Precio unitario al crear |
| `original_doors_material_price` | numeric | Precio unitario al crear |
| `original_doors_edgeband_price` | numeric | Precio unitario al crear |
| `created_at` | timestamptz | Fecha de creacion |

---

### 2.4 Tabla: `area_items`

**Proposito**: Items individuales agregados a un area (no son gabinetes).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `area_id` | uuid | FK a project_areas |
| `price_list_item_id` | uuid | FK a price_list |
| `item_name` | text | Nombre del item |
| `quantity` | numeric | Cantidad |
| `unit_price` | numeric | Precio unitario |
| `subtotal` | numeric | Subtotal calculado |
| `notes` | text | Notas adicionales |
| `created_at` | timestamptz | Fecha de creacion |
| `updated_at` | timestamptz | Fecha de actualizacion |

---

### 2.5 Tabla: `area_countertops`

**Proposito**: Countertops (mesones/encimeras) agregados a un area.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `area_id` | uuid | FK a project_areas |
| `price_list_item_id` | uuid | FK a price_list |
| `item_name` | text | Nombre del countertop |
| `quantity` | numeric | Cantidad |
| `unit_price` | numeric | Precio unitario |
| `subtotal` | numeric | Subtotal calculado |
| `notes` | text | Notas adicionales |
| `created_at` | timestamptz | Fecha de creacion |
| `updated_at` | timestamptz | Fecha de actualizacion |

---

### 2.6 Tabla: `products_catalog`

**Proposito**: Catalogo de productos (gabinetes) con sus especificaciones de material.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `sku` | varchar | Codigo SKU unico |
| `description` | text | Descripcion del producto |
| `box_sf` | numeric | Pies cuadrados del box |
| `doors_fronts_sf` | numeric | Pies cuadrados de puertas/frentes |
| `box_edgeband` | numeric | Metros de edgeband del box |
| `box_edgeband_color` | numeric | Metros de edgeband de color |
| `doors_fronts_edgeband` | numeric | Metros de edgeband de puertas |
| `total_edgeband` | numeric | Total de metros de edgeband |
| `has_drawers` | boolean | Tiene cajones |
| `is_active` | boolean | Esta activo |
| `original_box_sf` | numeric | SF original del box |
| `original_doors_fronts_sf` | numeric | SF original de puertas |
| `waste_applied` | boolean | Se aplico desperdicio |
| `created_at` | timestamptz | Fecha de creacion |
| `updated_at` | timestamptz | Fecha de actualizacion |

---

### 2.7 Tabla: `price_list`

**Proposito**: Lista de precios de todos los materiales, hardware y accesorios.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `sku_code` | varchar | Codigo SKU del material |
| `concept_description` | text | Descripcion del material |
| `type` | varchar | Tipo: Melamine, Edgeband, Hardware, etc. |
| `material` | varchar | Material especifico |
| `dimensions` | varchar | Dimensiones (ej: "4x8") |
| `unit` | varchar | Unidad de medida |
| `sf_per_sheet` | numeric | Pies cuadrados por hoja |
| `price` | numeric | Precio base |
| `tax_rate` | numeric | Tasa de impuesto |
| `base_price` | numeric | Precio sin impuesto |
| `price_with_tax` | numeric | Precio con impuesto incluido |
| `is_active` | boolean | Esta activo |
| `created_at` | timestamptz | Fecha de creacion |
| `updated_at` | timestamptz | Fecha de actualizacion |

---

### 2.8 Tabla: `cabinet_templates`

**Proposito**: Plantillas de configuracion de gabinetes reutilizables.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `name` | varchar | Nombre de la plantilla (unico) |
| `description` | text | Descripcion |
| `category` | varchar | Categoria: Base Cabinets, Wall Cabinets, etc. |
| `product_sku` | varchar | FK a products_catalog |
| `product_description` | text | Descripcion del producto (denormalizado) |
| **Configuracion Box** | | |
| `box_material_id` | uuid | FK a price_list |
| `box_material_name` | text | Nombre del material (denormalizado) |
| `box_edgeband_id` | uuid | FK a price_list |
| `box_edgeband_name` | text | Nombre del edgeband |
| `box_interior_finish_id` | uuid | FK a price_list |
| `box_interior_finish_name` | text | Nombre del acabado |
| `use_box_interior_finish` | boolean | Usar acabado interior |
| **Configuracion Doors** | | |
| `doors_material_id` | uuid | FK a price_list |
| `doors_material_name` | text | Nombre del material |
| `doors_edgeband_id` | uuid | FK a price_list |
| `doors_edgeband_name` | text | Nombre del edgeband |
| `doors_interior_finish_id` | uuid | FK a price_list |
| `doors_interior_finish_name` | text | Nombre del acabado |
| `use_doors_interior_finish` | boolean | Usar acabado interior |
| **Otros** | | |
| `hardware` | jsonb | Configuracion de hardware |
| `accessories` | jsonb | Configuracion de accesorios |
| `is_rta` | boolean | Es RTA |
| `usage_count` | integer | Veces usado |
| `last_used_at` | timestamptz | Ultima vez usado |
| `created_at` | timestamptz | Fecha de creacion |
| `updated_at` | timestamptz | Fecha de actualizacion |

---

### 2.9 Tabla: `project_versions`

**Proposito**: Historial de versiones de proyectos (snapshots).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `project_id` | uuid | FK a projects |
| `version_number` | integer | Numero de version |
| `version_name` | text | Nombre descriptivo |
| `version_type` | text | Tipo: price_update, material_change, manual_snapshot |
| `snapshot_data` | jsonb | Datos completos del snapshot |
| `total_amount` | numeric | Monto total al crear version |
| `change_summary` | jsonb | Resumen de cambios |
| `notes` | text | Notas |
| `affected_areas` | text[] | Array de areas afectadas |
| `created_at` | timestamptz | Fecha de creacion |

---

### 2.10 Tabla: `settings`

**Proposito**: Configuraciones del sistema.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | Identificador unico (PK) |
| `key` | text | Clave de configuracion (unica) |
| `value` | text | Valor |
| `description` | text | Descripcion |
| `data_type` | text | Tipo de dato: number, string, boolean |
| `category` | text | Categoria |
| `exchange_rate_usd_to_mxn` | numeric | Tasa de cambio USD a MXN |
| `logo_url` | text | URL del logo |
| `created_at` | timestamptz | Fecha de creacion |
| `updated_at` | timestamptz | Fecha de actualizacion |

---

## 3. Logica de Negocio - Calculos

### 3.1 Calculo de Costo de un Gabinete

El costo total de un gabinete se calcula sumando los siguientes componentes:

```
Subtotal = Box Material Cost
         + Box Edgeband Cost
         + Box Interior Finish Cost
         + Doors Material Cost
         + Doors Edgeband Cost
         + Doors Interior Finish Cost
         + Back Panel Material Cost
         + Hardware Cost
         + Accessories Cost
         + Labor Cost
```

### 3.2 Formulas para Square Feet

#### Box Material Cost
```typescript
// src/lib/calculations.ts
export function calculateBoxMaterialCost(
  product: Product,
  material: PriceListItem,
  quantity: number
): number {
  const sfNeeded = product.box_sf * quantity;
  const pricePerSF = material.price_with_tax || material.price;
  return sfNeeded * pricePerSF;
}
```

**Formula**: `Costo = (product.box_sf * quantity) * material.price_with_tax`

#### Doors Material Cost
```typescript
export function calculateDoorsMaterialCost(
  product: Product,
  material: PriceListItem,
  quantity: number
): number {
  const sfNeeded = product.doors_fronts_sf * quantity;
  const pricePerSF = material.price_with_tax || material.price;
  return sfNeeded * pricePerSF;
}
```

**Formula**: `Costo = (product.doors_fronts_sf * quantity) * material.price_with_tax`

### 3.3 Calculo de Edgeband

#### Box Edgeband Cost
```typescript
export function calculateBoxEdgebandCost(
  product: Product,
  edgeband: PriceListItem,
  quantity: number
): number {
  const metersNeeded = product.box_edgeband * quantity;
  const pricePerMeter = edgeband.price_with_tax || edgeband.price;
  return metersNeeded * pricePerMeter;
}
```

**Formula**: `Costo = (product.box_edgeband * quantity) * edgeband.price_with_tax`

#### Sistema de Rollos de Edgeband

El edgeband se vende en rollos de **150 metros**. El sistema agrupa todo el edgeband del mismo tipo en un area y calcula cuantos rollos completos se necesitan:

```typescript
// src/lib/edgebandRolls.ts
const ROLL_LENGTH_METERS = 150;

const rollsNeeded = Math.ceil(totalMeters / ROLL_LENGTH_METERS);
const totalCost = rollsNeeded * ROLL_LENGTH_METERS * pricePerMeter;
const costPerMeter = totalCost / totalMeters;
```

**Logica**:
1. Sumar todos los metros de edgeband del mismo tipo en el area
2. Calcular rollos necesarios: `ceil(totalMeters / 150)`
3. Calcular costo total: `rollos * 150 * precioMetro`
4. Distribuir costo proporcionalmente a cada gabinete

### 3.4 Calculo de Sheet Materials

Similar al edgeband, los materiales en hojas se calculan por hojas completas:

```typescript
// src/lib/sheetMaterials.ts
const sheetsNeeded = Math.ceil(totalSF / sfPerSheet);
const totalCost = sheetsNeeded * pricePerSheet;
const costPerSF = totalCost / totalSF;
```

### 3.5 Calculo de Interior Finish

```typescript
export function calculateInteriorFinishCost(
  product: Product,
  finish: PriceListItem,
  quantity: number,
  isBox: boolean
): number {
  const sfNeeded = isBox ? product.box_sf : product.doors_fronts_sf;
  const totalSF = sfNeeded * quantity;
  const pricePerSF = finish.price_with_tax || finish.price;
  return totalSF * pricePerSF;
}
```

### 3.6 Calculo de Back Panel

```typescript
// Calculo de SF del back panel
const widthFeet = widthInches / 12;
const heightFeet = heightInches / 12;
const backPanelSF = widthFeet * heightFeet * quantity;

// Costo
const backPanelCost = backPanelSF * material.price_with_tax;
```

### 3.7 Calculo de Hardware

```typescript
export function calculateHardwareCost(
  hardware: HardwareItem[],
  cabinetQuantity: number,
  priceList: PriceListItem[]
): number {
  let totalCost = 0;

  for (const hw of hardware) {
    const item = priceList.find(p => p.id === hw.hardware_id);
    if (item) {
      const unitPrice = item.price_with_tax || item.price;
      const totalQuantity = hw.quantity_per_cabinet * cabinetQuantity;
      totalCost += unitPrice * totalQuantity;
    }
  }

  return totalCost;
}
```

**Formula**: `Costo = SUM(hardware_price * quantity_per_cabinet * cabinet_quantity)`

### 3.8 Calculo de Labor Cost

```typescript
export function calculateLaborCost(
  product: Product,
  quantity: number,
  laborCostNoDrawers: number,
  laborCostWithDrawers: number,
  laborCostAccessories: number
): number {
  const sku = product.sku;

  // Paneles de accesorio
  if (isAccessoryPanel(sku)) {
    return laborCostAccessories * quantity;
  }

  // Gabinetes con o sin cajones
  if (product.has_drawers) {
    return laborCostWithDrawers * quantity;
  }

  return laborCostNoDrawers * quantity;
}
```

### 3.9 Multiplicadores del Proyecto

El total del proyecto se calcula aplicando multiplicadores:

```typescript
// src/pages/ProjectDetails.tsx

// 1. Subtotal de materiales
const materialsSubtotal = cabinetsSubtotal + itemsSubtotal + countertopsSubtotal;

// 2. Aplicar profit (margen de ganancia)
// Formula: price = subtotal / (1 - profit_multiplier)
// Ejemplo: si profit_multiplier = 0.5 (50%), price = subtotal / 0.5 = subtotal * 2
const price = profitMultiplier > 0 && profitMultiplier < 1
  ? materialsSubtotal / (1 - profitMultiplier)
  : materialsSubtotal;
const profitAmount = price - materialsSubtotal;

// 3. Aplicar tariff
const tariffAmount = price * tariffMultiplier;

// 4. Aplicar tax (sobre price + tariff)
const taxAmount = (price + tariffAmount) * (taxPercentage / 100);

// 5. Total final
const projectTotal = price + tariffAmount + taxAmount + otherExpenses + installDelivery;
```

**Ejemplo de Calculo**:
```
Materials Subtotal: $10,000
Profit Multiplier: 0.50 (50%)
Tariff Multiplier: 0.11 (11%)
Tax Percentage: 8.25%
Other Expenses: $500
Install & Delivery: $1,000

Price = $10,000 / (1 - 0.50) = $20,000
Profit = $20,000 - $10,000 = $10,000
Tariff = $20,000 * 0.11 = $2,200
Tax = ($20,000 + $2,200) * 0.0825 = $1,831.50
Total = $20,000 + $2,200 + $1,831.50 + $500 + $1,000 = $25,531.50
```

### 3.10 Conversion de Moneda USD/MXN

```typescript
// Conversion simple
const amountInUSD = amountMXN / exchangeRate;

// Formateo
const formatUSD = (amount: number) => {
  const amountInUSD = amount / exchangeRate;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInUSD);
};
```

---

## 4. Flujos de Usuario

### 4.1 Creacion de un Nuevo Proyecto

```
1. Usuario navega a "Projects" page
2. Click en "Create Project"
3. Modal se abre con formulario:
   - Nombre del proyecto (requerido)
   - Direccion (opcional)
   - Cliente (opcional)
   - Tipo de proyecto (Custom, Bids, Prefab, Stores)
4. Usuario completa campos y click "Create"
5. Sistema:
   a. INSERT en tabla `projects`
   b. Genera `quote_date` automaticamente (fecha actual)
   c. Inicializa multiplicadores en 0
6. Usuario es redirigido a ProjectDetails
```

### 4.2 Agregar Areas y Gabinetes

```
1. En ProjectDetails, click "Add Area"
2. Modal con opciones:
   - Nombre personalizado
   - Presets: Kitchen, Bedroom, Bathroom, etc.
3. Click "Add Area" -> INSERT en `project_areas`

4. Dentro del area, click "Add Cabinet"
5. CabinetForm se abre:
   a. Seleccionar producto del catalogo
   b. Seleccionar materiales:
      - Box Material + Edgeband
      - Doors Material + Edgeband
      - Interior Finishes (opcionales)
      - Back Panel (opcional)
   c. Agregar hardware (hinges, slides, handles)
   d. Agregar accessories (opcional)
   e. Especificar cantidad
   f. RTA toggle

6. Click "Save Cabinet"
7. Sistema calcula todos los costos y INSERT en `area_cabinets`
8. Recalcula subtotal del area y total del proyecto
```

### 4.3 Aplicar una Plantilla (Template)

```
1. En CabinetForm, click "Load Template"
2. TemplateSelectorModal se abre:
   - Busqueda por nombre
   - Filtro por categoria
   - Ordenado por uso (mas usados primero)
3. Usuario selecciona plantilla
4. Sistema:
   a. Valida que materiales sigan activos
   b. Pre-llena todos los campos del formulario
   c. Muestra advertencias si hay materiales inactivos
5. Usuario puede ajustar valores y guardar
6. Al guardar, se registra uso en `template_usage_log`
```

### 4.4 Modificar Precios en Price List

```
1. Usuario navega a "Price List"
2. Busca material a modificar
3. Click en editar o doble-click en celda
4. Modifica precio
5. Click "Save"
6. Sistema:
   a. UPDATE en `price_list`
   b. Trigger registra cambio en `price_change_log`
   c. Marca proyectos afectados como "stale" en `project_price_staleness`

7. En ProjectDetails, aparece banner amarillo:
   "Price Updates Available"
8. Usuario click "Review & Update Prices"
9. MaterialPriceUpdateModal muestra:
   - Lista de materiales con cambios
   - Costos anteriores vs nuevos
   - Diferencia total
10. Usuario confirma actualizacion
11. Sistema:
    a. Recalcula todos los gabinetes afectados
    b. Crea version del proyecto (snapshot)
    c. Actualiza subtotales y totales
```

### 4.5 Generacion de PDF/CSV

#### PDF Estandar (MXN)
```
1. Click "Print" -> "Standard PDF"
2. Sistema:
   a. Obtiene logo de settings
   b. Calcula totales por area
   c. Calcula boxes y pallets
   d. Genera HTML con estilos
   e. Abre nueva ventana
   f. Ejecuta window.print()
```

#### PDF USD Summary
```
1. Click "Print" -> "USD Summary PDF"
2. Sistema:
   a. Convierte todos los montos a USD
   b. Aplica multiplicadores por area:
      - Price = subtotal / (1 - profit_multiplier)
      - Tariff = price * tariff_multiplier
      - Tax = (price + tariff) * tax_percentage
   c. Incluye disclaimers personalizados
   d. Genera y muestra PDF
```

#### CSV Export
```
1. Click "CSV" -> opcion
2. Areas Summary: nombre, boxes, SF, total por area
3. Detailed Report: todos los items con detalles
4. Sistema genera archivo y descarga
```

---

## 5. Componentes Principales

### 5.1 CabinetForm

**Ubicacion**: `src/components/CabinetForm.tsx`

**Props**:
```typescript
interface CabinetFormProps {
  areaId: string;
  cabinet?: AreaCabinet | null;
  onClose: () => void;
}
```

**Estado**:
- `selectedProduct`: Producto seleccionado del catalogo
- `boxMaterialId`, `boxEdgebandId`, etc.: IDs de materiales seleccionados
- `hardware`: Array de hardware con cantidades
- `accessories`: Array de accesorios
- `quantity`: Cantidad de gabinetes
- `isRTA`: Ready-To-Assemble flag
- `useBackPanelMaterial`: Flag para panel trasero custom

**Funciones Principales**:
- `handleSave()`: Calcula costos y guarda gabinete
- `handleLoadTemplate()`: Carga plantilla seleccionada
- `calculatePreviewCosts()`: Muestra preview de costos

**Interaccion con Supabase**:
- SELECT de `products_catalog`, `price_list`, `cabinet_templates`
- INSERT/UPDATE en `area_cabinets`
- INSERT en `template_usage_log` (si usa plantilla)

### 5.2 ProjectDetails

**Ubicacion**: `src/pages/ProjectDetails.tsx`

**Props**: Ninguno (obtiene projectId de URL params)

**Estado Principal**:
- `project`: Datos del proyecto actual
- `areas`: Array de areas con cabinets, items, countertops
- `products`: Catalogo de productos
- `priceList`: Lista de precios
- `exchangeRate`: Tasa de cambio
- Multiplicadores: `profitMultiplier`, `tariffMultiplier`, `taxPercentage`
- Modales: `isAreaModalOpen`, `selectedAreaForCabinet`, etc.

**Funciones Principales**:
- `loadAreas()`: Carga todas las areas con sus items
- `updateProjectTotal()`: Recalcula total del proyecto
- `handleSaveArea()`: Guarda/actualiza area
- `handleDeleteCabinet()`: Elimina gabinete y recalcula
- `handlePrint()`, `handlePrintUSD()`: Genera PDFs
- `saveAreasOrder()`: Guarda nuevo orden de areas (drag & drop)

### 5.3 CabinetCard

**Ubicacion**: `src/components/CabinetCard.tsx`

**Props**:
```typescript
interface CabinetCardProps {
  cabinet: AreaCabinet;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSaveAsTemplate: () => void;
  productDescription?: string;
  product?: Product;
  priceList: PriceListItem[];
}
```

**Funcionalidad**:
- Muestra resumen del gabinete
- Desglose de costos expandible
- Botones de accion: Edit, Delete, Duplicate, Save as Template
- Badge RTA
- Muestra hardware y accesorios

### 5.4 ItemForm

**Ubicacion**: `src/components/ItemForm.tsx`

**Props**:
```typescript
interface ItemFormProps {
  areaId: string;
  item?: AreaItem | null;
  onClose: () => void;
}
```

**Estado**:
- `selectedItem`: Item seleccionado de price_list
- `quantity`: Cantidad
- `notes`: Notas adicionales

**Funciones**:
- `handleSave()`: Calcula subtotal y guarda item
- Busqueda/filtrado de items del price_list

---

## 6. Funciones de Utilidad

### 6.1 calculations.ts

#### `formatCurrency(amount: number): string`
Formatea un numero como moneda MXN.
```typescript
formatCurrency(1234.56) // "$1,234.56"
```

#### `parseDimensions(dimensions: string): number`
Convierte string de dimensiones a SF.
```typescript
parseDimensions("4x8") // 32 (4 * 8 = 32 SF)
```

#### `calculateBoxMaterialCost(product, material, quantity): number`
Calcula costo del material del box.
- **Entrada**: product (Product), material (PriceListItem), quantity (number)
- **Salida**: Costo en MXN

#### `calculateBoxEdgebandCost(product, edgeband, quantity): number`
Calcula costo del edgeband del box.

#### `calculateDoorsMaterialCost(product, material, quantity): number`
Calcula costo del material de puertas.

#### `calculateDoorsEdgebandCost(product, edgeband, quantity): number`
Calcula costo del edgeband de puertas.

#### `calculateInteriorFinishCost(product, finish, quantity, isBox): number`
Calcula costo del acabado interior.
- **isBox**: true para box, false para doors

#### `calculateHardwareCost(hardware, quantity, priceList): number`
Calcula costo total del hardware.
- **hardware**: Array de {hardware_id, quantity_per_cabinet}

#### `calculateAccessoriesCost(accessories, quantity, priceList): number`
Calcula costo total de accesorios.

#### `calculateLaborCost(product, quantity, noDrawers, withDrawers, accessories): number`
Calcula costo de mano de obra.

### 6.2 boxesAndPallets.ts

#### `calculateBoxesForCabinet(cabinet, product): number`
Calcula numero de cajas para un gabinete.
- Gabinetes altos/doble horno = 2 cajas
- Paneles de accesorio = SF / 32 cajas
- Normal = 1 caja por gabinete

#### `calculatePalletsForCabinet(cabinet, boxes): number`
Calcula pallets basado en cajas.
- RTA: boxes / 19
- No RTA: boxes / 5.8

#### `calculateAreaBoxesAndPallets(cabinets, products): BoxesPalletsCalculation`
Calcula totales para un area completa.
```typescript
interface BoxesPalletsCalculation {
  boxes: number;
  pallets: number;
  accessoriesSqFt: number;
}
```

### 6.3 edgebandRolls.ts

#### `calculateAreaEdgebandRolls(areaId): Promise<{edgebandUsages, cabinetCosts}>`
Calcula uso de edgeband por rollos completos.
- **Retorna**:
  - `edgebandUsages`: Array con totales por tipo de edgeband
  - `cabinetCosts`: Costos distribuidos por gabinete

#### `recalculateAreaEdgebandCosts(areaId): Promise<boolean>`
Recalcula y actualiza costos de edgeband en toda el area.

### 6.4 sheetMaterials.ts

#### `calculateAreaSheetMaterials(areaId): Promise<{sheetUsages, cabinetCosts}>`
Calcula uso de materiales en hojas completas.

#### `recalculateAreaSheetMaterialCosts(areaId): Promise<boolean>`
Recalcula y actualiza costos de sheet materials en toda el area.

### 6.5 templateManager.ts

#### `getAllTemplates(): Promise<CabinetTemplate[]>`
Obtiene todas las plantillas ordenadas por uso.

#### `createTemplateFromCabinet(cabinet, product, priceList, name, description, category): Promise<CabinetTemplate>`
Crea nueva plantilla desde un gabinete existente.

#### `validateTemplateAvailability(template, priceList, products): Promise<ValidationResult>`
Valida que materiales de plantilla sigan activos.
```typescript
interface ValidationResult {
  isValid: boolean;
  missingMaterials: string[];
  inactiveProduct: boolean;
}
```

#### `logTemplateUsage(templateId, projectId, areaId, cabinetId, quantity): Promise<void>`
Registra uso de plantilla.

### 6.6 versioningSystem.ts

#### `createProjectVersion(projectId, name, type, affectedAreas, notes): Promise<ProjectVersion>`
Crea snapshot/version del proyecto.

#### `recalculateAllCabinetPrices(projectId, areaIds, onProgress): Promise<UpdateResult>`
Recalcula todos los precios de gabinetes.
```typescript
interface UpdateResult {
  updated: number;
  errors: string[];
  areaChanges: Map<string, { previous: number; new: number }>;
}
```

#### `getVersionHistory(projectId): Promise<ProjectVersion[]>`
Obtiene historial de versiones.

#### `compareVersions(versionAId, versionBId, projectId): Promise<ComparisonResult>`
Compara dos versiones del proyecto.

### 6.7 priceUpdateSystem.ts

#### `analyzeProjectPriceChanges(projectId): Promise<ProjectPriceAnalysis>`
Analiza diferencias de precios en un proyecto.
```typescript
interface ProjectPriceAnalysis {
  projectId: string;
  hasStalePrices: boolean;
  affectedAreas: AffectedArea[];
  totalPotentialDifference: number;
  affectedCabinetsCount: number;
  affectedMaterialsCount: number;
}
```

#### `updateCabinetPrices(cabinetIds, onProgress): Promise<UpdateResult>`
Actualiza precios de gabinetes especificos.

#### `checkProjectHasStalePrices(projectId): Promise<boolean>`
Verifica si proyecto tiene precios desactualizados.

### 6.8 printQuotation.ts

#### `printQuotation(project, areas, products): Promise<void>`
Genera PDF estandar en MXN.
- Muestra logo, direccion, fecha
- Desglose por areas con boxes, SF, total
- Total de pallets

#### `printQuotationUSD(project, areas, exchangeRate, products): Promise<void>`
Genera PDF resumido en USD con desglose de tariff/tax.
- Convierte todos los montos a USD
- Muestra Price, Tariff, Tax, Total por area
- Incluye disclaimers personalizables

### 6.9 exportAreasCSV.ts

#### `downloadAreasCSV(areas, projectName): void`
Descarga CSV con resumen de areas.
- Columnas: Area, Boxes, SF, Total

#### `downloadDetailedAreasCSV(areas, projectName): void`
Descarga CSV detallado con todos los items.
- Incluye gabinetes, items, countertops

---

## 7. Tipos e Interfaces

### 7.1 Project
```typescript
interface Project {
  id: string;
  name: string;
  address: string | null;
  customer: string | null;
  quote_date: string;
  total_amount: number;
  status: 'Pending' | 'Estimating' | 'Lost' | 'Awarded' | 'Disqualified' | 'Cancelled';
  project_type: 'Custom' | 'Bids' | 'Prefab' | 'Stores';
  other_expenses: number;
  install_delivery: number;
  profit_multiplier: number;
  tariff_multiplier: number;
  tax_percentage: number;
  project_details: string | null;
  project_brief: string | null;
  disclaimer_tariff_info: string | null;
  disclaimer_price_validity: string | null;
  created_at: string;
  updated_at: string;
}
```

### 7.2 ProjectArea
```typescript
interface ProjectArea {
  id: string;
  project_id: string;
  name: string;
  display_order: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}
```

### 7.3 AreaCabinet
```typescript
interface AreaCabinet {
  id: string;
  area_id: string;
  product_sku: string | null;
  quantity: number;
  is_rta: boolean;
  // Materiales
  box_material_id: string | null;
  box_edgeband_id: string | null;
  box_interior_finish_id: string | null;
  doors_material_id: string | null;
  doors_edgeband_id: string | null;
  doors_interior_finish_id: string | null;
  // Back Panel
  use_back_panel_material: boolean;
  back_panel_material_id: string | null;
  back_panel_width_inches: number | null;
  back_panel_height_inches: number | null;
  back_panel_sf: number;
  // Costos
  box_material_cost: number;
  box_edgeband_cost: number;
  box_interior_finish_cost: number;
  doors_material_cost: number;
  doors_edgeband_cost: number;
  doors_interior_finish_cost: number;
  back_panel_material_cost: number;
  hardware_cost: number;
  accessories_cost: number;
  labor_cost: number;
  subtotal: number;
  // Hardware & Accessories
  hardware: HardwareItem[];
  accessories: AccessoryItem[];
  // Precios originales
  original_box_material_price: number | null;
  original_box_edgeband_price: number | null;
  original_box_interior_finish_price: number | null;
  original_doors_material_price: number | null;
  original_doors_edgeband_price: number | null;
  original_doors_interior_finish_price: number | null;
  original_back_panel_material_price: number | null;
  created_at: string;
}
```

### 7.4 Product
```typescript
interface Product {
  id: string;
  sku: string;
  description: string;
  box_sf: number;
  doors_fronts_sf: number;
  box_edgeband: number;
  box_edgeband_color: number;
  doors_fronts_edgeband: number;
  total_edgeband: number;
  has_drawers: boolean;
  is_active: boolean;
  original_box_sf: number | null;
  original_doors_fronts_sf: number | null;
  waste_applied: boolean;
  created_at: string;
  updated_at: string;
}
```

### 7.5 PriceListItem
```typescript
interface PriceListItem {
  id: string;
  sku_code: string | null;
  concept_description: string;
  type: string;
  material: string | null;
  dimensions: string | null;
  unit: string;
  sf_per_sheet: number | null;
  price: number;
  tax_rate: number;
  base_price: number | null;
  price_with_tax: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### 7.6 CabinetTemplate
```typescript
interface CabinetTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  product_sku: string | null;
  product_description: string | null;
  // Box config
  box_material_id: string | null;
  box_material_name: string | null;
  box_edgeband_id: string | null;
  box_edgeband_name: string | null;
  box_interior_finish_id: string | null;
  box_interior_finish_name: string | null;
  use_box_interior_finish: boolean;
  // Doors config
  doors_material_id: string | null;
  doors_material_name: string | null;
  doors_edgeband_id: string | null;
  doors_edgeband_name: string | null;
  doors_interior_finish_id: string | null;
  doors_interior_finish_name: string | null;
  use_doors_interior_finish: boolean;
  // Back panel
  use_back_panel_material: boolean;
  back_panel_material_id: string | null;
  back_panel_material_name: string | null;
  back_panel_width_inches: number | null;
  back_panel_height_inches: number | null;
  // Other
  hardware: HardwareItem[];
  accessories: AccessoryItem[];
  is_rta: boolean;
  usage_count: number;
  last_used_at: string | null;
  // Original prices
  original_box_material_price: number | null;
  original_box_edgeband_price: number | null;
  original_box_interior_finish_price: number | null;
  original_doors_material_price: number | null;
  original_doors_edgeband_price: number | null;
  original_doors_interior_finish_price: number | null;
  original_back_panel_material_price: number | null;
  created_at: string;
  updated_at: string;
}
```

### 7.7 HardwareItem & AccessoryItem
```typescript
interface HardwareItem {
  hardware_id: string;
  quantity_per_cabinet: number;
}

interface AccessoryItem {
  accessory_id: string;
  quantity_per_cabinet: number;
}
```

### 7.8 AreaItem
```typescript
interface AreaItem {
  id: string;
  area_id: string;
  price_list_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### 7.9 AreaCountertop
```typescript
interface AreaCountertop {
  id: string;
  area_id: string;
  price_list_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## 8. Limitaciones Conocidas y Consideraciones

### 8.1 Edge Cases en Calculos

1. **Division por cero**: Cuando `totalMeters = 0` o `totalSF = 0`, el sistema puede producir `NaN`. Se manejan con validaciones.

2. **Profit Multiplier**: Solo funciona correctamente cuando `0 < profit_multiplier < 1`. Valores fuera de este rango no se aplican.

3. **Materiales "Not Apply"**: Los materiales con descripcion que contiene "not apply" se excluyen de calculos de rollos/hojas.

4. **Precios negativos**: El sistema no valida precios negativos; se asume que todos los precios son >= 0.

5. **Redondeo**: Los calculos usan precision de punto flotante. Para totales finales, se redondea a 2 decimales.

### 8.2 Dependencias entre Datos

1. **Gabinetes requieren productos**: Un gabinete sin `product_sku` valido no puede calcular SF.

2. **Materiales requieren precio activo**: Si un material se desactiva, los gabinetes que lo usan pueden mostrar calculos incorrectos.

3. **Templates obsoletos**: Una plantilla puede referenciar materiales/productos que ya no existen o estan inactivos.

4. **Cascada de actualizaciones**: Al cambiar un precio:
   - Se marca proyecto como "stale"
   - Se debe recalcular manualmente
   - Se debe recalcular edgeband y sheet materials por area

5. **Orden de areas**: El `display_order` debe ser unico por proyecto.

### 8.3 Consideraciones de Performance

1. **N+1 Queries**: Al cargar areas con gabinetes, se hacen queries separadas por cada area. Para proyectos grandes, esto puede ser lento.

2. **Recalculo masivo**: Actualizar precios de muchos gabinetes es secuencial. Para proyectos con >100 gabinetes, puede tomar tiempo.

3. **Sheet Materials/Edgeband**: Los calculos de rollos/hojas requieren cargar todos los gabinetes del area. No es incremental.

4. **Snapshots de version**: El `snapshot_data` en JSON puede crecer significativamente para proyectos grandes.

5. **Price List grande**: Con miles de items, la busqueda en frontend puede ser lenta. Se recomienda paginacion.

### 8.4 Limitaciones de Autenticacion

1. **No multi-tenant**: El sistema no soporta multiples usuarios/empresas. Todos los datos son compartidos.

2. **Credenciales hardcodeadas**: Usuario y password estan en el codigo fuente.

3. **Sin session management**: Solo usa localStorage. No hay tokens, refresh, ni timeout.

### 8.5 Limitaciones de UI

1. **Sin modo offline**: Requiere conexion constante a Supabase.

2. **Sin deshacer (undo)**: Los cambios son inmediatos y permanentes.

3. **PDF en cliente**: La generacion de PDF usa `window.print()`, dependiendo del navegador.

4. **Drag & drop limitado**: Solo funciona para reordenar areas, no gabinetes.

### 8.6 Recomendaciones de Uso

1. **Backups regulares**: Exportar datos periodicamente via CSV.

2. **Monitorear precios obsoletos**: Revisar banner de "Price Updates" frecuentemente.

3. **Usar templates**: Para configuraciones repetidas, crear plantillas reduce errores.

4. **Versionamiento**: Antes de cambios masivos, crear version manual del proyecto.

5. **Validar materiales**: Antes de crear gabinetes, verificar que todos los materiales esten activos.

### 8.7 Configuraciones Importantes

| Setting | Valor Default | Descripcion |
|---------|---------------|-------------|
| `labor_cost_no_drawers` | Variable | Costo labor gabinete sin cajones |
| `labor_cost_with_drawers` | Variable | Costo labor gabinete con cajones |
| `labor_cost_accessories` | Variable | Costo labor paneles accesorio |
| `exchange_rate_usd_to_mxn` | Variable | Tasa de cambio actual |

---

## Apendice A: Diagrama ER

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   projects   │1───M│  project_areas   │1───M│  area_cabinets  │
└──────────────┘     └──────────────────┘     └─────────────────┘
       │                     │                        │
       │                     │1───M┌─────────────────┐│
       │                     └─────│   area_items    ││
       │                     │1───M┌─────────────────┘│
       │                     └─────│area_countertops │ │
       │                           └─────────────────┘ │
       │                                               │
       │1───M┌──────────────────┐                     M│
       └─────│ project_versions │                      │
             └──────────────────┘                      │
                                                       │
┌──────────────────┐                                   │
│ products_catalog │───────────────────────────────────┘
└──────────────────┘           (product_sku FK)
         │
         │                    ┌───────────────┐
         └────────────────────│  price_list   │
                              └───────────────┘
                                     │
                              ┌──────┴───────┐
                              │              │
                    ┌─────────────────┐ ┌──────────────────┐
                    │cabinet_templates│ │ price_change_log │
                    └─────────────────┘ └──────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │template_usage_log  │
                    └────────────────────┘
```

---

## Apendice B: Variables de Entorno

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

## Apendice C: Comandos Utiles

```bash
# Desarrollo
npm run dev

# Build de produccion
npm run build

# Verificar tipos
npm run typecheck

# Linting
npm run lint
```

---

**Documento generado**: Enero 2026
**Version de la aplicacion**: 0.0.0
**Ultima actualizacion**: 2026-01-17
