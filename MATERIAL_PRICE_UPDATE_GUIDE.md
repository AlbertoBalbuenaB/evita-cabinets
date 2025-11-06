# Sistema de Actualización de Precios por Material

## ✅ Sistema Actualizado - Basado en Cambios Reales

El sistema ahora solo muestra materiales cuyos **precios realmente cambiaron en Price List** después de la creación del proyecto. No muestra diferencias falsas por redondeo o cambios en configuración.

## 🎯 Cómo Funciona

### Detección Inteligente de Cambios
El sistema:
1. ✅ Verifica la fecha de creación del proyecto
2. ✅ Busca cambios de precio en `price_change_log` **posteriores** a esa fecha
3. ✅ Solo muestra materiales que REALMENTE cambiaron de precio
4. ✅ Ignora diferencias por redondeo, configuración o cálculos internos

### Información Mostrada Para Cada Material

**Preview Changes muestra:**
- **Nombre del material**
- **Tipo** (Box Material, Doors Material, Edgeband, etc.)
- **Precio unitario anterior** → **Precio unitario actual**
- **Porcentaje de cambio** del precio unitario
- **Fecha y hora exacta** del cambio
- **Cabinets afectados** y áreas donde se usa
- **Impacto total** en costos del proyecto

## 📋 Ejemplo Real: Hill Place (Creado Ayer)

### Situación
- **Proyecto creado:** 5 de noviembre, 10:23 PM
- **Cambios en Price List desde entonces:** NINGUNO

### Resultado
```
✅ All Materials Up to Date
No material price differences detected in this project.
```

**¿Por qué?** Porque NO has actualizado ningún precio en Price List desde que creaste el proyecto. El sistema verifica `price_change_log` y no encuentra cambios posteriores al 5 de noviembre 10:23 PM.

## 📋 Ejemplo Real: Loma Linda (Con Descuento Wilsonart)

### Situación
- **Proyecto creado:** 28 de octubre
- **Cambio aplicado:** Wilsonart bajó 10% el 6 de noviembre 2:08 PM

### Resultado
```
Material Price Differences Detected
1 material has different prices than stored in 29 cabinets.

Laminate Wilsonart Uptown Walnut 7P71K-12
Doors Material

Price changed: Nov 6, 02:08 PM
Unit price: $2,662.16 → $2,395.94 (-10.0%)
Impact: 29 cabinets in 3 areas: Kitchen, Bathroom, Laundry

Total Impact: -$7,720.38 (-10.0%)
```

### ¿Por qué NO aparece Absolut White o Edgeband?
Porque esos materiales **NO han cambiado de precio en Price List** desde el 28 de octubre. El sistema ya no muestra diferencias fantasma por redondeo o configuración.

## 🔍 Por Qué es Mejor Este Sistema

### ❌ Sistema Anterior (Problema)
- Comparaba "costo recalculado" vs "costo almacenado"
- Mostraba diferencias falsas por:
  - Redondeo acumulado
  - Campos `sf_per_sheet` null o vacíos
  - Cambios en waste percentage en Settings  
  - Uso de `price_with_tax` vs `price`
- **Resultado:** Falsos positivos en proyectos sin cambios reales

**Ejemplo del problema:**
```
Material: Melamine Evita Plus TBD
Stored cost: $3,157.00
Recalculated: $2,897.53
Difference: $259.47

❌ PERO el precio NO cambió en Price List
```

### ✅ Sistema Actual (Solución)
- Verifica la tabla `price_change_log`
- Solo muestra materiales cuyo precio **realmente cambió**
- Muestra precio anterior vs precio nuevo
- Muestra fecha exacta del cambio
- **Resultado:** Solo ves cambios reales que hiciste en Price List

## 💡 Información Adicional en el Modal

### 1. Precio Unitario con Cambio
```
Unit price: $695.00 → $750.00 (+7.9%)
```
- Precio del material por unidad (sheet, metro, pieza)
- Porcentaje de cambio del precio unitario
- Te permite verificar si el cambio es correcto

### 2. Fecha y Hora del Cambio
```
Price changed: Nov 6, 02:08 PM
```
- Fecha y hora exacta cuando cambiaste el precio en Price List
- Te ayuda a recordar cuándo y por qué lo cambiaste
- Útil para auditoría de cambios

### 3. Impacto por Material
```
Impact: 29 cabinets in 3 areas: Kitchen, Bathroom, Laundry
Total Impact: -$7,720.38 (-10.0%)
$77,203.80 → $69,483.42
```
- Cuántos cabinets usan ese material
- En qué áreas están ubicados
- Costo total actual vs costo total nuevo
- Cuánto cambiará el total del proyecto

## ⚠️ Casos Especiales

### 1. Proyecto Nuevo - Sin Cambios
**Situación:** Creaste Hill Place ayer y NO has cambiado ningún precio desde entonces.

**Resultado:** ✅ "All Materials Up to Date"

**Explicación:** El sistema busca cambios en `price_change_log` después de la fecha de creación del proyecto. Como no hay cambios, no muestra nada.

### 2. Proyecto Viejo - Solo Cambios Recientes
**Situación:** Loma Linda se creó hace 1 semana. Hoy actualizaste solo Wilsonart.

**Resultado:** ✅ Solo muestra Wilsonart

**Explicación:** El sistema ignora materiales que no cambiaron. Aunque otros materiales puedan tener diferencias matemáticas por redondeo, solo muestra los que REALMENTE cambiaron en Price List.

### 3. Material con sf_per_sheet Null
**Situación:** Material tiene `sf_per_sheet = null` y el cálculo usa default 32.

**Resultado:** ✅ NO aparece si el precio no cambió

**Explicación:** Aunque el recálculo pueda dar diferente, el sistema NO lo muestra porque el precio unitario en Price List no cambió.

### 4. Múltiples Cambios en Mismo Material
**Situación:** Cambiaste el precio de un material 3 veces en la misma semana.

**Resultado:** ✅ Muestra el cambio acumulado (precio al crear proyecto vs precio actual)

**Explicación:** Solo importa: ¿Cuánto costaba cuando creé el proyecto? vs ¿Cuánto cuesta ahora?

## 🎓 Best Practices

### 1. Verifica la Fecha del Cambio
- Si ves un cambio que no recuerdas haber hecho
- Revisa la fecha y hora
- Te ayuda a identificar cambios accidentales o de otros usuarios

### 2. Revisa el Precio Unitario
- Verifica que el precio anterior y actual sean correctos
- Si algo no cuadra, NO actualices
- Investiga primero qué pasó

### 3. Proyectos con Precio Negociado
- Si negociaste un precio especial con el cliente
- NO selecciones materiales para actualizar
- Usa el modal solo para revisar qué cambió en Price List

### 4. Actualización Selectiva
- No estás obligado a actualizar todos los materiales mostrados
- Puedes actualizar solo los que tienen descuento
- Dejar sin actualizar los que subieron de precio (si ya aprobaron el proyecto)

### 5. Proyectos Aprobados o Ganados
**Cuidado:** Cambiar precios en proyectos ya aprobados puede causar problemas con el cliente.

**Recomendación:** Solo actualiza si:
- El cliente autorizó el cambio
- El cambio es a su favor (descuento)
- Aún no firmaron el contrato

## 🔧 Troubleshooting

### Problema 1: No Aparecen Cambios Pero Cambié Precios

**Causa 1:** Los cambios fueron **antes** de crear el proyecto.
- **Solución:** El sistema solo muestra cambios DESPUÉS de la creación. Si el precio ya estaba actualizado cuando creaste el proyecto, no aparecerá.

**Causa 2:** El proyecto se creó **después** del cambio.
- **Solución:** Los cabinets ya tienen el precio actualizado desde su creación. No hay nada que actualizar.

**Causa 3:** Cambiaste y luego revertiste al precio original.
- **Solución:** El sistema compara precio al crear vs precio actual. Si son iguales, no muestra nada.

### Problema 2: Aparece Un Cambio Que No Hice

**Causa:** Alguien más en tu equipo actualizó el precio en Price List.

**Solución:** 
1. Revisa la fecha y hora del cambio
2. Pregunta a tu equipo si fue intencional
3. Si fue error, revierte el cambio en Price List

### Problema 3: El Porcentaje No Coincide Con Mi Cálculo

**Causa:** Hay DOS porcentajes diferentes:
- **Porcentaje del precio unitario:** +10%
- **Porcentaje del costo del cabinet:** Puede ser diferente

**Ejemplo:**
```
Precio unitario: $695 → $765 (+10.0%)
Costo cabinet 1: $1,500 → $1,650 (+10.0%) ✅
Costo cabinet 2: $3,200 → $3,520 (+10.0%) ✅
```

Ambos porcentajes deberían coincidir, pero el sistema muestra:
1. `priceChangePercentage`: Cambio en precio unitario
2. `percentageChange`: Cambio en costo total del proyecto

### Problema 4: Aparece Material en Área que no Uso

**Causa:** Puede haber cabinets con ese material en áreas que no esperabas.

**Solución:**
1. Revisa la lista de áreas mostradas
2. Verifica los cabinets en esas áreas
3. Confirma que efectivamente usan ese material

## 📊 Resumen

### Ventajas del Nuevo Sistema

1. **✅ Sin falsos positivos** 
   - Solo muestra cambios reales en Price List
   - No más diferencias fantasma por redondeo

2. **✅ Información completa**
   - Precio anterior vs nuevo
   - Fecha exacta del cambio
   - Impacto total en el proyecto

3. **✅ Transparencia total**
   - Sabes exactamente qué cambió
   - Cuándo cambió
   - Por cuánto cambió

4. **✅ Control granular**
   - Seleccionas qué materiales actualizar
   - Checkbox individual por material
   - Summary en tiempo real

5. **✅ Auditable**
   - Historial completo en `price_change_log`
   - Fecha y hora de cada cambio
   - Precio anterior y nuevo guardados

### Flujo Completo

```
1. Actualizas precio en Price List
   ↓
2. Se registra en price_change_log
   ↓
3. Abres proyecto en ProjectDetails
   ↓
4. Clic en "Update Prices"
   ↓
5. Sistema busca cambios DESPUÉS de fecha de creación del proyecto
   ↓
6. Muestra solo materiales que REALMENTE cambiaron
   ↓
7. Revisas: precio anterior, nuevo, fecha, impacto
   ↓
8. Seleccionas materiales a actualizar
   ↓
9. Confirmas
   ↓
10. Sistema actualiza cabinets seleccionados
   ↓
11. ¡Listo!
```

**Control total. Información completa. Sin sorpresas. Sin falsos positivos.**
