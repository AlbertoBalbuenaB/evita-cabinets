# 📚 Guía Completa del Sistema de Versionado

## 🎯 ¿Qué problema resuelve?

Antes, cuando un cliente pedía cambios o los precios de materiales subían, tenías que:
- ❌ Modificar la cotización original (perdías el historial)
- ❌ Duplicar el proyecto manualmente
- ❌ No podías comparar fácilmente versiones anteriores

Ahora puedes:
- ✅ Crear múltiples versiones de una cotización
- ✅ Mantener historial completo de cambios
- ✅ Actualizar precios automáticamente
- ✅ Comparar versiones lado a lado
- ✅ Exportar cualquier versión a PDF

## 📍 Ubicación en la Interfaz

Cuando abres un proyecto, verás el **sistema de versionado** en la parte superior:

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Projects                                           │
│                                                               │
│ ╔═══════════════════════════════════════════════════════════╗│
│ ║  Proyecto: Kitchen Remodel        [PENDING]               ║│
│ ║  📍 123 Main St, City                                     ║│
│ ║  Quote Date: Oct 30, 2025 • Type: Custom                 ║│
│ ║  ──────────────────────────────────────────────────────── ║│
│ ║                                                            ║│
│ ║  🔀 Current Version:                    Display Currency: ║│
│ ║     v1.0 - Initial Version ▼               [USD] [MXN]   ║│
│ ║     [+ New Version] [🕐]                   [Both]         ║│
│ ║                                            ───────────     ║│
│ ║                                            Project Total   ║│
│ ║                                            $45,230.00      ║│
│ ╚═══════════════════════════════════════════════════════════╝│
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Casos de Uso Paso a Paso

### CASO 1: Cliente Pide Cambios a Cotización Existente

**Situación:** Cotizaste una cocina completa la semana pasada por $45,000. El cliente ahora dice que eliminemos 3 gabinetes del comedor.

**Pasos:**

1. **Abrir el proyecto**
   - Ve a Projects
   - Click en tu proyecto "Kitchen Remodel"
   - Verás que está en v1.0

2. **Crear nueva versión basada en la actual**
   - Click botón "**+ New Version**"
   - En el modal, selecciona "**Duplicate**" (ya estará seleccionado)
   - Verás dropdown "Source Version" mostrando: **v1.0 - Initial Version ($45,000.00)**

3. **Configurar la nueva versión**
   - ❌ **NO marques** "Update prices to current" (precios siguen igual)
   - Version Name: `Client Revision - Remove 3 Cabinets`
   - Notes: `Cliente eliminó 3 gabinetes del comedor por presupuesto`
   - Click "**Create Version**"

4. **Editar la nueva versión**
   - Sistema automáticamente cambia a v2.0
   - Todas las áreas y gabinetes están duplicados
   - Ve al área "Comedor"
   - Elimina los 3 gabinets solicitados
   - Nuevo total: $42,000

5. **Comparar versiones**
   - Click en botón historial 🕐
   - Click "**Compare**" entre v1.0 y v2.0
   - Verás: "-3 Cabinets" y diferencia "-$3,000"
   - Click "**Export PDF**" para enviar al cliente

**Resultado:** Tienes ambas cotizaciones guardadas. Si cliente cambia de opinión, simplemente cambias a v1.0.

---

### CASO 2: Proyecto Retomado con Precios Antiguos

**Situación:** Cotizaste un proyecto hace 3 meses por $50,000. Cliente regresa ahora pero los precios de melamina subieron 5%.

**Pasos:**

1. **Abrir proyecto antiguo**
   - Ve a Projects
   - Busca "Living Room Cabinets" (3 meses atrás)
   - Estás viendo v1.0 con precios antiguos

2. **Crear versión con precios actualizados**
   - Click "**+ New Version**"
   - Selecciona "**Duplicate**"
   - Source Version: v1.0 - Initial Version ($50,000.00)
   - ✅ **IMPORTANTE: Marca** "**Update prices to current**"

3. **Configurar**
   - Version Name: `Updated Pricing - Oct 2025`
   - Notes: `Precios actualizados después de 3 meses. Melamina subió 5%`
   - Click "**Create Version**"

4. **El sistema hace la magia**
   - Duplica todos los gabinetes
   - Busca cada material en price_list actual
   - Recalcula TODOS los costos
   - Nuevo total: $52,500

5. **Explicar al cliente**
   - Click botón historial 🕐
   - Click "**Compare**" entre v1.0 y v2.0
   - Muestra: "+$2,500 (5% increase)"
   - Export PDF de comparación
   - Envías ambos PDFs al cliente explicando el aumento

**Resultado:** Cliente entiende claramente por qué subió el precio. Puedes justificarlo con datos.

---

### CASO 3: Opciones Premium vs Económica

**Situación:** Cliente no decide entre melamina o madera. Quieres darle 2 opciones para que compare.

**Pasos:**

1. **Crear versión base**
   - Creas proyecto nuevo "Bedroom Closets"
   - Diseñas con melamina estándar
   - v1.0: $30,000

2. **Crear opción premium**
   - Click "**+ New Version**"
   - Duplicate → Source: v1.0
   - ❌ NO marques "Update prices"
   - Version Name: `Premium Wood Option`
   - Notes: `Madera de roble en lugar de melamina`
   - Click "Create Version"

3. **Modificar materiales**
   - Sistema cambió a v2.0
   - Editas cada cabinet
   - Cambias material Box de melamina a roble
   - Cambias material Doors de melamina a roble
   - v2.0 nuevo total: $45,000

4. **Crear opción económica**
   - Click "**+ New Version**"
   - Duplicate → Source: v1.0 (vuelves a la original)
   - Version Name: `Budget Option`
   - Notes: `Melamina básica, sin herrajes premium`
   - Modificas herrajes a opciones más económicas
   - v3.0 total: $25,000

5. **Presentar opciones al cliente**
   - Tienes 3 versiones:
     - v1.0: Standard ($30,000)
     - v2.0: Premium ($45,000)
     - v3.0: Budget ($25,000)
   - Comparas v3.0 vs v1.0 (diferencia: -$5,000)
   - Comparas v1.0 vs v2.0 (diferencia: +$15,000)
   - Exportas los 3 PDFs
   - Cliente elige opción Standard

6. **Marcar versión elegida como actual**
   - Click en dropdown de versión
   - Click en "v1.0 - Standard"
   - Ahora v1.0 es la versión "Current"
   - Esta es la que se usa para el proyecto final

**Resultado:** Cliente tuvo 3 opciones claras con precios exactos. Tú no perdiste ningún trabajo.

---

## 🛠️ Funciones Detalladas

### 1. Ver Versiones Disponibles

**Acción:** Click en el botón de versión actual (ej: "v1.0 - Initial Version ▼")

**Verás:**
```
┌────────────────────────────────────────┐
│ All Versions         3 versions        │
├────────────────────────────────────────┤
│ v3.0  [✓ Current]                 🗑️  │
│ Premium Wood Option                    │
│ Oct 30, 2025 • $45,000.00             │
├────────────────────────────────────────┤
│ v2.0                              🗑️  │
│ Budget Option                          │
│ Oct 29, 2025 • $25,000.00             │
├────────────────────────────────────────┤
│ v1.0                              🗑️  │
│ Standard Melamine                      │
│ Oct 28, 2025 • $30,000.00             │
└────────────────────────────────────────┘
```

**Funciones:**
- Click en cualquier versión para cambiarla a "Current"
- Click 🗑️ para eliminar (solo versiones NO current)
- Badge azul "✓ Current" muestra la activa

### 2. Crear Nueva Versión

**Botón:** "+ New Version"

**Opciones:**

#### A. Empty Version (Desde Cero)
- Usa cuando: Quieres diseñar algo completamente diferente
- Resultado: Proyecto nuevo SIN áreas, sin gabinets
- Ejemplo: Cliente pide opción radicalmente distinta

#### B. Duplicate (Copiar Existente)
- Usa cuando: Quieres partir de algo que ya existe
- Resultado: Copia EXACTA de la versión fuente
- Ejemplo: 99% de los casos

**Campos importantes:**

1. **Source Version** (solo en Duplicate)
   - Dropdown con TODAS las versiones
   - Muestra: número, nombre, total
   - Selecciona la que quieres copiar

2. **☐ Update prices to current** (solo en Duplicate)
   - ✅ Marcado: Aplica precios DE HOY de price_list
   - ❌ Desmarcado: Mantiene precios originales
   - Usa marcado cuando: Proyecto antiguo o precios cambiaron
   - Usa desmarcado cuando: Solo cambias diseño, no precios

3. **Version Name** (requerido)
   - Nombre descriptivo
   - Ejemplos buenos:
     - "Client Revision Oct 30"
     - "Premium Oak Materials"
     - "Budget Option - Basic Melamine"
   - Ejemplos malos:
     - "Version 2"
     - "Test"
     - "Nueva"

4. **Notes** (opcional pero recomendado)
   - Documenta POR QUÉ hiciste esta versión
   - Ejemplos:
     - "Cliente eliminó 3 gabinetes por presupuesto"
     - "Precios actualizados después de 3 meses"
     - "Opción más económica manteniendo calidad"

### 3. Ver Historial de Versiones

**Botón:** 🕐 (al lado de "+ New Version")

**Muestra timeline visual:**
```
┌────────────────────────────────────────┐
│ 🕐 Version History                     │
├────────────────────────────────────────┤
│ ● 3  v3.0 - Premium Wood               │
│ │    Oct 30, 2025 14:30  $45,000.00   │
│ │    [Compare]                         │
│ ↓                                      │
│ ● 2  v2.0 - Budget Option              │
│ │    Oct 29, 2025 10:15  $25,000.00   │
│ │    [Compare]                         │
│ ↓                                      │
│ ● 1  v1.0 - Standard                   │
│      Oct 28, 2025 09:00  $30,000.00   │
└────────────────────────────────────────┘
```

**Función Compare:**
- Aparece entre versiones consecutivas
- Click para ver diferencias detalladas

### 4. Comparar Versiones

**Acceso:** Click "Compare" en historial

**Pantalla completa muestra:**

```
┌─────────────────────────────────────────────────────────┐
│ Version Comparison          [Export PDF] [✕]            │
│ Comparing v2.0 with v3.0                                │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐            │
│ │ ● v2.0           │  │ ● v3.0           │            │
│ │ Budget Option    │  │ Premium Wood     │            │
│ │ Oct 29, 2025     │  │ Oct 30, 2025     │            │
│ │ $25,000.00       │  │ $45,000.00       │            │
│ └──────────────────┘  └──────────────────┘            │
│                                                         │
│ 📊 Summary of Changes                                  │
│ ┌────────────┬────────────┬────────────┬────────────┐ │
│ │ +$20,000   │ 0 Areas    │ 0 Cabinets│ 0 Items    │ │
│ │ 80% ↑      │ Changed    │ Changed   │ Changed    │ │
│ └────────────┴────────────┴────────────┴────────────┘ │
│                                                         │
│ Modified Areas:                                        │
│ • Kitchen: $10,000 → $18,000 (+$8,000)                │
│ • Living: $15,000 → $27,000 (+$12,000)                │
└─────────────────────────────────────────────────────────┘
```

**Información mostrada:**
- Diferencia total en $ y %
- Áreas añadidas/eliminadas/modificadas
- Cabinets añadidos/eliminados
- Items añadidos/eliminados
- Detalle por área con montos

**Exportar:**
- Click "Export PDF"
- Se abre diálogo de impresión del navegador
- Guarda como PDF o imprime

### 5. Eliminar Versión

**Cómo:** Click 🗑️ en dropdown de versiones

**Restricciones:**
- ⛔ NO puedes eliminar versión "Current"
- Primero cambia a otra versión como Current
- Luego elimina la que quieras

**Confirmación:**
- "Delete version "X"? This action cannot be undone."
- Es permanente, ten cuidado

### 6. Controles de Divisas

**Ubicación:** Lado derecho del Version Manager

**Opciones:**
- **USD**: Muestra todo en dólares
- **MXN**: Muestra todo en pesos mexicanos
- **Both**: Muestra ambas divisas simultáneamente

**Cómo funciona:**
- Click en botón deseado
- Todos los montos cambian inmediatamente
- PDFs se exportan en la divisa seleccionada
- Conversión usa el Exchange Rate de Settings

## ⚠️ Restricciones Importantes

1. **Solo una versión Current**
   - Solo UNA versión puede estar marcada como "Current"
   - Cambiar a otra versión desmarca automáticamente la anterior

2. **No se puede eliminar Current**
   - Si quieres eliminar la versión actual
   - Primero marca otra como Current
   - Luego elimina la que quieras

3. **Solo puedes editar la versión Current**
   - Si quieres editar v1.0 pero estás en v3.0
   - Cambia v1.0 a Current
   - Edita
   - Regresa v3.0 a Current si quieres

4. **Update prices es irreversible**
   - Una vez creada versión con precios actualizados
   - No puedes "desactualizarlos"
   - Por eso siempre duplica ANTES de actualizar

## 💡 Tips Profesionales

### 1. Nomenclatura Clara
✅ Buenos nombres:
- "Client Revision Oct 30 - Remove 3 Cabinets"
- "Premium Oak Materials"
- "Budget Option - Economical Melamine"
- "Updated Pricing - March 2025"

❌ Malos nombres:
- "Version 2"
- "Test"
- "Nueva"
- "aaa"

### 2. Cuándo Actualizar Precios

✅ Actualiza cuando:
- Proyecto tiene más de 1 mes
- Sabes que hubo cambios en price_list
- Cliente vuelve después de semanas/meses
- Quieres cotización con precios del día

❌ NO actualices cuando:
- Solo cambias diseño/gabinetes
- Precios no han cambiado
- Quieres mantener presupuesto original

### 3. Documentar en Notes

Siempre escribe por qué hiciste la versión:
- "Cliente eliminó 3 gabinetes por presupuesto"
- "Cambio a madera de roble por solicitud"
- "Precios actualizados - melamina subió 5%"
- "Opción económica para presentar alternativas"

En 2 meses agradecerás haberlo documentado.

### 4. Comparar Antes de Presentar

Antes de reunión con cliente:
1. Genera comparación entre versiones
2. Export PDF
3. Prepara explicación de diferencias
4. Lleva ambos PDFs impresos

Cliente valora transparencia y claridad.

### 5. No Dupliques Excesivamente

No necesitas nueva versión para cada pequeño cambio.
- ✅ Agrupa cambios relacionados
- ❌ No hagas v2.0 por cambiar 1 herraje

Guía: Nueva versión cuando hay cambio significativo que cliente debe aprobar.

## 🔄 Flujo de Trabajo Recomendado

### Proyecto Nuevo
1. Crea proyecto → Automáticamente es v1.0
2. Diseñas completo
3. Envías cotización al cliente

### Cliente Pide Cambios
4. Cliente: "Elimina 2 gabinets"
5. Duplicate v1.0 → v2.0 "Client Revision"
6. Eliminas los 2 gabinets
7. Compare v1.0 vs v2.0
8. Export PDF comparación
9. Envías nuevo PDF

### Cliente Aprueba v2.0
10. Marca v2.0 como Current
11. Imprimes PDF final de v2.0
12. Cliente firma

### Proyecto en Producción
13. Trabajas con v2.0 como referencia
14. Si cliente pide otro cambio, repites proceso

### 6 Meses Después: Reparación
15. Cliente regresa para agregar gabinets
16. Duplicate v2.0 (la que se instaló)
17. ✅ Marca "Update prices to current"
18. Diseñas los gabinets nuevos
19. v3.0 tiene precios actuales
20. Compare v2.0 vs v3.0 para mostrar diferencias

## ❓ Preguntas Frecuentes

**P: ¿Puedo tener versiones ilimitadas?**
R: Sí, no hay límite. Pero recomiendo máximo 5-6 por proyecto.

**P: ¿Si cambio a v1.0 se pierde v3.0?**
R: NO. Todas las versiones permanecen. Solo cambias cuál estás viendo/editando.

**P: ¿Puedo editar v2.0 mientras estoy en v3.0?**
R: No directamente. Cambia v2.0 a Current, edita, regresa v3.0 a Current.

**P: ¿Qué pasa con proyectos viejos sin versiones?**
R: El sistema automáticamente los migró a v1.0 "Initial Version".

**P: ¿Update prices cambia mi price_list?**
R: NO. Solo usa los precios actuales de price_list. No modifica price_list.

**P: ¿Puedo duplicar v2.0 basado en v1.0?**
R: Sí. En Source Version selecciona v1.0 aunque estés viendo v2.0.

**P: ¿Se duplican las notas de áreas/gabinets?**
R: Sí, TODO se duplica: áreas, gabinets, items, configuraciones, notas.

**P: ¿Funciona con proyectos RTA?**
R: Sí, el flag is_rta se duplica correctamente.

**P: ¿Puedo exportar versión que no es Current?**
R: Sí. Cambia a esa versión, exports PDF, regresa a Current.

## 🎓 Resumen Ejecutivo

El sistema de versionado te permite:

1. ✅ Mantener historial completo de cotizaciones
2. ✅ Actualizar precios automáticamente en proyectos antiguos
3. ✅ Ofrecer múltiples opciones al cliente
4. ✅ Justificar aumentos de precio con datos
5. ✅ Nunca perder una cotización anterior
6. ✅ Comparar versiones visualmente
7. ✅ Documentar cambios con notas
8. ✅ Exportar cualquier versión a PDF

**Usa versiones cada vez que:**
- Cliente pide cambios significativos
- Retomas proyecto después de semanas
- Quieres ofrecer opciones (premium/económica)
- Precios cambiaron y necesitas recotizar

**NO uses versiones para:**
- Pequeños ajustes cosméticos
- Corregir errores de captura
- Cambios menores que cliente no verá

¡Ahora cotiza con confianza! 🚀
