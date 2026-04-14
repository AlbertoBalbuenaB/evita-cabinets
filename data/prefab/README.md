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
- **FX = 17** (constante del proyecto). Se aplica en el cálculo al vuelo, no
  se persiste en el CSV.
- **Northville trae una columna `MXN Price`** en el xlsx original que se
  **ignora** a propósito — usamos el FX del proyecto, no el del proveedor.
- Al subir una lista nueva (2025, 2026...), agregar un archivo con nueva
  vigencia (`venus_2025_XX.csv`) y correr el importador. NO sobreescribir el
  histórico — las cotizaciones pasadas dependen del snapshot.

## Cómo regenerar estos CSV

Si Venus o Northville mandan una lista nueva en xlsx, usar el importador del
frontend (tab **Prefab Library → Import price list**) que parsea el xlsx
directamente. Estos CSV sólo son para el seed inicial.
