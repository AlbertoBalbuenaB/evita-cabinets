# Prefab Price Lists

Listas de precios MSRP de proveedores de cabinets prefab que Evita revende.
Estos CSV son el **seed inicial** de las tablas `prefab_catalog` y
`prefab_catalog_price` en Supabase.

## Archivos

| Archivo | Marca | Vigencia | SKUs | Acabados | Filas |
|---|---|---|---|---|---|
| `venus_2024_09.csv` | Venus Cabinetry | Septiembre 2024 | 339 | 13 | 4,088 |
| `northville_2024_09.csv` | Northville Cabinetry | Septiembre 2024 | 311 | 9 | 2,329 |

## Esquema

```
code,finish,cost_usd,category
```

- `code` — SKU del proveedor (`B24`, `W3030`, `SB36`, `DB18-3`, `TK8`, etc.)
- `finish` — nombre exacto del acabado tal como lo publica el proveedor
- `cost_usd` — MSRP en dólares, costo al que Evita compra (sin markup)
- `category` — categoría funcional del proveedor (`BASE CABINETS`,
  `WALL CABINETS`, `SINK BASES`, etc.) — ya propagada en todas las filas del
  grupo (en el xlsx original sólo aparecía en la primera fila)

## Notas importantes

- **El markup NO está en estos CSV.** Se aplica a nivel proyecto vía el
  `profit_multiplier` en Additional Costs, igual que el resto de la cotización.
- **FX dinámico** desde `settingsStore.exchangeRateUsdToMxn` (default 18). Se
  aplica al vuelo y se snapshotea en `area_prefab_items.fx_rate` al crear la
  línea, no se persiste en el CSV.
- **Northville trae una columna `MXN Price`** en el xlsx original que se
  **ignora** a propósito — usamos el FX del proyecto, no el del proveedor.
- Al subir una lista nueva (2025, 2026...), agregar un archivo con nueva
  vigencia (`venus_2025_XX.csv`) y correr el importador. NO sobreescribir el
  histórico — las cotizaciones pasadas dependen del snapshot.

## Seed inicial

El script `scripts/seedPrefabLibrary.mjs` lee los dos CSV y puebla
`prefab_catalog` + `prefab_catalog_price` en Supabase. Es idempotente (usa
`ON CONFLICT DO UPDATE`), se puede correr varias veces sin duplicar filas.

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
node scripts/seedPrefabLibrary.mjs
```

Requiere:
- La migración `20260414000000_prefab_library_schema.sql` ya aplicada (crea
  las tablas y las 2 filas de `prefab_brand`).
- Service-role key (anon no basta — las RLS policies requieren
  `auth.uid() IS NOT NULL`; el service role las bypasea).
- Dependencias instaladas (`npm ci` — usa `@supabase/supabase-js`).

Salida esperada:
```
== Venus ==
  CSV: 339 unique SKUs
  catalog upserted: 339
  prices upserted:  4088
== Northville ==
  CSV: 311 unique SKUs
  catalog upserted: 311
  prices upserted:  2329

Done. Total SKUs: 650, total price rows: 6417.
```

## Cómo actualizar una lista de precios

Si Venus o Northville mandan una lista nueva en xlsx, usar el importador del
frontend (tab **Prefab Library → Import price list**) que parsea el xlsx
directamente. Estos CSV sólo son el seed inicial. El importador:

- Marca `is_current=false` los precios previos y agrega nuevos con
  `effective_date` = hoy (histórico preservado).
- Respeta `dims_locked=true` si el usuario editó las dimensiones de un SKU.
- Marca `is_active=false` los SKUs que ya no aparecen en la nueva lista
  (las cotizaciones históricas siguen viendo el snapshot en
  `area_prefab_items`).

## Known supplier data issues

El xlsx original de Venus (`venus_2024_09.csv`, rows ~2746-2754) contiene
**4 SKUs duplicados** en el acabado `Houston Trenton Fairy Green`, con dos
precios distintos registrados para la misma llave `(code, finish)`:

| Code    | Precio 1 USD | Precio 2 USD (usado) | Delta |
|---------|-------------:|---------------------:|------:|
| VDB2421 | 521 | **547** | +26 |
| VDB2721 | 534 | **554** | +20 |
| VDB3021 | 568 | **589** | +21 |
| VDB3621 | 633 | **656** | +23 |

El UNIQUE constraint `(prefab_catalog_id, finish, effective_date)` no permite
ambos valores, así que **el seed toma el precio MÁS ALTO** (defensiva de
margen — si Venus termina cobrándonos el precio bajo, ganamos; al revés
perdemos; además en bloques consecutivos así la fila más reciente suele ser
la corrección). El total resultante es 4,084 prices en lugar de los 4,088
listados en el xlsx crudo.

Si en un import futuro `prefabImport.ts` detecta el mismo patrón, loguea un
`console.warn` listando los duplicados para que Alberto pueda preguntarle a
Venus y limpiar la fuente.

