# Evita MCP Server

MCP (Model Context Protocol) server para la plataforma Evita Cabinets. Expone **21 tools** de lectura + cómputo a clientes MCP (Claude Desktop, Claude Code) vía stdio.

Corre localmente en la máquina de Alberto. No escribe a la DB (solo lectura + cálculos puros).

## Tools disponibles

### Búsqueda
- `search_materials` — price_list (ILIKE sobre concept_description).
- `search_products` — products_catalog (ILIKE sobre sku/description).
- `search_prefab_catalog` — Venus / Northville con precios por acabado.
- `search_suppliers` — por nombre.

### Knowledge Base / Wiki
- `search_kb` / `get_kb_entry` — FTS spanish con fallback ILIKE.
- `search_wiki` / `get_wiki_article` — ídem para procedimientos/QC.

### Proyectos
- `list_projects` — hub entities.
- `get_project` — proyecto + quotations.
- `list_project_areas` — áreas de una quotation (el `quotation_id` es lo que el frontend llama `projectId`).
- `get_area_cabinets` — cabinets de un área con materiales resueltos.
- `get_all_cabinets` — sumario agregado de toda la quotation (SKU counts + hardware agregado).

### Inventario
- `get_inventory_stock` — stock + average_cost + stock_location.
- `get_low_stock_items` — items por debajo del mínimo.
- `get_purchase_items` — purchase list por proyecto.

### Cómputo (lógica pura de `src/lib/`)
- `get_settings` — labor, waste, FX (cache 5 min).
- `parse_sku_metadata` — parser CDS: serie, dimensiones, doors/drawers/sink/shelves.
- `compute_cut_list` — corre `computeCutList` sobre un producto del catálogo.
- `get_cabinet_total_cost` — recompute en vivo desde los 15 campos de costo; detecta drift vs `subtotal` cached.
- `compute_quotation_totals` — corre `computeQuotationTotalsSqft` en vivo; compara contra `quotations.total_amount`.

## Setup

### 1. Instalar dependencias y buildear

```bash
cd mcp-server
npm install
npm run build
```

Eso produce `mcp-server/dist/index.js`.

### 2. Configurar env vars

Copiá `.env.example` a `.env`:
```bash
cp .env.example .env
```

Edita `.env` y pegá el **service_role key** de Supabase Dashboard → Settings → API → Project API keys.

> ⚠️ `service_role` bypassa RLS. Aceptable para uso local single-user. Si algún día se hostea remoto, cambiar a auth per-user.

### 3. Registrar en Claude Desktop

Archivo: `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

```json
{
  "mcpServers": {
    "evita": {
      "command": "node",
      "args": [
        "C:/Users/alber/OneDrive/Documents/GitHub/evita-cabinets/mcp-server/dist/index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://rludrzyrpsotvzizlztg.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOi..."
      }
    }
  }
}
```

Reiniciá Claude Desktop. En el icono del slider (abajo-derecha del input) debería aparecer **evita** con sus 21 tools.

### 4. Registrar en Claude Code

Archivo: `.claude/mcp.json` en el repo, o en settings globales del usuario (`~/.claude/mcp.json`). Mismo formato que arriba.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Watch + reload con `tsx` |
| `npm run build` | Bundlea a `dist/index.js` via tsup |
| `npm run start` | Corre el bundle ya buildeado |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run inspector` | Abre MCP Inspector contra el bundle — UI local para probar tools manualmente |

## Verificación manual

Smoke test sin cliente MCP — envía `initialize` + `tools/list` por stdio:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | node dist/index.js
```

Con `npm run inspector` obtenés una UI más amigable para invocar cada tool con args.

## Arquitectura

- **Runtime:** Node.js 20+, ESM, `@modelcontextprotocol/sdk`.
- **Transport:** stdio.
- **Reutilización de `src/lib/`:** vía path alias `@evita-lib/*` que apunta a `../src/lib/*`. tsup bundlea los módulos puros (`cabinet/`, `pricing/`, `calculations.ts`) junto con el server.
- **Shims:** `src/shims/supabase.ts` (reemplaza `import.meta.env` por `process.env`) y `src/shims/settings.ts` (reemplaza el Zustand store por función plana con cache 5 min).
- **Auth:** service_role key en env. No valida usuario.

## Limitaciones v1

- ❌ Sin writes a DB (modificaciones se siguen haciendo desde la app o el chat `evita-ia`).
- ❌ Sin optimizer (el engine vive en frontend con dependencias de browser).
- ❌ Sin PDF takeoff (pdfjs-dist requiere worker de browser).
- ❌ Sin resources MCP (solo tools).
- ❌ Sin prompts templated.

Ver `.claude/plans/como-podemos-hacer-un-compiled-candy.md` para el roadmap post-v1.
