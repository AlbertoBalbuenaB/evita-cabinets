# Sistema de Actualización de Precios

## Resumen

Este sistema te permite actualizar automáticamente los precios de materiales en todos tus proyectos cuando cambias precios en la Price List, sin tener que editar manualmente cada gabinete.

## Cómo Funciona

### 1. Detección Automática de Cambios

Cuando actualizas un precio en la **Price List**:
- Un trigger en la base de datos detecta automáticamente el cambio
- El sistema identifica todos los proyectos que usan ese material
- Marca esos proyectos como "con precios desactualizados"
- Registra el cambio en un log histórico

### 2. Notificación Visual

Cuando abres un proyecto que tiene precios desactualizados:
- Aparece un **banner amarillo** en la parte superior con:
  - Icono de advertencia ⚠️
  - Mensaje explicativo
  - Botón "Review & Update Prices"
- El banner es visible hasta que actualices los precios o lo descartes

### 3. Actualización Manual (Siempre Disponible)

Incluso sin cambios detectados automáticamente, puedes revisar y actualizar precios:
- En la barra de herramientas del proyecto
- Botón **"Update Prices"** (con icono de gráfica 📈)
- Te permite comparar precios actuales vs guardados en cualquier momento

## Uso Paso a Paso

### Escenario: Descuento del 10% en Laminate Wilsonart Uptown

1. **Ve a Price List**
   - Encuentra "Laminate Wilsonart Uptown"
   - Actualiza el precio (ej: de $1000 a $900)
   - Guarda el cambio

2. **Abre el Proyecto "Loma Linda"**
   - El sistema habrá detectado automáticamente el cambio
   - Verás un banner amarillo indicando que hay precios desactualizados

3. **Haz clic en "Review & Update Prices"**
   - Se abre un modal con 3 pestañas:

#### Pestaña 1: Preview Impact
- Muestra un resumen de cambios:
  - Número de gabinetes afectados
  - Materiales que cambiaron
  - **Diferencia total** del proyecto (cuánto subirá o bajará)
- Lista de áreas afectadas (expandibles)
- Detalles por gabinete:
  - Qué materiales cambiaron
  - Precio anterior vs nuevo
  - Porcentaje de cambio

#### Pestaña 2: Select Areas
- Lista de todas las áreas con cambios
- **Checkboxes** para seleccionar qué actualizar:
  - Puedes seleccionar todas las áreas
  - O solo áreas específicas
- Resumen de la selección:
  - Número de áreas seleccionadas
  - Gabinetes a actualizar
  - Diferencia total de lo seleccionado

#### Pestaña 3: Results
- Barra de progreso durante la actualización
- Mensaje de éxito o errores
- Resumen de cambios aplicados

4. **Confirma la Actualización**
   - Haz clic en "Update X Cabinets"
   - El sistema recalcula todos los costos
   - Los nuevos precios se aplican automáticamente
   - El proyecto se actualiza con los nuevos totales

## Opciones de Actualización

### Actualizar Todo el Proyecto
- Selecciona todas las áreas
- Todos los gabinetes se actualizan de una vez

### Actualizar por Área
- **Opción 1**: En el modal de actualización, selecciona áreas específicas
- **Opción 2**: Desde cada área individual:
  - Botón de actualización (icono 🔄) junto al nombre del área
  - Abre el modal con esa área preseleccionada

## Características Importantes

### ✅ No Afecta el Sistema Actual
- Los gabinetes siguen funcionando exactamente igual
- Los precios almacenados no cambian hasta que TÚ lo apruebes
- Tienes control total sobre cuándo actualizar

### ✅ Vista Previa Completa
- Ves EXACTAMENTE cuánto cambiará el proyecto antes de confirmar
- Comparación lado a lado: precio anterior vs nuevo
- Porcentajes de cambio por material

### ✅ Actualización Selectiva
- No tienes que actualizar todo
- Elige qué áreas actualizar
- El resto mantiene sus precios originales

### ✅ Seguridad
- No se pierde información
- Los cambios se pueden revertir editando gabinets individuales
- Log histórico de todos los cambios de precio

## Ejemplo Práctico

### Situación Inicial
- Proyecto "Loma Linda" creado hace 2 semanas
- 50 gabinetes usan "Laminate Wilsonart Uptown" a $1000/unidad
- Costo de material en esos gabinetes: $50,000

### Obtienes Descuento
- Actualizas Price List: "Laminate Wilsonart Uptown" → $900/unidad
- Descuento del 10%

### Sin Este Sistema
❌ Tendrías que:
1. Abrir cada uno de los 50 gabinetes
2. Cambiar el material manualmente
3. O editar y re-seleccionar para forzar recalculo
4. Repetir 50 veces

### Con Este Sistema
✅ Lo que haces:
1. Abres el proyecto
2. Clic en "Review & Update Prices"
3. Ves: "50 cabinets affected, -$5,000 total difference"
4. Clic en "Update 50 Cabinets"
5. **¡Listo en 10 segundos!**

## Tips y Mejores Prácticas

### Cuándo Usar la Actualización Automática
- Cuando obtienes descuentos de proveedores
- Al actualizar listas de precios anuales/semestrales
- Cuando un material aumenta de precio y quieres actualizar proyectos en proceso

### Cuándo NO Usarla
- Proyectos ya ganados/aprobados con precio fijo
- Cuando el precio fue negociado especialmente para ese proyecto
- Proyectos históricos que no quieres modificar

### Recomendación
1. Marca proyectos como "Awarded" o "Won" cuando se aprueban
2. Solo actualiza proyectos en estado "Pending" o "Estimating"
3. Siempre revisa el impacto antes de confirmar

## Preguntas Frecuentes

### ¿Afecta proyectos cerrados?
No, pero puedes elegir no actualizarlos. El sistema te muestra TODOS los proyectos afectados, pero tú decides cuáles actualizar.

### ¿Puedo revertir cambios?
Sí, de dos formas:
1. Editar manualmente los gabinetes afectados
2. Volver a ejecutar "Update Prices" si cambias el precio en Price List

### ¿Se actualiza el hardware también?
Sí, el sistema actualiza:
- Box Material
- Box Edgeband
- Box Interior Finish
- Doors Material
- Doors Edgeband
- Doors Interior Finish
- **Hardware** (bisagras, jaladores, etc.)
- **Labor** (si los costos de labor cambiaron en Settings)

### ¿Y los countertops e items individuales?
Sí, también se actualizan si están vinculados a la Price List.

### ¿Qué pasa si elimino un material de Price List?
Los gabinets mantienen sus precios actuales. El sistema solo actualiza cuando el material EXISTE en Price List.

## Soporte Técnico

Si experimentas problemas:
1. Verifica que el material exista en Price List
2. Verifica que esté marcado como "Active"
3. Revisa la consola del navegador para errores
4. El log de cambios está en la tabla `price_change_log` (para debugging)
