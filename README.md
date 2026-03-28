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
├── components/     # Reusable UI components (36 files)
├── lib/            # Business logic, calculations, Supabase client
├── pages/          # Top-level views (Dashboard, Projects, etc.)
├── types/          # TypeScript interfaces
└── utils/          # Export, import, print utilities

supabase/
├── functions/      # Edge functions (evita-ia)
└── migrations/     # Database schema history
```

## Key Features

- Multi-area project quotations with cabinet-level cost breakdown
- CDS (Cabinet Design Series) product catalog with SKU validation
- Closet catalog (Evita Plus / Evita Premium lines)
- Dual-currency support (MXN/USD) with configurable exchange rate
- PDF generation (MXN standard + USD summary)
- Bulk material and hardware change tools
- Price tracking and version history
- Template system for reusable cabinet configurations
- AI assistant (Claude-powered) for estimation support
