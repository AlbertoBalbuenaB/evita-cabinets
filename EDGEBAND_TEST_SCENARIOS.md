# Escenarios de Prueba - Sistema de Edgeband (Rolls de 150m)

## Resumen del Sistema

El sistema calcula automáticamente los rolls de edgeband de 150m necesarios por área, agrupando por finish y redistribuyendo costos proporcionalmente entre todos los cabinets.

---

## Escenario 1: Single Cabinet - Menos de 1 Roll

### Setup
- **Área:** Kitchen
- **Cabinet 1:**
  - SKU: 302-30"x30"x12"
  - Cantidad: 1
  - Box edgeband: 6.75m
  - Doors edgeband: 13.10m
  - Finish: "Edgeband Evita Laminate Matching Finish"
  - Precio: $8.30/m

### Cálculo Esperado

**Total de metros:**
```
6.75m (box) + 13.10m (doors) = 19.85m
```

**Rolls necesarios:**
```
Math.ceil(19.85 / 150) = 1 roll
```

**Costo total:**
```
1 roll × 150m × $8.30/m = $1,245.00
```

**Distribución de costo al cabinet:**
```
Costo por metro = $1,245.00 / 19.85m = $62.72/m

Box edgeband cost = 6.75m × $62.72/m = $423.36
Doors edgeband cost = 13.10m × $62.72/m = $821.64
Total cabinet = $1,245.00 ✓
```

### Material Breakdown Display
```
┌─ Edgeband (Rolls 150m) ──────────────────────┐
│ Edgeband Evita Laminate Matching Finish      │
│ # 1 roll  📏 19.9m / 150m  MX$1,245.00       │
└──────────────────────────────────────────────┘
```

---

## Escenario 2: Multiple Cabinets - Mismo Finish

### Setup
- **Área:** Kitchen
- **Cabinet 1:**
  - SKU: 302-30"x30"x12"
  - Cantidad: 3
  - Box: 6.75m, Doors: 13.10m = 19.85m × 3 = **59.55m**
  - Finish: "Edgeband Evita Laminate Matching Finish"

- **Cabinet 2:**
  - SKU: 302-42"x36"x12"
  - Cantidad: 5
  - Box: 4.50m, Doors: 10.00m = 14.50m × 5 = **72.50m**
  - Finish: "Edgeband Evita Laminate Matching Finish" (mismo)

### Cálculo Esperado

**Total de metros por finish:**
```
Cabinet 1: 59.55m
Cabinet 2: 72.50m
Total: 132.05m
```

**Rolls necesarios:**
```
Math.ceil(132.05 / 150) = 1 roll
```

**Costo total:**
```
1 roll × 150m × $8.30/m = $1,245.00
```

**Distribución de costo:**
```
Costo por metro = $1,245.00 / 132.05m = $9.43/m

Cabinet 1:
  Box: 20.25m × $9.43 = $191.00
  Doors: 39.30m × $9.43 = $370.60
  Total: $561.60

Cabinet 2:
  Box: 22.50m × $9.43 = $212.18
  Doors: 50.00m × $9.43 = $471.50
  Total: $683.68

Verificación: $561.60 + $683.68 = $1,245.28 ✓ (diferencia por redondeo)
```

### Material Breakdown Display
```
┌─ Edgeband (Rolls 150m) ──────────────────────┐
│ Edgeband Evita Laminate Matching Finish      │
│ # 1 roll  📏 132.1m / 150m  MX$1,245.00      │
└──────────────────────────────────────────────┘
```

---

## Escenario 3: Multiple Cabinets - Pasan 1 Roll

### Setup
- **Área:** Hall
- **Cabinet 1-5:** (mismo finish)
  - Total metros acumulados: **203.5m**
  - Finish: "Edgeband Evita Laminate Matching Finish"

### Cálculo Esperado

**Rolls necesarios:**
```
Math.ceil(203.5 / 150) = 2 rolls
```

**Costo total:**
```
2 rolls × 150m × $8.30/m = $2,490.00
```

**Distribución:**
```
Costo por metro = $2,490.00 / 203.5m = $12.24/m

Cada cabinet recibe su porción proporcional basada en sus metros
```

### Material Breakdown Display
```
┌─ Edgeband (Rolls 150m) ──────────────────────┐
│ Edgeband Evita Laminate Matching Finish      │
│ # 2 rolls  📏 203.5m / 300m  MX$2,490.00     │
└──────────────────────────────────────────────┘
```

**Nota:** Se compran 300m pero solo se usan 203.5m (desperdicio de 96.5m incluido en el costo)

---

## Escenario 4: Multiple Finishes - Diferentes Edgebands

### Setup
- **Área:** Kitchen
- **Cabinet 1-3:** (Finish A)
  - Total: 85m
  - Finish: "Edgeband Evita Laminate Matching Finish"

- **Cabinet 4-6:** (Finish B)
  - Total: 120m
  - Finish: "Edgeband Sisal Matching Finish"

### Cálculo Esperado

**Finish A:**
```
Rolls: Math.ceil(85 / 150) = 1 roll
Costo: 1 × 150m × $8.30 = $1,245.00
```

**Finish B:**
```
Rolls: Math.ceil(120 / 150) = 1 roll
Costo: 1 × 150m × $8.30 = $1,245.00
```

**Total del área:** $2,490.00

### Material Breakdown Display
```
┌─ Edgeband (Rolls 150m) ──────────────────────┐
│ Edgeband Evita Laminate Matching Finish      │
│ # 1 roll  📏 85.0m / 150m  MX$1,245.00       │
├──────────────────────────────────────────────┤
│ Edgeband Sisal Matching Finish               │
│ # 1 roll  📏 120.0m / 150m  MX$1,245.00      │
└──────────────────────────────────────────────┘
```

---

## Escenario 5: Cabinet con Box y Doors MISMO Finish

### Setup
- **Cabinet 1:**
  - Box edgeband: 5m (Finish: "Evita White")
  - Doors edgeband: 10m (Finish: "Evita White") <- MISMO

### Comportamiento Correcto

**El sistema debe:**
1. ✅ Sumar ambos: 5m + 10m = 15m
2. ✅ Mostrar UNA SOLA VEZ en breakdown
3. ✅ Distribuir costo en `box_edgeband_cost` y `doors_edgeband_cost` del cabinet

**NO debe:**
- ❌ Duplicar la entrada en el breakdown
- ❌ Contar 15m + 15m = 30m (error)

### Material Breakdown Display
```
┌─ Edgeband (Rolls 150m) ──────────────────────┐
│ Edgeband Evita White Matching Finish         │
│ # 1 roll  📏 15.0m / 150m  MX$1,245.00       │
└──────────────────────────────────────────────┘
```

---

## Escenario 6: Agregando Cabinet - Recalculación Automática

### Estado Inicial
- **Área:** Kitchen
- **Cabinets existentes:** 3 cabinets = 132m total
- **Rolls:** 1 roll (150m)
- **Costo:** $1,245.00

### Acción: Agregar Cabinet 4
- **Nuevo cabinet:** 80m
- **Nuevo total:** 132m + 80m = **212m**

### Resultado Esperado

**ANTES de guardar:**
```
Rolls: 1 roll
Total: 132m / 150m
Costo: $1,245.00
```

**DESPUÉS de guardar:**
```
Rolls: 2 rolls (Math.ceil(212 / 150) = 2)
Total: 212m / 300m
Costo: $2,490.00 (2 × 150 × $8.30)
```

**Recalculación automática:**
1. ✅ Sistema llama `recalculateAreaEdgebandCosts(areaId)`
2. ✅ Recalcula rolls necesarios: 2 rolls
3. ✅ Calcula nuevo costo total: $2,490.00
4. ✅ Redistribuye entre los 4 cabinets proporcionalmente
5. ✅ Actualiza `box_edgeband_cost` y `doors_edgeband_cost` de cada cabinet
6. ✅ Actualiza `subtotal` de cada cabinet
7. ✅ Actualiza `subtotal` del área

---

## Escenario 7: Edge Case - Exactamente 150m

### Setup
- **Área:** Test Area
- **Cabinets:** Suman exactamente **150.0m**

### Cálculo Esperado

**Rolls necesarios:**
```
Math.ceil(150.0 / 150) = 1 roll
```

**Costo:**
```
1 roll × 150m × $8.30/m = $1,245.00
```

**Costo por metro:**
```
$1,245.00 / 150m = $8.30/m (precio original, sin overhead)
```

### Material Breakdown Display
```
┌─ Edgeband (Rolls 150m) ──────────────────────┐
│ Edgeband Evita Laminate Matching Finish      │
│ # 1 roll  📏 150.0m / 150m  MX$1,245.00      │
└──────────────────────────────────────────────┘
```

**Nota:** Eficiencia del 100%, sin desperdicio

---

## Escenario 8: Edge Case - Ligeramente más de 150m

### Setup
- **Área:** Test Area
- **Cabinets:** Suman **150.1m**

### Cálculo Esperado

**Rolls necesarios:**
```
Math.ceil(150.1 / 150) = 2 rolls
```

**Costo:**
```
2 rolls × 150m × $8.30/m = $2,490.00
```

**Costo por metro:**
```
$2,490.00 / 150.1m = $16.59/m (casi el doble del precio base)
```

### Material Breakdown Display
```
┌─ Edgeband (Rolls 150m) ──────────────────────┐
│ Edgeband Evita Laminate Matching Finish      │
│ # 2 rolls  📏 150.1m / 300m  MX$2,490.00     │
└──────────────────────────────────────────────┘
```

**Nota:** Solo 0.1m extra requiere roll completo adicional

---

## Verificación del Sistema

### Pasos para Verificar

1. **Crear área nueva con 1 cabinet**
   - Verificar Material Breakdown muestra 1 roll
   - Verificar metros usados / metros totales

2. **Agregar 2do cabinet (mismo finish)**
   - Verificar que sigue siendo 1 roll (si total < 150m)
   - Verificar que los costos se redistribuyen automáticamente

3. **Agregar más cabinets hasta pasar 150m**
   - Verificar que cambia a 2 rolls
   - Verificar que muestra "XXXm / 300m"
   - Verificar que los costos se redistribuyen entre TODOS los cabinets

4. **Verificar en base de datos**
   ```sql
   SELECT
     product_sku,
     quantity,
     box_edgeband_cost,
     doors_edgeband_cost,
     subtotal
   FROM area_cabinets
   WHERE area_id = 'your-area-id'
   ORDER BY created_at;
   ```

---

## Fórmulas Clave

### Cálculo de Rolls
```typescript
const rollsNeeded = Math.ceil(totalMeters / 150);
```

### Cálculo de Costo Total
```typescript
const totalCost = rollsNeeded * 150 * pricePerMeter;
```

### Distribución de Costo
```typescript
const costPerMeter = totalCost / totalMeters;
const cabinetCost = cabinetMeters * costPerMeter;
```

### Verificación
```typescript
// La suma de todos los costos de cabinets debe igualar el costo total
sum(all_cabinet_costs) ≈ totalCost
// (puede haber diferencias mínimas por redondeo)
```

---

## Casos Especiales

### 1. Cabinet sin edgeband
- `box_edgeband_id` = null o `doors_edgeband_id` = null
- No se incluye en los cálculos
- Costo = $0.00

### 2. Cabinet con cantidad > 1
- Metros se multiplican por cantidad
- Ejemplo: 5 cabinets × 19.85m = 99.25m

### 3. Editar cantidad de cabinet existente
- Trigger recalculación automática
- Todos los costos se redistribuyen

### 4. Eliminar cabinet
- Trigger recalculación automática
- Puede reducir rolls necesarios
- Costos se redistribuyen entre cabinets restantes

---

## Integración con Sistema Completo

### Archivos Relacionados
- `src/lib/edgebandRolls.ts` - Lógica principal
- `src/components/CabinetForm.tsx` - Trigger recalculación
- `src/components/AreaMaterialBreakdown.tsx` - Display
- `MATERIAL_CALCULATION_SYSTEM.md` - Documentación técnica

### Flujo Completo
```
Usuario guarda cabinet
    ↓
CabinetForm.handleSubmit()
    ↓
recalculateAreaEdgebandCosts(areaId)
    ↓
calculateAreaEdgebandRolls(areaId)
    ↓
- Agrupa cabinets por finish
- Suma metros (box + doors)
- Calcula rolls (ceil(total/150))
- Calcula costo total
- Distribuye proporcionalmente
    ↓
Actualiza area_cabinets
    ↓
Actualiza project_areas.subtotal
    ↓
Material Breakdown se actualiza automáticamente
```

---

## Preguntas Frecuentes

**Q: ¿Por qué el costo por metro es más alto que el precio base?**
A: Porque se compra el roll completo de 150m, aunque no se use todo.

**Q: ¿Qué pasa si box y doors usan el mismo finish?**
A: Los metros se suman, aparece una sola vez en breakdown.

**Q: ¿Se recalcula al editar un cabinet?**
A: Sí, automáticamente al guardar.

**Q: ¿Funciona con versiones de proyectos?**
A: Sí, usa los mismos cálculos con datos de `version_area_cabinets`.

**Q: ¿Qué pasa con el desperdicio de material?**
A: El costo del desperdicio se distribuye proporcionalmente entre todos los cabinets. Es parte del costo real de hacer negocio.
