# Sistema de Actualización de Precios por Material

## ✅ Implementado

El sistema ahora te permite **seleccionar materiales específicos** para actualizar sus precios en todo el proyecto, con control total sobre qué cambiar y qué mantener.

## 🎯 Cómo Funciona

### Botón "Update Prices"
- Ubicación: Barra de herramientas principal en ProjectDetails
- Icono: 📈 (TrendingUp)
- Disponible siempre que el proyecto tenga cabinets

### Flujo de Actualización

#### 1. Preview Changes (Vista Previa)
Cuando haces clic en "Update Prices", el sistema:

- **Analiza TODO el proyecto**
- Compara el precio actual en Price List vs el costo almacenado en cada cabinet
- Agrupa las diferencias **por material** (no por área)
- Ignora diferencias menores a $0.01 (redondeo)

**Muestra:**
- Lista de materiales con diferencias
- Número de cabinets afectados por cada material
- Diferencia total por material
- Porcentaje de cambio
- Áreas donde se usa ese material

**Ejemplo:**
```
Absolut White Melamine 15mm x 4ft x 8ft
Box Material • 116 cabinets • Areas: Kitchen, Laundry, Bathroom
+$145.62 (+9.8%)
$1,487.84 → $1,633.46
```

#### 2. Select Materials (Seleccionar Materiales)
**Aquí es donde TÚ decides qué actualizar:**

- Lista completa de materiales con diferencias
- **Checkbox por cada material**
- Información detallada:
  - Tipo de material (Box Material, Edgeband, etc.)
  - Cantidad de cabinets afectados
  - Áreas donde se usa
  - Diferencia de precio
  - Porcentaje de cambio

**Controles:**
- "Select All" - Selecciona todos los materiales
- "Deselect All" - Deselecciona todos

**Summary en tiempo real:**
- Materiales seleccionados: X de Y
- Cabinets a actualizar: Z
- Diferencia total: $XXX

#### 3. Confirm & Update (Confirmar y Actualizar)
Al hacer clic en "Update X Cabinets":

- Muestra progreso en tiempo real
- Barra de progreso: "Updating cabinet X of Y"
- Solo actualiza los materiales que seleccionaste
- Los demás materiales mantienen su costo original
- Recalcula subtotales automáticamente

## 📋 Ejemplo de Uso

### Escenario: Descuento del 10% en Laminate Wilsonart Uptown

#### Paso 1: Actualizar Price List
1. Ve a Price List
2. Busca "Laminate Wilsonart Uptown Walnut"
3. Precio anterior: $2,662.16 → Nuevo precio: $2,395.94
4. Guarda

#### Paso 2: Abrir Proyecto
1. Abre "Loma Linda Rehabilitation Hospital"
2. Haz clic en botón **"Update Prices"**

#### Paso 3: Revisar Preview
Verás algo como:
```
Material Price Differences Detected
3 materials have different prices than stored in 145 cabinets.

✓ Absolut White Melamine 15mm x 4ft x 8ft
  Box Material • 116 cabinets • +$145.62 (+9.8%)

✓ Laminate Wilsonart Uptown Walnut 7P71K-12
  Doors Material • 29 cabinets • -$7,720.38 (-10.0%)

✓ Edgeband Absolut White PVC 19x1mm
  Box Edgeband • 30 cabinets • +$15.20 (+2.1%)
```

#### Paso 4: Seleccionar Solo Wilsonart
1. Clic en pestaña "Select Materials"
2. **Desmarca** "Absolut White Melamine" (no quieres actualizarlo)
3. **Marca** "Laminate Wilsonart Uptown" (este sí quieres actualizarlo)
4. **Desmarca** "Edgeband" (no quieres actualizarlo)

El summary muestra:
```
Selection Summary
Materials selected: 1 of 3
Cabinets to update: 29
Total difference: -$7,720.38
```

#### Paso 5: Actualizar
1. Clic en "Update 29 Cabinets"
2. Espera unos segundos (barra de progreso)
3. ✅ "Prices Updated Successfully"
4. El modal se cierra automáticamente

#### Resultado Final:
- ✅ **Wilsonart actualizado** en 29 cabinets con el descuento del 10%
- ✅ **Absolut White mantiene** su precio original
- ✅ **Edgeband mantiene** su precio original
- ✅ Proyecto total se actualizó reflejando el descuento

## 🔍 ¿Por Qué Aparecen Diferencias en Materiales que NO Cambié?

Esto puede ocurrir por varias razones:

### 1. **Cambios en Square Footage del Producto**
Si editaste el `box_sf` o `doors_fronts_sf` en el Products Catalog después de crear los cabinets, el recalculo dará diferente.

**Ejemplo:**
- Cabinet creado con producto que tenía 20.60 sf
- Luego editaste el producto a 22.00 sf
- El sistema recalcula: 22.00 sf × $695 / 32 = diferente al almacenado

### 2. **Cambios en Waste Percentage**
Si cambiaste el waste percentage en Settings, los cálculos cambian.

### 3. **Diferencias de Redondeo Acumuladas**
Con cantidades grandes, los decimales se acumulan y pueden pasar el threshold de $0.01.

### 4. **Uso de `price_with_tax` vs `price`**
Si algunos cabinets se crearon cuando había tax y luego quitaste el tax, habrá diferencia.

## ✅ Ventajas del Nuevo Sistema

### Control Granular
- ✅ Seleccionas **exactamente** qué materiales actualizar
- ✅ Ves **exactamente** cuánto cambiará antes de confirmar
- ✅ Puedes actualizar solo 1 material de 10 si quieres

### Transparencia Total
- ✅ Ves qué cabinets se afectan
- ✅ Ves en qué áreas están
- ✅ Ves el cambio de precio exacto
- ✅ Ves el porcentaje de cambio

### Seguridad
- ✅ No cambia nada hasta que confirmes
- ✅ Puedes cancelar en cualquier momento
- ✅ Los cambios son selectivos
- ✅ Progreso visible en tiempo real

### Flexibilidad
- ✅ Actualiza todo el proyecto
- ✅ O solo materiales específicos
- ✅ O ninguno (solo revisa las diferencias)

## 💡 Casos de Uso

### Caso 1: Descuento de Proveedor
**Situación:** Obtienes 10% descuento en un material específico

**Acción:**
1. Actualiza ese material en Price List
2. Abre proyectos activos
3. Selecciona solo ese material para actualizar
4. Los demás materiales quedan intactos

### Caso 2: Actualización Anual de Precios
**Situación:** Todos los precios suben 5% anualmente

**Acción:**
1. Actualiza todos los precios en Price List
2. Abre cada proyecto en proceso
3. Revisa la lista de materiales
4. Decide cuáles actualizar según el estado del proyecto

### Caso 3: Error en Price List
**Situación:** Te das cuenta que pusiste mal un precio hace meses

**Acción:**
1. Corrige el precio en Price List
2. Abre proyectos afectados
3. Ve cuáles cabinets tienen el precio incorrecto
4. Actualiza solo ese material
5. El resto mantiene sus costos

### Caso 4: Proyecto con Precio Negociado
**Situación:** Proyecto "Loma Linda" tiene precio especial acordado con cliente

**Acción:**
1. Abres el proyecto
2. Ves las diferencias en precio
3. **NO seleccionas ningún material**
4. Cierras el modal
5. Proyecto mantiene sus precios negociados

## ⚠️ Importante

### NO Actualices Automáticamente
- Proyectos ya aprobados/ganados
- Proyectos con precios negociados especiales
- Proyectos históricos de referencia

### SÍ Actualiza
- Proyectos en estado "Pending" o "Estimating"
- Cuando obtienes descuentos que quieres aplicar
- Cuando corriges errores en Price List
- Cuando actualizas precios al inicio de año

## 🎓 Tips

1. **Revisa siempre el Preview primero** - Nunca actualices a ciegas
2. **Usa "Select Materials" con cuidado** - Marca solo lo que realmente quieres cambiar
3. **Verifica el Summary** - Confirma que la diferencia total es la esperada
4. **Mantén Price List actualizado** - Es tu fuente de verdad
5. **Documenta cambios especiales** - Si un proyecto tiene precios negociados, anótalo en "Project Notes"

## 🔧 Soporte Técnico

### El sistema no muestra diferencias
**Causa:** Los precios almacenados coinciden con Price List (dentro de $0.01)
**Solución:** Todo está correcto, no hay nada que actualizar

### Aparecen muchas diferencias inesperadas
**Causa:** Cambios en productos catalog o settings desde que se crearon los cabinets
**Solución:** Revisa cada material y decide cuáles realmente quieres actualizar

### Error al actualizar
**Causa:** Puede ser un problema de conexión o permisos
**Solución:** Revisa la consola del navegador, intenta de nuevo

## 📊 Resumen

**Antes:** Tenías que editar cada cabinet manualmente uno por uno

**Ahora:**
1. Haz clic en "Update Prices"
2. Revisa la lista de materiales con diferencias
3. Selecciona cuáles actualizar
4. Confirma
5. ¡Listo! Todos los cabinets actualizados en segundos

**Control total. Transparencia completa. Actualizaciones selectivas.**
