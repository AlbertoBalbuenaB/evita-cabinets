# Evita Cabinets — Quotation System

Internal quotation management app for millwork, cabinetry, and window shades.

## Stack

- **Frontend:** React 18 + TypeScript + Vite 5 + Tailwind CSS 3
- **Backend:** Supabase (PostgreSQL + Edge Functions + Storage)
- **Deploy:** Netlify / Vercel (auto-deploy from GitHub)

## Setup

```bash
# Clone
git clone https://github.com/YOUR_USER/evita-quotation-app.git
cd evita-quotation-app

# Environment
cp .env.example .env
# Fill in your Supabase URL, anon key, and other values

# Install & run
npm install
npm run dev
```

## Branch Strategy

- `main` — production (auto-deploys)
- `v2-dev` — active development

## Project Structure

```
src/
├── components/     # Reusable UI components
├── lib/            # Business logic, calculations, Supabase client
├── pages/          # Top-level views (Dashboard, Projects, etc.)
├── stores/         # Zustand state stores
├── types/          # TypeScript interfaces
└── utils/          # Export, import, print utilities

supabase/
├── functions/      # Edge functions (evita-ia)
└── migrations/     # Database schema history
```

## Database Schema

### Core Hierarchy

```
projects (hub)                    — Business-level project entity
  ├── quotations (versions)       — Pricing versions (was: projects table)
  │     ├── project_areas         — Areas within a quotation
  │     │     ├── area_cabinets   — Cabinets in an area
  │     │     ├── area_items      — Line items in an area
  │     │     ├── area_countertops
  │     │     └── area_closet_items
  │     ├── project_versions      — Version snapshots
  │     └── project_price_staleness
  │
  ├── project_documents           — Shared docs (hub level)
  ├── project_tasks               — Task management (hub level)
  ├── project_activities          — Schedule/timeline (hub level)
  └── project_logs                — Bitácora/notes (hub level)
```

### Key Tables

| Table | Description | FK Parent |
|-------|-------------|-----------|
| `projects` | Project hub (name, customer, address, type, status) | — |
| `quotations` | Pricing version (financials, areas, totals) | `projects.id` |
| `project_areas` | Areas within a quotation | `quotations.id` |
| `area_cabinets` | Cabinets with materials/costs | `project_areas.id` |
| `products_catalog` | Cabinet product definitions (SKU, SF, edgeband) | — |
| `price_list` | Materials, hardware, edgeband pricing | — |
| `settings` | App-wide settings (exchange rate, labor costs) | — |

### Quotation Fields

Each quotation carries: `project_id`, `version_number`, `version_label`, `name`, `customer`, `address`, `project_type`, `status`, `quote_date`, `total_amount`, `profit_multiplier`, `tariff_multiplier`, `tax_percentage`, `install_delivery_*`, `referral_currency_rate`, disclaimers, PDF overrides.

## Routing

```
/                                           → Dashboard
/projects                                   → ProjectsHub (project list)
/projects/:projectId                        → ProjectPage (hub detail + tabs)
/projects/:projectId/quotations/:quotationId → QuotationDetails (pricing)
/products                                   → ProductsCatalog
/products/:id                               → ProductItem detail
/prices                                     → PriceList
/prices/:id                                 → PriceListItem detail
/templates                                  → Templates
/settings                                   → Settings
```

## Key Features

- Project → Quotation hierarchy with version management
- Multi-area quotations with cabinet-level cost breakdown
- CDS (Cabinet Design Series) product catalog with SKU validation
- Closet catalog (Evita Plus / Evita Premium lines)
- Dual-currency support (MXN/USD) with configurable exchange rate
- PDF generation (MXN standard + USD summary)
- Bulk material and hardware change tools
- Price tracking and version history
- Template system for reusable cabinet configurations
- AI assistant (Claude-powered) for estimation support
- Glass morphism UI design language
- Zustand for shared state management (settings store)
