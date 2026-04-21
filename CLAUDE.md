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

## Design System — Glass Morphism (Light + Midnight)

Evita ships **two themes** driven by a CSS custom-property token system:

- **Light** — glass on pastel indigo/violet gradient (legacy default).
- **Midnight** — glass on deep navy gradient with radial indigo/violet orbs.

The user picks Light / Midnight / System (follows OS `prefers-color-scheme`) via the 3-state toggle in the Topbar, mirrored in the user menu. The preference persists in `localStorage('evita:theme')`. A pre-paint inline script in `index.html` resolves the attribute before CSS loads — there is **no FOUC on reload**.

### How the system works
1. All colors live as CSS vars in `src/index.css` under `:root` / `[data-theme="light"]` / `[data-theme="midnight"]`.
2. `tailwind.config.js` maps them to `theme.extend.colors` (+ `backgroundImage`, `boxShadow`, `ringColor`) so components use short aliases: `bg-surf-card`, `text-fg-900`, `shadow-card`, `bg-accent-primary`, etc.
3. Swapping the palette (or adding a future theme) means editing `src/index.css` only — no component changes required.
4. **Do NOT use Tailwind `dark:` variants.** Themes are driven by `[data-theme]`, not `.dark`. A `dark:` class won't fire.
5. `@media print` forces Light tokens on every theme — quotations never print on dark paper.
6. `prefers-reduced-motion` disables the blanket theme transition; component-level animations still run.

**Full token reference: [`docs/design/midnight-glass-tokens.md`](docs/design/midnight-glass-tokens.md).** Read this before introducing new UI surfaces so you know which token to pick.

### App background
`bg-app-gradient` utility (reads `var(--gradient-app)`) — Light = pastel gradient, Midnight = navy + radial orbs. The `.app-bg` legacy class is preserved and reads the same token.

### Glass surface classes (defined in `src/index.css`)
All glass classes read tokens internally — their RGBA flips per theme. Class names stay stable.

| Class | Token source | Use for |
|-------|--------------|---------|
| `glass-white` | `--surf-card` | Cards, panels, modals, forms |
| `glass-blue` | `--surf-blue` | Informational sections |
| `glass-indigo` | `--surf-indigo` | Hero sections, headers, highlights |
| `glass-green` | `--surf-green` | Success/positive feedback |
| `glass-nav` | `--surf-chrome` | Top navigation bar |

### Semantic token aliases (preferred for new code)
| Alias | Purpose |
|-------|---------|
| `bg-surf-{app,card,chrome,rail,projhdr,input,btn,btn-hover,muted,hover}` | Contextual surfaces |
| `text-fg-{300..900}` / `text-fg-inverse` | Foreground ramp (highest contrast = fg-900) |
| `border-border-{hair,soft,solid,input,rail}` | Borders per context |
| `bg-accent-primary` (gradient) / `bg-accent-secondary` (hover) | Brand gradient buttons, active pills |
| `bg-accent-tint-{soft,strong,card}` / `text-accent-text` | Indigo-tinted surfaces + accent text |
| `bg-accent-badge-bg` / `text-accent-badge-fg` | Sidebar count pills |
| `bg-status-{orange,amber,emerald,red,indigo}-{bg,fg,brd}` | Status chips (Estimating/Stale/Sent/Approved/...) |
| `text-red-dot` / `bg-red-dot` | Danger/destructive — adapts per theme |
| `shadow-{card,card-blue,card-green,rail,btn,btn-hover,seg-active,login-card}` | Pre-themed elevations |
| `ring-focus` / `outline-focus` | Keyboard focus indicator (theme-aware) |

**New status type not in the set** (Won/Lost/Archived/Sent/...)? Add `--status-{name}-{bg,fg,brd}` to **both** `[data-theme="light"]` and `[data-theme="midnight"]` in `src/index.css` **before** using it in JSX, and register Tailwind aliases under `theme.extend.colors.status` in `tailwind.config.js`.

### Buttons
| Class / primitive | Variant |
|-------|-------|
| `<Button variant="primary">` | `bg-accent-primary text-accent-on shadow-btn` — gradient adapts per theme |
| `<Button variant="secondary">` | `bg-surf-btn text-fg-800 border border-border-soft` |
| `<Button variant="danger">` | `bg-red-dot text-white` |
| `<Button variant="ghost">` | `text-fg-700 hover:bg-surf-hover` |
| `<Button variant="outline">` | `border border-border-solid text-fg-700` |
| `btn-primary-glass` class | Legacy — gradient + shadow, tokenized |

### Modal pattern
- Portal-rendered (`createPortal`)
- Backdrop: `bg-modal-backdrop backdrop-blur-[2px]` (themed overlay — `rgba(0,0,0,0.3)` light, `rgba(0,0,0,0.55)` midnight)
- Content: `glass-white` (token-backed) with `border-radius: 16px`
- Sizes: sm (md), md (2xl), lg (4xl), xl (6xl)
- Header: `border-b border-border-soft`

### Data colors (stay theme-agnostic — do NOT tokenize)
Some colors are **data identity** and should stay hardcoded across both themes:

- **Chart material fills** — `COLOR_PALETTE` in `src/components/ProjectCharts.tsx` uses Tailwind class strings → hex; material colors for cabinets (blue = Box Material, green = Pallets, etc.) stay identical in both themes. Only axis/grid/tooltip use tokens (`--chart-axis`, `--chart-grid`, `--chart-tooltip-*`).
- **Avatar gradients** — `lib/avatarColors.ts` seed colors per team member.
- **Save-success emerald button** (`FloatingActionBar.tsx`) — intentional success indicator, readable on both themes.
- **Category-coded icons** in toolbars (Materials = `#0891b2` cyan, Prices = `#7c3aed` violet) — same reasoning.

Everything else must use tokens.

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
1. **Use tokens, never hardcode colors.** Forbidden in new code: `bg-white`, `bg-slate-*`, `text-slate-*`, `text-black`, `border-slate-*`, `from-indigo-500`, `to-blue-500`, `bg-indigo-50`, `text-blue-900`, raw hex (`#fff`, `#0f172a`), raw rgba (`rgba(255,255,255,0.7)`), and any `text-{color}-{800,900}`. Use the semantic aliases above (`bg-surf-card`, `text-fg-900`, `bg-accent-primary`, `bg-status-amber-bg`, etc.).
2. **Never use Tailwind `dark:` variants.** Themes run off `[data-theme]` + CSS vars.
3. **Never inline** `style={{ background: 'rgba(...)' }}` or `{ color: '#...' }` for theming. If dynamic, use `style={{ background: 'var(--surf-card)' }}`.
4. **Glass containers** — use `glass-white` / `glass-blue` / `glass-indigo` / `glass-green` for panels, cards, modals. Never `bg-surf-card` + manual border + blur + shadow — the utility class does it with one name.
5. **Border radius:** 14px (glass classes) or `rounded-lg` / `rounded-xl` for smaller elements.
6. **Shadows:** `shadow-card` / `shadow-btn` / `shadow-rail` — never `shadow-lg`/`shadow-xl`, which skip the token.
7. **New sections:** wrap in a glass class + appropriate animation class (`section-enter`, `card-enter`).
8. **Tables:** no full borders — use `border-b border-border-soft` for row separation.
9. **Loading states:** use `skeleton-shimmer` class, not spinners (except for action buttons).
10. **Focus indicators:** `focus-visible:ring-2 focus-visible:ring-focus` — the `focus` ring color adapts per theme.
11. **Consistent spacing:** `px-4 sm:px-6 lg:px-8` for page-level, `p-4 sm:p-6` for cards.
12. **Responsive:** always mobile-first, glass panels stack on mobile.
13. **Scrollbar:** use `scrollbar-none` for hidden scrollbars where appropriate.

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
│   ├── takeoff/           # Evita Takeoff — PDF takeoff tool (calibration, measurements, overlays)
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
│   ├── takeoff/           # PDF geometry & transforms (Evita Takeoff)
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
/tools/takeoff                                → TakeoffPage (ex Plan Viewer, legacy /tools/plan-viewer redirects here)
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

### Refactor / dead-code lessons (learned April 2026)
1. **`tsc --noEmit` only flags unused locals within a file, not unused exports across files.**
   When a refactor replaces a page or component, the predecessor often survives as an orphaned file that imports its own private dependencies — none of it triggers a typecheck error. Found 5 such orphans (~2,300 lines) on `fix/typecheck-baseline` in April 2026 (`Projects.tsx`, `ProjectGroupCard.tsx`, `ProjectGroupListItem.tsx`, `ImportProjectModal.tsx`, `projectGrouping.ts`).
   - Before assuming a file is alive, run `grep -rln "from.*pageOrComponentName" src/` to confirm at least one active importer exists.
   - Consider adding `ts-prune` or `knip` to detect unused exports as a CI/pre-commit step.

2. **Page/route refactors must `git rm` the predecessor in the same PR.**
   When introducing a new file at the same route (e.g., `ProjectsHub.tsx` replacing `Projects.tsx` at `/projects`), do NOT leave the old file behind — it accumulates dead UI and dead bug fixes that mislead future debugging. Either:
   - Delete the old file in the same PR that adds the new one, OR
   - Rename the old file to something obviously dead (e.g., `Projects.legacy.tsx`) and tag it with `// @deprecated DELETE ME` so the next cleanup pass catches it.

3. **Schema refactors must leave a migration artifact for every DROP/CREATE.**
   The `group_id` column was added in migration `20260118022123_add_group_id_to_projects.sql` and silently disappeared during the projects-table recreate that introduced the projects/quotations split. No migration file documents the loss, leaving the registered migration permanently out of sync with the actual schema. Future schema refactors must commit a migration with the explicit DDL (DROP/RECREATE/ALTER) so `supabase_migrations.schema_migrations` stays consistent with reality.

### Theming system — live (Midnight Glass, shipped Apr 2026 via PR #43)

The platform runs on a two-theme token system:

- **Tokens** live on `:root` / `[data-theme="light"]` / `[data-theme="midnight"]` in `src/index.css`.
- **Tailwind aliases** (`bg-surf-card`, `text-fg-900`, `bg-accent-primary`, `bg-status-amber-bg`, etc.) are registered in `tailwind.config.js` under `theme.extend.colors` / `backgroundImage` / `boxShadow` / `ringColor`.
- **Runtime** is orchestrated by `src/hooks/useTheme.ts` (3-state `light|midnight|system` preference stored in `localStorage('evita:theme')`, subscribed to `matchMedia('(prefers-color-scheme: dark)')` when in `system`). The inline `<head>` script in `index.html` applies `data-theme` pre-paint to avoid FOUC. `<ThemeToggle />` lives in the Topbar and mirrors in the user menu.
- **Raw `<input>` / `<textarea>` / `<select>`** without a bg class fall back to `var(--surf-input)` via an `@layer base` rule in `src/index.css`. No manual guard needed.
- **Print** — an `@media print { [data-theme] { --*: light values } }` block forces Light on paper.

**When building anything new, always:**

1. **Start with glass classes** (`glass-white` / `glass-blue` / `glass-indigo` / `glass-green`) for containers, or the short token aliases (`bg-surf-card`, `text-fg-900`, `border-border-soft`, etc.). Never `bg-white`, `bg-slate-*`, `text-slate-*`, `text-blue-900`, raw hex, or `rgba(255,...)`.
2. **Primary action button gradient** → `bg-accent-primary text-accent-on shadow-btn`. Never `bg-gradient-to-r from-indigo-500 to-blue-500`.
3. **Status chips** → use `bg-status-{kind}-bg text-status-{kind}-fg border-status-{kind}-brd`. If the status is new, add the token triple to `src/index.css` for both themes first, then register under `theme.extend.colors.status` in `tailwind.config.js`.
4. **Charts** — material fills + avatars + category icons stay theme-agnostic (data identity). Axis/grid/tooltip use `--chart-*` tokens. Follow the `COLOR_PALETTE` pattern in `ProjectCharts.tsx` if you add a new chart.
5. **Focus rings** → `focus-visible:ring-2 focus-visible:ring-focus`.
6. **Logo** → `filter: var(--logo-filter)` (tints indigo on Light, inverts to white on Midnight — works on both).
7. **NEVER** introduce inline `style={{ background: 'rgba(255,255,255,0.X)' }}` or hex colors. If you need a dynamic value, reference a var: `style={{ background: 'var(--surf-card)' }}`.
8. **NEVER** use `dark:` Tailwind variants. They won't fire because themes run off `[data-theme]`.

### Adding a new theme token (playbook)

1. Name it semantically (`--status-won-bg`, not `--emerald-600`).
2. Define the value in **both** `:root/[data-theme="light"]` and `[data-theme="midnight"]` blocks in `src/index.css`. Also add the Light value under the `@media print` override block if the surface can appear in printed output.
3. Register a Tailwind alias under `theme.extend.colors` (or `backgroundImage` / `boxShadow`) in `tailwind.config.js`.
4. Document it under the appropriate group in `docs/design/midnight-glass-tokens.md`.
5. Use the alias in JSX — never reach past it to the raw var unless you need a CSS-only context (e.g., inside `style={{}}` for dynamic values).

### QA checklist for new UI work

Before considering a feature "done":
- [ ] Toggle the theme (Topbar) and confirm every new surface reads correctly in both Light and Midnight.
- [ ] Hard-reload in Midnight — no white flash.
- [ ] `Cmd+P` / Print — forces Light, no dark backgrounds in the PDF preview.
- [ ] Focus rings visible in both themes.
- [ ] `grep` the changed files for `bg-white`, `text-slate-`, `from-indigo-`, `rgba(255,` — should be zero matches on new code.

---

## Rules for Claude Code

### Must follow
1. **DO NOT** modify business constants without explicit confirmation from Alberto
2. **DO NOT** rename the projectId ↔ quotation naming mismatch
3. **DO NOT** refactor large components (>500 lines) unless explicitly asked
4. **DO NOT** introduce new CSS frameworks, component libraries, or design patterns
5. **DO NOT** change the edge function without providing the complete `index.ts`
6. **DO NOT** hardcode colors — no `bg-white`, `bg-slate-*`, `text-slate-*`, `text-blue-900`, `from-indigo-500`, `#hex`, or `rgba(255,...)` in new code. Use semantic tokens (`bg-surf-card`, `text-fg-900`, `bg-accent-primary`, `bg-status-*`). See the Design System section above.
7. **DO NOT** use Tailwind `dark:` variants — themes run off `[data-theme]`, `dark:` won't fire.
8. **ALWAYS** use glass morphism classes for any new UI container (`glass-white` / `glass-blue` / `glass-indigo` / `glass-green`)
9. **ALWAYS** maintain lazy-loading for new pages
10. **ALWAYS** use Tailwind CSS — no CSS modules, styled-components, or inline styles for layout; inline `style={{}}` only for dynamic values, and those must reference `var(--token)` (not raw colors)
11. **ALWAYS** run `npm run typecheck` before confirming type changes
12. **ALWAYS** write English labels for any new UI text
13. **ALWAYS** verify both themes (Light + Midnight) before declaring a UI change done — toggle via the Topbar switch

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
- Evita Takeoff (ex Plan Viewer): functional (PDF measurement + takeoff tool)
