# Sistema de Versionado de Proyectos - Guía de Usuario

## 📍 Ubicación en la Interfaz

El **Version Manager** aparece automáticamente en la parte superior de cada proyecto, justo debajo del título y dirección del proyecto, dentro de un área destacada con fondo gris claro.

```
┌─────────────────────────────────────────────────┐
│ ← Back to Projects                              │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │  Nombre del Proyecto         [PENDING]      │ │
│ │  📍 Dirección                                │ │
│ │  Quote Date: ... • Type: Custom             │ │
│ │  ─────────────────────────────────────────  │ │
│ │  🔀 Current Version: v1.0 - Initial Version │ │
│ │     [New Version]  [🔍]                     │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 🎯 Cómo Usar el Sistema de Versionado

### 1️⃣ **Ver Versiones Disponibles**

**Acción:** Click en el botón que muestra la versión actual (ej: "v1.0 - Initial Version")

**Resultado:** Se despliega un dropdown mostrando:
- Todas las versiones del proyecto
- Versión actual marcada con badge azul "Current"
- Para cada versión: número, nombre, fecha, total
- Botón de eliminar (🗑️) en versiones no activas

```
┌────────────────────────────────────────┐
│ All Versions                           │
│ 3 versions                             │
├────────────────────────────────────────┤
│ v3.0  [✓ Current]                      │
│ Premium Materials                      │
│ Oct 30, 2025 • $45,230.00             │
├────────────────────────────────────────┤
│ v2.0                              🗑️  │
│ Budget Option                          │
│ Oct 29, 2025 • $32,180.00             │
├────────────────────────────────────────┤
│ v1.0                              🗑️  │
│ Initial Version                        │
│ Oct 28, 2025 • $38,500.00             │
└────────────────────────────────────────┘
```

### 2️⃣ **Cambiar de Versión Activa**

**Acción:** Click en cualquier versión del dropdown

**Resultado:**
- La versión seleccionada se marca como "Current"
- El editor carga automáticamente esa versión
- El total del proyecto se actualiza
- Todas las áreas y gabinetes cambian a los de esa versión

**Uso:** Ver versiones antiguas, revisar opciones alternativas

### 3️⃣ **Crear Nueva Versión**

**Acción:** Click en botón "New Version"

**Paso 1 - Elegir tipo:**

```
┌─────────────────────────────────────────┐
│ Create New Version                      │
├─────────────────────────────────────────┤
│ Create From:                            │
│                                         │
│ ┌──────────────┐  ┌──────────────┐    │
│ │ + Empty      │  │ 📋 Duplicate  │    │
│ │ Version      │  │               │    │
│ │ Start from   │  │ Copy existing │    │
│ │ scratch      │  │ version       │    │
│ └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────┘
```

#### **Opción A: Empty Version (Desde Cero)**

1. Selecciona "Empty Version"
2. Ingresa nombre descriptivo (ej: "Alternate Design")
3. Agrega notas opcionales
4. Click "Create Version"

**Resultado:** Nueva versión vacía sin áreas ni gabinetes

**Uso:** Cuando quieres diseñar desde cero una alternativa completamente diferente

#### **Opción B: Duplicate (Copiar Versión)**

1. Selecciona "Duplicate"
2. Elige versión fuente del dropdown
3. **IMPORTANTE:** Decide sobre "Update prices to current":
   - ✅ **Marcado**: Aplica precios actuales de la lista
   - ❌ **Desmarcado**: Mantiene precios originales
4. Ingresa nombre (ej: "Premium Materials", "Client Revision 2")
5. Agrega notas
6. Click "Create Version"

```
┌─────────────────────────────────────────┐
│ Source Version:                         │
│ [v1.0 - Initial Version        ▼]      │
│                                         │
│ ☐ Update prices to current              │
│   Apply the latest price list to       │
│   all materials and items               │
│                                         │
│ Version Name: ________________          │
│ Notes: _________________________        │
└─────────────────────────────────────────┘
```

**Resultado:** Copia exacta de la versión fuente con:
- Todas las áreas duplicadas
- Todos los gabinets con misma configuración
- Todos los items
- Precios actualizados (si se marcó la opción)

**Uso común:**
- Cliente pide cambios → Duplicar v1.0, hacer cambios, comparar
- Proyecto antiguo retomado → Duplicar con precios actualizados
- Opciones de materiales → Duplicar y cambiar solo materiales

### 4️⃣ **Ver Historial de Versiones**

**Acción:** Click en botón de historial (🕐) al lado de "New Version"

**Resultado:** Se expande un timeline visual:

```
┌────────────────────────────────────────┐
│ 🕐 Version History                     │
├────────────────────────────────────────┤
│ ● 3  v3.0 - Premium Materials          │
│ │    Oct 30, 2025 14:30  $45,230.00   │
│ │    [Compare]                         │
│ ↓                                      │
│ ● 2  v2.0 - Budget Option              │
│ │    Oct 29, 2025 10:15  $32,180.00   │
│ │    [Compare]                         │
│ ↓                                      │
│ ● 1  v1.0 - Initial Version            │
│      Oct 28, 2025 09:00  $38,500.00   │
└────────────────────────────────────────┘
```

**Funciones:**
- Ver evolución cronológica del proyecto
- Click "Compare" para ver diferencias entre versiones consecutivas

### 5️⃣ **Comparar Versiones**

**Acción:** Click en "Compare" en el historial

**Resultado:** Modal fullscreen de comparación:

```
┌─────────────────────────────────────────────────────────┐
│ Version Comparison          [Export PDF] [✕]            │
│ Comparing v2.0 with v3.0                                │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐            │
│ │ ● v2.0           │  │ ● v3.0           │            │
│ │ Budget Option    │  │ Premium Materials│            │
│ │ $32,180.00       │  │ $45,230.00       │            │
│ └──────────────────┘  └──────────────────┘            │
│                                                         │
│ 📊 Summary of Changes                                  │
│ ┌────────────┬────────────┬────────────┬────────────┐ │
│ │ +$13,050   │ 2 Areas    │ +5 Cabinets│ 0 Items    │ │
│ │ 40.6% ↑    │ Modified   │            │            │ │
│ └────────────┴────────────┴────────────┴────────────┘ │
│                                                         │
│ Detailed Area Changes:                                 │
│ • Kitchen: $15,200 → $22,350 (+$7,150)                │
│ • Living Room: $16,980 → $22,880 (+$5,900)            │
└─────────────────────────────────────────────────────────┘
```

**Información mostrada:**
- **Resumen ejecutivo**: Diferencia total en $ y %
- **Cambios por categoría**: Áreas, Cabinets, Items (añadidos/eliminados)
- **Detalle por área**: Comparación lado a lado de totales
- **Áreas nuevas/eliminadas**: Listado claro

**Exportación:**
- Click "Export PDF"
- Se abre diálogo de impresión
- Guarda como PDF o imprime directamente

### 6️⃣ **Eliminar Versión**

**Acción:** Click en botón 🗑️ en el dropdown de versiones

**Restricción:** ⛔ No se puede eliminar la versión actual

**Confirmación:** "Delete version "X"? This action cannot be undone."

**Resultado:** La versión y todos sus datos se eliminan permanentemente

## 📋 Casos de Uso Comunes

### **Escenario 1: Cliente solicita cambios**

1. Abres el proyecto (actualmente en v1.0)
2. Click "New Version" → Duplicate → Source: v1.0
3. Nombre: "Client Revision - Oct 30"
4. ✅ Marca "Update prices" (si hay nuevos precios)
5. Haces los cambios solicitados
6. Click en Compare entre v1.0 y v2.0
7. Exportas PDF y envías al cliente
8. Si cliente aprueba: cambias v2.0 a Current

### **Escenario 2: Proyecto de hace 6 meses**

1. Abres proyecto antiguo (v1.0 de hace 6 meses)
2. Click "New Version" → Duplicate
3. ✅ **IMPORTANTE**: Marca "Update prices to current"
4. Sistema aplica automáticamente precios actuales
5. Revisas los cambios en comparación
6. Nueva versión lista con precios del día

### **Escenario 3: Opciones premium vs económica**

1. Proyecto base en v1.0
2. Crear v2.0 "Economic Option":
   - Duplicate v1.0
   - Cambiar a materiales económicos
3. Crear v3.0 "Premium Option":
   - Duplicate v1.0
   - Cambiar a materiales premium
4. Cliente compara las 3 opciones en historial
5. Selecciona la que prefiere como Current

## 🔐 Reglas del Sistema

✅ **Permitido:**
- Crear N versiones ilimitadas
- Cambiar entre versiones libremente
- Comparar cualquier par de versiones
- Eliminar versiones no activas
- Editar solo la versión actual

⛔ **No permitido:**
- Eliminar versión marcada como Current
- Tener 2 versiones Current simultáneamente
- Editar versiones que no son Current (debes cambiarla a Current primero)

## 💡 Tips Profesionales

1. **Nombres descriptivos**: Usa nombres que expliquen el propósito
   - ✅ "Premium Oak - Client Request"
   - ❌ "Version 2"

2. **Notas útiles**: Documenta el por qué de cada versión
   - "Cliente pidió cambiar cocina a maple"
   - "Opción más económica manteniendo calidad"

3. **Update Prices**: Úsalo cuando:
   - Proyecto tiene más de 1 mes
   - Sabes que hubo cambios en la lista de precios
   - Quieres cotización con precios del día

4. **Comparaciones antes de presentar**: Siempre exporta PDF de comparación antes de reunión con cliente

5. **Versionado estratégico**: No dupliques para cada pequeño cambio, agrupa cambios relacionados

## 🚀 Beneficios del Sistema

- ✅ Nunca pierdes historial de cotizaciones
- ✅ Puedes volver a versiones anteriores
- ✅ Comparaciones profesionales para cliente
- ✅ Actualización automática de precios
- ✅ Manejo de múltiples opciones por proyecto
