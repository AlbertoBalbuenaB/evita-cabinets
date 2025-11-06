# Material Price Update System - Fix Implementation

## Problem Description

The Material Price Update system was incorrectly detecting price changes by comparing **calculated costs** (which include adjustments for full rolls and full sheets) instead of comparing **unit prices** from the Price List. This caused false positives where the system would report price changes when there were only calculation rounding differences.

## Solution Implemented

### Database Changes

#### 1. New Fields in `area_cabinets` Table
Added 6 new fields to store the original unit prices at the time of cabinet creation:
- `original_box_material_price`
- `original_box_edgeband_price`
- `original_box_interior_finish_price`
- `original_doors_material_price`
- `original_doors_edgeband_price`
- `original_doors_interior_finish_price`

#### 2. New Fields in `cabinet_templates` Table
Added the same 6 fields to store original prices when templates are created.

#### 3. Backfill Migration
Created and executed a function to populate these fields for existing cabinets using reverse calculation from stored costs.

### Code Changes

#### 1. CabinetForm Component
- Now saves the unit price from the Price List when creating/editing cabinets
- Stores these values in the new `original_*_price` fields

#### 2. Material Price Update System (`materialPriceUpdateSystem.ts`)
- Modified `checkMaterialChange()` to compare **unit prices** instead of calculated costs
- Uses the stored `original_*_price` fields to determine the original price
- Falls back to reverse calculation for old cabinets without stored prices
- Only reports changes when the **Price List unit price** actually changed

#### 3. Bulk Material Change System
- Updated to also set the new `original_*_price` fields when materials are changed
- Ensures consistency when performing bulk operations

#### 4. Template Manager
- Updated to capture and apply original prices when creating/using templates

### Key Concepts

The fix separates two previously mixed concepts:

1. **Unit Price** - The price per sheet/roll in the Price List (what actually changes over time)
2. **Calculated Cost** - The cost for a specific cabinet including roll/sheet adjustments (varies due to calculation method)

### How It Works Now

1. **When a cabinet is created:**
   - The current unit price from Price List is saved in `original_*_price` fields
   - The calculated cost (with roll/sheet adjustments) is saved in `*_cost` fields

2. **When checking for price changes:**
   - System compares: `original_*_price` vs `current_price_list.price`
   - NOT comparing: `stored_*_cost` vs `recalculated_*_cost`

3. **Result:**
   - Only detects REAL price changes in the Price List
   - Ignores differences caused by roll/sheet calculation method

## Verification

After implementing, the system correctly:
- ✅ Detects when a material's unit price changes in the Price List
- ✅ Ignores calculation rounding differences
- ✅ Works with existing cabinets (via backfilled data)
- ✅ Works with new cabinets (via stored original prices)
- ✅ Works with bulk material changes
- ✅ Works with cabinet templates

## How to See the Changes

If you don't see the changes reflected:

1. **Clear Browser Cache:**
   - Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

   Or:
   - Open DevTools (F12)
   - Right-click refresh button
   - Select "Empty Cache and Hard Reload"

2. **Verify Database:**
   ```sql
   SELECT
     COUNT(*) as total_cabinets,
     COUNT(original_box_material_price) as with_original_prices
   FROM area_cabinets;
   ```

## Testing the Fix

To test the fix:

1. Go to a project with existing cabinets
2. Open "Update Material Prices"
3. The system should now only show materials where the **Price List price** actually changed
4. It should NOT show materials where only the calculation method differs

## Files Modified

- `supabase/migrations/20251106153821_add_original_prices_to_area_cabinets.sql`
- `supabase/migrations/20251106153853_backfill_original_prices_for_existing_cabinets.sql`
- `supabase/migrations/20251106154139_add_original_prices_to_cabinet_templates.sql`
- `src/components/CabinetForm.tsx`
- `src/lib/materialPriceUpdateSystem.ts`
- `src/lib/bulkMaterialChange.ts`
- `src/lib/templateManager.ts`
- `src/types/index.ts`
