# Evita Cabinets — Quotation & Project Management Platform

## About
Evita Cabinets is a millwork, casework, and cabinetry company in Houston, TX.
Alberto Balbuena is the Innovation & Digital Solutions Lead and sole developer.
This platform handles quotation, project management, inventory, and supplier workflows.

## Stack
- **Frontend:** React 18 + TypeScript + Vite 5 + Tailwind CSS 3
- **Backend:** Supabase (PostgreSQL + Edge Functions + Storage + Auth)
- **Auth:** Google OAuth → `team_members` table (`useAuth()` + `useCurrentMember()`)
- **State:** Zustand (`useSettingsStore`, `useAiChatContext`)
- **Rich text:** TipTap (bitácora/log entries with @mentions)
- **Icons:** lucide-react
- **Deploy:** Vercel (auto-deploy from `main` branch)
- **Repo:** github.com/AlbertoBalbuenaB/evita-cabinets
- **Supabase project:** `rludrzyrpsotvzizlztg` (us-east-1)
- **Edge function:** `evita-ia` (v42) — AI chat with tool-use (search_materials, search_products)
- **Tests:** Vitest — run `npm test`
- **Type check:** `npm run typecheck`

## Language Rules
- **Code, variables, components:** English
- **UI labels, buttons, headings:** English (entire interface is in English)
- **Communication with Alberto:** Spanish
- **Executive deliverables:** English

---

## Design System — Glass Morphism Light

All UI must follow the established Glass Morphism Light design language. Never introduce opaque containers, dark backgrounds, or Material/Bootstrap patterns.

### App Background
```css
.app-bg {
  background: linear-gradient(135deg, #e8f0fe 0%, #f0f4ff 30%, #faf5ff 60%, #f0f9ff 100%);
  min-height: 100vh;
}
```

### Glass Surface Classes (defined in index.css @layer utilities)
| Class | Usage | Properties |
|-------|-------|------------|
| `glass-white` | Cards, panels, modals, forms | `bg: rgba(255,255,255,0.65)`, `backdrop-blur(20px)`, `border: 1px solid rgba(255,255,255,0.85)`, `border-radius: 14px`, `shadow: 0 2px 12px rgba(99,102,241,0.08)` |
| `glass-blue` | Informational sections | `bg: rgba(219,234,254,0.6)`, `border: rgba(147,197,253,0.5)` |
| `glass-indigo` | Hero sections, headers, highlights | `bg: rgba(224,231,255,0.6)`, `border: rgba(165,180,252,0.5)` |
| `glass-green` | Success/positive feedback | `bg: rgba(209,250,229,0.55)`, `border: rgba(110,231,183,0.5)` |
| `glass-nav` | Top navigation bar | `bg: rgba(255,255,255,0.75)`, `backdrop-blur(24px)`, no border-radius |

### Buttons
| Class | Usage |
|-------|-------|
| `btn-primary-glass` | Primary actions — gradient `#6366f1 → #3b82f6`, white text, indigo shadow |
| `Button` component | Variants: `primary` (blue-600), `secondary` (slate-200), `danger` (red-600), `ghost`, `outline` — all `rounded-lg` |

### Modal Pattern
- Portal-rendered (`createPortal`)
- Backdrop: `bg-black bg-opacity-30 backdrop-blur-[2px]`
- Content: `glass-white` with `border-radius: 16px`
- Sizes: sm (md), md (2xl), lg (4xl), xl (6xl)
- Header with border-bottom `border-slate-200/60`

### Color Palette (Tailwind defaults, no custom theme)
- **Primary:** indigo-600 / blue-600 spectrum
- **Text:** slate-900 (headings), slate-700 (body), slate-500 (secondary), slate-400 (muted)
- **Accents:** emerald (success), amber (warning), red (danger), purple (special)
- **Backgrounds:** slate-50, white/65 (glass), blue-50/70, indigo-50/60

### Animation System (CSS @layer utilities)
| Class | Effect | Use for |
|-------|--------|---------|
| `page-enter` | fade-in 0.4s | Page transitions |
| `section-enter` | fade-in 0.35s | Section reveals |
| `card-enter` | fade + translateY + scale 0.35s | Card grids |
| `stat-enter` | scale pop 0.4s | Stat number cards |
| `hero-enter` | fade-in 0.4s | Hero banners |
| `tab-enter-left/right` | fade + translateX 0.32s | Tab content switches |
| `row-enter` | fade + translateX(-8px) 0.25s | Table row reveals |
| `skeleton-shimmer` | shimmer gradient animation | Loading states |
| `stagger-1` to `stagger-12` | animation-delay increments of 0.03s | Card grid staggering |
| `task-enter` | slide up 0.2s | Task cards |
| `panel-enter` | slide from right 0.25s | Detail panels |

### Login Page (reference for premium glass)
- Animated gradient orbs + floating particles
- Card: `backdrop-blur-2xl bg-white/70 rounded-[28px] border-white/60`
- Glow ring: gradient `from-indigo-300/30 to-violet-300/30` with shimmer

### Design Rules for Claude Code
1. **Always use glass classes** — never `bg-white` for containers, use `glass-white` instead
2. **Border radius:** 14px (glass classes) or `rounded-lg`/`rounded-xl` for smaller elements
3. **Shadows:** subtle indigo-tinted, never heavy `shadow-lg`
4. **New sections:** wrap in `glass-white` or `glass-indigo` with appropriate animation class
5. **Tables:** no full borders — use `border-b border-slate-200/60` for row separation
6. **Loading states:** use `skeleton-shimmer` class, not spinners (except for action buttons)
7. **Consistent spacing:** `px-4 sm:px-6 lg:px-8` for page-level, `p-4 sm:p-6` for cards
8. **Responsive:** always mobile-first, glass panels stack on mobile
9. **Scrollbar:** use `scrollbar-none` for hidden scrollbars where appropriate

### Reusable Components
| Component | Location | Notes |
|-----------|----------|-------|
| `Button` | `components/Button.tsx` | 5 variants × 3 sizes |
| `Input` | `components/Input.tsx` | With label + error support |
| `Modal` | `components/Modal.tsx` | Portal + glass + 4 sizes |
| `SectionDivider` | `components/SectionDivider.tsx` | Draggable area dividers |
| `AutocompleteSelect` | `components/AutocompleteSelect.tsx` | Searchable dropdown |
| `EdgeBandPopover` | `components/EdgeBandPopover.tsx` | Cubrecanto detail popup |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | Error catch wrapper |

---

## Project Structure
```
src/
├── components/            # UI components
│   ├── inventory/         # Stock tables, movement modals
│   ├── optimizer/         # Cut list optimizer UI
│   │   └── quotation/     # Optimizer ↔ quotation pricing integration
│   ├── plan-viewer/       # PDF measurement tool (calibration, overlays)
│   └── purchases/         # Purchase/consume inventory modals
├── lib/                   # Business logic
│   ├── auth.ts            # Google OAuth (useAuth hook)
│   ├── supabase.ts        # Supabase client (typed)
│   ├── database.types.ts  # Auto-generated from Supabase (91k)
│   ├── calculations.ts    # Pricing: box/door SF, edgeband, labor, hardware
│   ├── settingsStore.ts   # Zustand store — labor, waste, FX (5min cache)
│   ├── cabinet/           # Cut list engine
│   │   ├── computeCutList.ts       # CutPiece generation from product
│   │   ├── fromCatalogProduct.ts   # Product → cabinet data mapper
│   │   └── parseProductMetadata.ts # SKU/dimension parser
│   ├── optimizer/         # Nesting engine (engine.ts = 70k)
│   │   └── quotation/     # Optimizer-based pricing alternative
│   ├── pricing/           # Sqft-based totals (computeQuotationTotalsSqft)
│   ├── plan-viewer/       # PDF geometry & transforms
│   ├── templateManager.ts # Reusable cabinet configurations
│   ├── versioningSystem.ts # Quotation version snapshots
│   ├── sheetMaterials.ts  # Sheet material calcs
│   ├── edgebandRolls.ts   # Edgeband roll tracking
│   ├── prefabImport.ts    # Venus/Northville prefab catalog import
│   ├── prefabCodeDecoder.ts # Prefab SKU parser
│   ├── collectionManager.ts # Area collection grouping
│   ├── projectBrief.ts    # Project summary generator
│   ├── notifications.ts   # Notification system
│   └── useCurrentMember.ts # Team member hook (role-based access)
├── pages/                 # Route views (all lazy-loaded)
│   ├── HomePage.tsx        # Landing + tasks + logs (82k)
│   ├── ProjectDetails.tsx  # Quotation detail — most complex (147k)
│   ├── ProjectPage.tsx     # Project hub with tabs (35k)
│   ├── Projects.tsx        # Project list + grouping (49k)
│   ├── ProductsCatalog.tsx # 1518 CDS products (50k)
│   ├── PriceList.tsx       # Material/hardware pricing (49k)
│   ├── Settings.tsx        # Admin settings (44k)
│   ├── Templates.tsx       # Reusable templates (27k)
│   ├── Suppliers.tsx       # Supplier management (27k)
│   └── OptimizerPage.tsx   # Standalone optimizer (19k)
├── stores/                # Zustand stores
│   └── aiChatContext.ts   # Active project tab for AI context
├── types/index.ts         # All TypeScript interfaces (18k)
└── utils/                 # Export/import/print utilities
    ├── projectExportImport.ts # .evita.json export/import (26k)
    ├── printQuotation.ts      # PDF generation (37k)
    └── backupExport.ts        # Full project backup

supabase/
├── functions/evita-ia/index.ts  # Edge function — single file (86k)
└── migrations/                  # 140+ SQL migrations (Oct 2025 – Apr 2026)

data/prefab/                     # Seed CSVs for Venus/Northville catalogs
```

## Routes
```
/                                             → HomePage
/dashboard                                    → Dashboard (analytics)
/projects                                     → ProjectsHub
/projects/:projectId                          → ProjectPage (hub + tabs)
/projects/:projectId/quotations/:quotationId  → QuotationDetailsPage
/products                                     → ProductsCatalog
/products/:id                                 → ProductItem
/prices                                       → PriceList (+ inventory)
/prices/:id                                   → PriceListItem
/templates                                    → Templates
/optimizer                                    → OptimizerPage
/tools                                        → ToolsHub
/tools/plan-viewer                            → PlanViewerPage
/suppliers                                    → Suppliers
/suppliers/:id                                → SupplierPage
/settings                                     → Settings (admin only)
```

## Code-Splitting
All pages lazy-loaded via `React.lazy()` + `Suspense` in App.tsx.
`AdminRoute` wrapper restricts `/settings` to `member.role === 'admin'`.
AiChat renders as a global floating component outside `<Routes>`.

---

## Database Hierarchy
```
projects (hub entity)
  ├── quotations (pricing versions)
  │     ├── project_areas
  │     │     ├── area_cabinets       — CDS cabinets with full material assignment
  │     │     ├── area_items          — Line items from price_list
  │     │     ├── area_countertops    — Countertop items
  │     │     ├── area_closet_items   — Evita Plus/Premium closet items
  │     │     └── area_prefab_items   — Venus/Northville prefab items (newest)
  │     ├── quotation_optimizer_runs  — Nesting optimizer results
  │     ├── project_versions          — Quotation snapshots
  │     └── project_price_staleness   — Price freshness tracking
  ├── project_documents               — Shared docs (hub level)
  ├── project_tasks                   — Task management (personal + project)
  ├── project_activities              — Schedule/timeline
  └── project_logs                    — Bitácora entries (TipTap rich text)

Standalone:
  products_catalog      — 1518 CDS products (SKU, SF, edgeband, cut_pieces)
  price_list            — Materials, hardware, edgeband, accessories
  closet_catalog        — Evita Plus / Evita Premium closet system
  prefab_brand          — Venus, Northville
  prefab_catalog        — Prefab product definitions
  prefab_catalog_price  — Finish-based pricing with effective dates
  team_members          — Auth users (auth_user_id → Supabase auth)
  suppliers             — Supplier entities
  price_list_suppliers  — Junction table (price_list ↔ suppliers)
  inventory_movements   — Stock in/out tracking
  project_purchase_items — Purchase list per project
  settings              — App-wide config (exchange_rate, labor, waste, taxes)
```

### ⚠️ Critical Naming Mismatch
`projectId` in frontend URL params = `quotations.id` in database.
This is **intentional and preserved** — do NOT rename or "fix" this.

---

## Business Constants (PRESERVE EXACTLY)
```
Waste factors:       box × 1.10, door × 1.60
Labor costs:         $400 MXN (no drawers), $600 MXN (with drawers), $100 (accessories/460 series)
Exchange rate (FX):  17 MXN/USD (DB-configurable via settings table)
Sheet size default:  32 SF (4×8 ft)

Material IDs (price_list UUIDs):
  box_mat    = f4953b9f  → $550 MXN / 32SF
  door_mat   = d0eb99a2  → $1,250 MXN / 32SF
  box_eb     = 6d877ed9  → $8.30 MXN/m
  door_eb    = e3e9c098  → $11.30 MXN/m
  blum       = bfeb4500  → $130 MXN
  stetik     = 79dfa4d0  → $626.63 MXN

NOT APPLY IDs (for cabinets without doors/box):
  mat        = b7e31784
  eb         = 2ddf271c

Rule: Closets without doors AND 460 series without box →
  use NOT APPLY for doors_material_id + doors_edgeband_id
  (and box_material_id + box_edgeband_id if no box applies)
```

## Settings Store Defaults (code fallbacks if DB empty)
```
laborCostNoDrawers:    400
laborCostWithDrawers:  600
laborCostAccessories:  100
wastePercentageBox:    10
wastePercentageDoors:  10
exchangeRateUsdToMxn:  18
```
Note: Production values may differ from code defaults — settings table is authoritative.

---

## CDS (Cabinet Design Series — AWI/NAAWS)
Standard frameless cabinet numbering system:
- **100 series:** Base cabinets without drawers
- **200 series:** Base cabinets with drawers
- **300 series:** Wall hung cabinets
- **400 series:** Tall storage cabinets
- **500 series:** Tall wardrobe cabinets

SKU format: `{series}-{width}×{height}×{depth}` (e.g., `102-36×30×18`)
Suffix "M" = modified design (e.g., `102M` = 102 with extra shelf)

## Cut List / Fabrication Rules

### Cubrecanto (edgeband) mapping
0 = none, 1 = Type A (Box EB $8.30/m), 2 = Type B (Doors EB $11.30/m)

### Edgeband per piece type {sup, inf, izq, der}
- Side Panels: `{2,1,1,1}` base/tall; `{2,2,1,1}` wall
- Top/Bottom: `{2,0,0,0}`
- Back: `{1,1,0,0}`
- Fixed Shelves: `{1,0,0,0}`
- Adjustable Shelves: `{1,1,1,1}`
- Doors/Drawer Faces: `{2,2,2,2}`
- Drawer Box Sides: `{1,1,0,0}`
- Drawer Box Ends/Bottom: `{0,0,0,0}`

### Material rules
- Drawer box thickness: always 15mm (drawer face uses door material)
- Depth optimization: 12"→300mm, 16"→400mm, 24"→600mm
- Grain (veta): Sides/Back/Doors = vertical, Top/Bottom/Shelves/Rails = horizontal, Drawer internals = none

### Pricing methods
1. **sqft** (default): Square footage with waste factors
2. **optimizer**: Based on actual nesting optimizer runs (real board count)

---

## Prefab Library (newest feature)
Parallel catalog for reseller brands (Venus, Northville) — no despiece/waste/labor.
Tables: `prefab_brand` → `prefab_catalog` → `prefab_catalog_price` (finish-based)
Area items: `area_prefab_items` (linked to `project_areas`)

---

## Environment Variables
```
VITE_SUPABASE_URL=         # Supabase project URL
VITE_SUPABASE_ANON_KEY=    # Supabase anon/public key
VITE_EVITA_IA_URL=         # Edge function URL
VITE_EVITA_IA_SECRET=      # Edge function auth key
VITE_ANTHROPIC_API_KEY=    # Optional: direct Claude API for in-app AI
```

## Supabase Notes
- PostgREST hard-caps at 1,000 rows regardless of `.limit()` — use paginated `.range()` calls
- Edge function deployment requires full `index.ts` content as single file (86k)
- 140+ migrations from Oct 2025 to Apr 2026
- Edge function has modification-intent detection for safe AI operations

---

## Supabase Workflow

### Tool split — when to use MCP vs Supabase CLI
| Task | Tool |
|------|------|
| DDL / schema migrations | MCP `apply_migration` |
| Inspection queries, advisors, Postgres logs | MCP |
| Regenerate `database.types.ts` | MCP `generate_typescript_types` |
| One-off data fixes / UPDATEs | MCP `execute_sql` |
| **Edge function `evita-ia` deploy** | **Supabase CLI** (MCP unreliable for files >50k) |
| **Edge function live logs** | **Supabase CLI** (`supabase functions logs --tail`) |
| **Edge function local debug** | **Supabase CLI** (`supabase functions serve`) |

### DDL / migrations flow
1. Write SQL for the migration
2. Create local file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
3. Apply to production via MCP: `apply_migration(name, query)`
4. If schema changed, regenerate `src/lib/database.types.ts` via `generate_typescript_types`
5. `npm run typecheck`
6. Commit + push the `.sql` (and updated types) to `main`

**Always use `apply_migration` (not `execute_sql`) for DDL** — it registers the migration in `supabase_migrations` so the history stays consistent with the existing 140+ migrations.

### Edge function `evita-ia` flow (CLI)
```bash
# Deploy (after editing supabase/functions/evita-ia/index.ts)
supabase functions deploy evita-ia

# Tail live logs
supabase functions logs evita-ia --tail

# Run locally against production DB for debugging
supabase functions serve evita-ia --env-file supabase/functions/evita-ia/.env
```
- `index.ts` is ~86k and imports inline — no `import_map.json` needed
- Deploy overwrites the active version (currently v35) — no automatic rollback
- For changes >100 lines, confirm with Alberto before deploying

### Data operations
- **< 20 rows:** `execute_sql` with INSERT/UPDATE
- **Bulk import:** seed CSVs live in `data/prefab/` — do NOT commit bulk inserts as migrations
- **Backfills for a new column:** include inside the same DDL migration

### Safety rules (require explicit Alberto confirmation)
- `DROP TABLE` / `DROP COLUMN` / destructive `ALTER TYPE`
- Mutations to `team_members`, `settings`, or hardcoded material UUIDs in `price_list`
- RLS policy changes
- Edge function deploys > 100 changed lines
- Anything marked "PRESERVE EXACTLY" in this file

## Vite Build
Manual chunks configured: vendor-react, vendor-supabase, vendor-xlsx, vendor-pdf, vendor-zip, vendor-pdfjs, vendor-tiptap

## Git
- `main` = production (auto-deploys to Vercel on push)
- Solo developer — direct commits or worktree branches
- `.claude/worktrees/` should be in .gitignore

### Git workflow
- Solo developer — commit directly to `main` unless explicitly asked for a PR
- Always write descriptive commit messages in English
- Do NOT create PRs for routine changes — commit and push directly
- **ALWAYS run `npm run typecheck` before committing any code/type changes** (skip only for pure doc/markdown commits)
- Run `npm test` before committing changes to `lib/cabinet/`, `lib/optimizer/`, or `lib/pricing/`

### When to PROACTIVELY recommend a PR instead of direct commit to main
Claude Code must pause and suggest a PR (with rationale) before committing when a change matches ANY of these:

1. **Database schema changes** — any migration with `DROP`, `ALTER COLUMN TYPE`, or changes to RLS policies
2. **Business constants** — any touch to waste factors, labor costs, FX rate, material UUIDs, or anything in the "Business Constants" section
3. **Edge function `evita-ia`** — any deploy with >100 changed lines, OR changes to tool-use logic, auth, or modification-intent detection
4. **Large refactors** — changes spanning >5 files OR >300 lines of non-trivial code
5. **Core pricing/cut-list logic** — changes to `lib/cabinet/`, `lib/optimizer/engine.ts`, `lib/pricing/`, or `lib/calculations.ts` that affect output values (not just refactors)
6. **Auth / permissions** — changes to `lib/auth.ts`, `useCurrentMember`, `AdminRoute`, or role checks
7. **DB types regeneration** — if `database.types.ts` diff is >500 lines (indicates significant schema drift)
8. **Experimental / uncertain changes** — when Claude is not confident the change works on first try and wants a Vercel Preview Deployment to verify
9. **Deletion of existing features or files** — removing any page, route, component, or table referenced elsewhere
10. **Dependency changes** — adding/removing/upgrading anything in `package.json` (especially React, Vite, Supabase, Tailwind)

**How to phrase the recommendation:**
> "Este cambio toca [razón]. Recomiendo hacerlo en una rama + PR en lugar de commit directo a main porque [beneficio: preview deploy / diff review / rollback seguro]. ¿Procedo con PR o prefieres commit directo a main?"

Wait for explicit approval before committing or opening a PR when one of these conditions is detected.

---

## Rules for Claude Code

### Must follow
1. **DO NOT** modify business constants without explicit confirmation from Alberto
2. **DO NOT** rename the projectId ↔ quotation naming mismatch
3. **DO NOT** refactor large components (>500 lines) unless explicitly asked
4. **DO NOT** introduce new CSS frameworks, component libraries, or design patterns
5. **DO NOT** change the edge function without providing the complete `index.ts`
6. **ALWAYS** use glass morphism classes for any new UI container
7. **ALWAYS** maintain lazy-loading for new pages
8. **ALWAYS** use Tailwind CSS — no CSS modules, styled-components, or inline styles for layout
9. **ALWAYS** run `npm run typecheck` before confirming type changes
10. **ALWAYS** write English labels for any new UI text

### Conventions
- New migrations: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- New components: PascalCase, `.tsx` extension, in `src/components/`
- New pages: lazy-loaded in `App.tsx` with `React.lazy()`
- Currency formatting: use `formatCurrency()` from `lib/calculations.ts`
- Supabase queries: always handle `.error` and use typed client
- Icons: import from `lucide-react` only
- Animations: use existing CSS animation classes from index.css, don't create new ones unless necessary

### Module status
- Quotation module: ~80% complete
- Project Management module: ~50% complete
- Optimizer: functional, integrated with quotation pricing
- Prefab Library: newly added (Apr 2026)
- Supplier/Inventory: functional
- Plan Viewer: functional (PDF measurement tool)
