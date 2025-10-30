# Millwork & Casework Quotation System

A professional web application for creating detailed quotations for millwork and casework projects. Built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

### Core Functionality
- **Products Catalog Management**: Full CRUD operations for cabinet products with specifications
- **Price List Management**: Manage materials, hardware, and pricing
- **CSV Import**: Bulk import products and prices from CSV files
- **Project Management**: Create and manage quotation projects with multiple areas
- **Automatic Calculations**: Real-time cost calculations based on materials, labor, and hardware
- **Dashboard**: Overview of projects, products, and pricing data

### Key Capabilities
- Multi-area project organization (Kitchen, Dining, Closet, etc.)
- Complex cabinet configurations with:
  - Box construction materials and edgeband
  - Doors & drawer fronts materials and edgeband
  - Optional interior finishes
  - Multiple hardware items per cabinet
  - Automatic labor cost calculation ($600/cabinet with drawers, $400 without)
- Real-time cost breakdown and summaries
- Expandable cabinet cards showing detailed cost information

## Calculation Logic

### Critical Pricing Rules

**Sheet Materials (Melamine, MDF, Plywood):**
- Price in database is PER SHEET (e.g., $52.00 for a 4ft x 8ft sheet)
- Formula: `(Sheet Price ÷ Sheet Sq Ft) × Total Sq Ft Needed`
- Example: $52.00 ÷ 32 sq ft = $1.625/sq ft

**Edgeband:**
- Price in database is PER METER (e.g., $8.30 per meter)
- Formula: `Price Per Meter × Total Meters Needed`
- No conversion needed - direct multiplication

**Labor:**
- $600 per cabinet if `has_drawers = true`
- $400 per cabinet if `has_drawers = false`

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL)
- **Date Handling**: date-fns
- **Icons**: Lucide React
- **Build Tool**: Vite

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account (credentials already configured in `.env`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to the URL shown in the terminal

### First-Time Setup

**Option 1: Use Sample Data (Quick Start)**
1. Navigate to the Dashboard
2. Click "Load Sample Data" to add example products and prices
3. Go to "Products Catalog" to view and manage cabinet SKUs
4. Go to "Price List" to view and manage materials and pricing
5. Create your first project in "Projects"

**Option 2: Import Your Data (Production Setup)**
1. Navigate to "Import Data" in the main menu
2. Import Products Catalog CSV file (`Evita_Cabinets_CDS_2025.csv`)
3. Import Price List CSV file (`Price_List_2025.csv`)
4. Verify imported data in Products Catalog and Price List
5. Create your first project in "Projects"

See [CSV_IMPORT_GUIDE.md](./CSV_IMPORT_GUIDE.md) for detailed CSV import instructions.

## Database Schema

### Tables

**products_catalog**
- Cabinet SKUs with specifications
- Box square feet and edgeband meters
- Doors & fronts square feet and edgeband meters
- Total edgeband for calculations
- Has drawers flag for labor cost determination

**price_list**
- Materials (sheet goods, edgeband, hardware)
- Pricing per unit (sheet, meter, piece)
- Dimensions and square feet calculations

**projects**
- Project name, address, quote date
- Total amount and status

**project_areas**
- Areas within projects (Kitchen, Dining, etc.)
- Display order and subtotals

**area_cabinets**
- Individual cabinet configurations
- Material selections for box and doors
- Hardware items (JSONB array)
- All calculated costs

## Usage Guide

### Managing Products Catalog

1. Navigate to "Products Catalog"
2. Click "Add Product"
3. Enter:
   - SKU/Code (e.g., "301-9x12x12")
   - Description
   - Box square feet
   - Doors & fronts square feet
   - Total edgeband meters
   - Check "Has Drawers" if applicable
4. Save the product

### Managing Price List

1. Navigate to "Price List"
2. Click "Add Item"
3. Enter:
   - Type (Melamine, Edgeband, Hinges, etc.)
   - Description
   - Dimensions (e.g., "4ft x 8ft" for sheets)
   - Unit (Sheet, Meter, Piece)
   - Price
4. Square feet per sheet is auto-calculated from dimensions

### Creating a Project

1. Navigate to "Projects"
2. Click "New Project"
3. Enter project name, address, and quote date
4. Click "View Details" to enter the project
5. Add areas (Kitchen, Dining, etc.)
6. Add cabinets to each area:
   - Select product from catalog
   - Enter quantity
   - Choose box materials and edgeband
   - Choose doors materials and edgeband
   - Add hardware items
   - Review cost breakdown
   - Save cabinet
7. View project total and area subtotals

## Calculation Examples

### Example 1: Wall Cabinet (No Drawers)
**Product**: 301-9"x12"x12" - Wall Hung Cabinet | 1 Door
- Box SF: 4.9, Doors SF: 1.5, Total Edgeband: 7.28m
- Quantity: 3 cabinets

**Materials**:
- Box Material: Melamine $52.00/sheet (32 sq ft)
- Box Edgeband: $8.30/meter
- Doors Material: Melamine $52.00/sheet
- Doors Edgeband: $8.30/meter
- Hardware: 2 hinges @ $4.50 each

**Calculation**:
- Box Material: (4.9 × 3) × ($52.00 ÷ 32) = $23.89
- Box Edgeband: (7.28 × 3) × $8.30 = $181.27
- Doors Material: (1.5 × 3) × ($52.00 ÷ 32) = $7.31
- Doors Edgeband: (5.5 × 3) × $8.30 = $136.95
- Hardware: (2 × 3) × $4.50 = $27.00
- Labor: 3 × $400 = $1,200.00
- **Total: $1,576.42**

### Example 2: Base Cabinet with Drawers
**Product**: 223-24"x30"x24" - Base Cabinet | 2 Drawers
- Has Drawers: Yes
- Quantity: 2 cabinets

**Labor**: 2 × $600 = $1,200.00 (higher rate for drawers)

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   ├── Layout.tsx
│   ├── CabinetCard.tsx
│   └── CabinetForm.tsx
├── pages/              # Main application pages
│   ├── Dashboard.tsx
│   ├── ProductsCatalog.tsx
│   ├── PriceList.tsx
│   ├── Projects.tsx
│   └── ProjectDetails.tsx
├── lib/                # Core utilities
│   ├── supabase.ts
│   ├── database.types.ts
│   └── calculations.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Helper functions
│   └── seedData.ts
└── App.tsx            # Main application component
```

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Key Features for Production Use

### Data Integrity
- All calculations are mathematically verified
- Real-time cost updates as selections change
- Automatic project total recalculation

### User Experience
- Clean, professional interface
- Responsive design for desktop and tablet
- Real-time search and filtering
- Expandable cost breakdowns
- Duplicate cabinet functionality
- Inline editing and deletion

### Database Design
- Row Level Security (RLS) enabled on all tables
- Cascading deletes for data integrity
- Soft deletes for products and price items
- Optimized indexes for performance
- JSONB for flexible hardware configurations

## Future Enhancements

Potential additions for future versions:
- PDF export functionality
- Project templates
- Material price history
- Multi-user authentication
- Client portal for sharing quotes
- Analytics dashboard
- Inventory management
- CSV import/export for bulk data

## Support

For issues or questions about the system:
1. Check the calculation examples in this README
2. Verify database schema matches requirements
3. Ensure all required materials are in the price list
4. Review browser console for error messages

## License

This project is proprietary software for millwork and casework businesses.
