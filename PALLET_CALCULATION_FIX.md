# Corrección del Cálculo de Pallets para 460-Accesories

## Fecha de Implementación
2025-11-18

## Problema Identificado

El cálculo de pallets para productos 460-Accesories (paneles accesorios) estaba usando pies cuadrados que incluían el porcentaje de desperdicio de material (Material Waste Percentage). Esto causaba que los cálculos de cajas y pallets fueran inflados incorrectamente.

### Ejemplo del Problema

Para el producto **460-12x12**:
- **Valor Original (sin waste)**: 1.00 ft²
- **Valor con Waste aplicado**: 1.60 ft² (60% de incremento)

Si un proyecto tenía 10 unidades de este accesorio:
- **Cálculo Incorrecto (ANTES)**: 1.60 × 10 = 16 ft² → 1 box (16/32)
- **Cálculo Correcto (AHORA)**: 1.00 × 10 = 10 ft² → 1 box (10/32)

El porcentaje de waste es para fabricación (cortes, desperdicios del proceso), no para el volumen físico del producto terminado que se va a empacar y enviar.

---

## Solución Implementada

### 1. Actualización de Tipos de Datos

**Archivo**: `/src/lib/database.types.ts`

Se agregaron los campos de valores originales al tipo `Product`:

```typescript
products_catalog: {
  Row: {
    // ... campos existentes
    original_box_sf: number | null;
    original_doors_fronts_sf: number | null;
    waste_applied: boolean | null;
  };
}
```

### 2. Modificación de Función de Cálculo de Boxes

**Archivo**: `/src/lib/boxesAndPallets.ts`

**Función**: `calculateBoxesForCabinet()`

**ANTES**:
```typescript
if (isAccessoryPanel(sku)) {
  const boxSF = product.box_sf || 0;
  const doorsSF = product.doors_fronts_sf || 0;
  const totalSqFt = (boxSF + doorsSF) * quantity;
  return Math.ceil(totalSqFt / 32);
}
```

**AHORA**:
```typescript
if (isAccessoryPanel(sku)) {
  const boxSF = product.original_box_sf ?? product.box_sf ?? 0;
  const doorsSF = product.original_doors_fronts_sf ?? product.doors_fronts_sf ?? 0;
  const totalSqFt = (boxSF + doorsSF) * quantity;
  return Math.ceil(totalSqFt / 32);
}
```

**Cambio Clave**: Usa `original_box_sf` y `original_doors_fronts_sf` (valores sin waste) con fallback a los valores con waste si los originales no existen.

### 3. Modificación de Función de Square Footage de Accesorios

**Archivo**: `/src/lib/boxesAndPallets.ts`

**Función**: `calculateAccessoriesSqFt()`

**ANTES**:
```typescript
if (isAccessoryPanel(sku)) {
  const boxSF = product.box_sf || 0;
  const doorsSF = product.doors_fronts_sf || 0;
  return (boxSF + doorsSF) * cabinet.quantity;
}
```

**AHORA**:
```typescript
if (isAccessoryPanel(sku)) {
  const boxSF = product.original_box_sf ?? product.box_sf ?? 0;
  const doorsSF = product.original_doors_fronts_sf ?? product.doors_fronts_sf ?? 0;
  return (boxSF + doorsSF) * cabinet.quantity;
}
```

**Cambio Clave**: Consistencia en el reporte de pies cuadrados, mostrando valores sin waste.

---

## Compatibilidad con Datos Existentes

### Estrategia de Fallback

El código implementa una estrategia de **nullish coalescing** (`??`):

```typescript
const boxSF = product.original_box_sf ?? product.box_sf ?? 0;
```

Esto significa:
1. **Intenta usar** `original_box_sf` (valor sin waste)
2. **Si es null/undefined**, usa `box_sf` (valor con waste)
3. **Si ambos son null/undefined**, usa `0`

### Base de Datos Verificada

Se confirmó que todos los productos en la base de datos tienen valores originales:

```sql
SELECT
  COUNT(*) as total_products,                    -- 483
  COUNT(original_box_sf) as with_original,       -- 483
  COUNT(CASE WHEN waste_applied THEN 1 END)      -- 483
FROM products_catalog;
```

**Resultado**: ✅ 483/483 productos tienen valores originales correctamente poblados.

---

## Impacto en el Sistema

### Qué CAMBIA

1. **Cálculo de Boxes para 460-Accesories**
   - Ahora usa valores sin waste
   - Resultará en menos boxes calculados (más preciso)

2. **Cálculo de Pallets para 460-Accesories**
   - Ahora usa valores sin waste
   - Resultará en menos pallets calculados (más preciso)

3. **Reporte de "Acc. ft²"**
   - Ahora muestra valores sin waste
   - Refleja el área real del producto físico

### Qué NO CAMBIA

1. **Cálculo de boxes/pallets para productos regulares (no 460)**
   - Continúa usando la lógica existente (por descripción o cantidad)

2. **Cálculo de costos de materiales**
   - Sigue usando valores con waste aplicado
   - Los costos de fabricación permanecen correctos

3. **Proyectos existentes**
   - Los valores guardados permanecen sin cambios
   - Los nuevos cálculos se aplicarán automáticamente al cargar proyectos

---

## Archivos Modificados

1. `/src/lib/database.types.ts` - Agregados tipos para campos originales
2. `/src/lib/boxesAndPallets.ts` - Modificadas funciones de cálculo

---

## Validación

### Build Exitoso
```bash
npm run build
✓ built in 8.35s
```

### Datos de Ejemplo (460-12x12)

| Campo | Valor Original | Valor con Waste | Diferencia |
|-------|---------------|-----------------|------------|
| doors_fronts_sf | 1.00 ft² | 1.60 ft² | +60% |

**Para 10 unidades**:
- ANTES: 16 ft² (sobre-calculado)
- AHORA: 10 ft² (correcto)

---

## Migración Automática

✅ No se requiere migración manual
- Los campos `original_box_sf` y `original_doors_fronts_sf` ya existen en la base de datos
- La migración `20251028032049_add_original_sf_columns.sql` ya fue aplicada
- Todos los productos tienen valores poblados correctamente

---

## Conclusión

Este fix asegura que el cálculo de boxes y pallets para accesorios (460-Accesories) sea preciso y basado en las dimensiones reales del producto físico, no en las dimensiones de fabricación que incluyen desperdicio de material. Esto resultará en estimaciones más precisas de envío y logística.

### Beneficios

1. **Precisión en Cotizaciones de Envío**: Los cálculos de pallets ahora reflejan el volumen real de productos
2. **Consistencia de Datos**: Separación clara entre valores de fabricación y valores de logística
3. **Retrocompatibilidad**: Funciona con datos existentes sin necesidad de migración
4. **Mantenibilidad**: Código más claro con lógica de fallback explícita
