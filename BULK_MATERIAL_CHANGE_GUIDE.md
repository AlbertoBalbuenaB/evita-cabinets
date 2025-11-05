# Bulk Material Change System - User Guide

## Overview

The Bulk Material Change system allows you to update materials across multiple cabinets simultaneously, dramatically improving workflow efficiency when clients request finish changes.

## Key Benefits

- **Time Savings**: Change materials in 50+ cabinets in under 1 minute (vs 45-60 minutes manually)
- **Accuracy**: Preview changes before applying them with detailed cost comparisons
- **Flexibility**: Apply changes to single areas, multiple areas, or entire projects
- **Safety**: Built-in validation prevents incompatible material replacements
- **Audit Trail**: All changes are logged for accountability and reporting

## Accessing the Feature

### Project-Wide Changes
Click the **"Change Materials"** button in the main project toolbar (next to "Add Area" and "Print").

### Area-Specific Changes
Click the **refresh icon (⟳)** button in any area's header (next to the calculator icon).

## Step-by-Step Usage

### 1. Select Scope

Choose where to apply the material change:

- **Entire Project**: Updates all cabinets in all areas
- **Single Area**: Updates cabinets in one specific area only
- **Selected Areas**: Choose multiple areas with checkboxes

### 2. Choose Material Type

Select which material component to change:

- **Box Construction Material**: The sheet material for cabinet boxes
- **Box Edgeband**: Edgebanding for cabinet box edges
- **Doors & Drawer Fronts Material**: Sheet material for doors and fronts
- **Doors Edgeband**: Edgebanding for door and drawer edges
- **Box Interior Finish**: Interior finish material for boxes (optional)
- **Doors Interior Finish**: Interior finish material for doors (optional)

### 3. Select Materials

**Current Material**: Choose which material you want to replace
- Dropdown shows only materials currently used in your selected scope
- Displays the number of cabinets using each material
- Example: "White Melamine (47 cabinets)"

**New Material**: Select the replacement material
- Shows **ALL active materials** from the Price List
- Searchable dropdown with autocomplete for quick selection
- Filtered to show only compatible material types
- Displays full details: Name - Dimensions - Price/Unit
- Includes materials not currently used in the project
- Shows count of available compatible materials at bottom

**Update Matching Interior Finish** (optional checkbox):
- When enabled, if a cabinet's interior finish matches the current material, it will also be updated to the new material
- Only available when changing Box or Doors materials

### 4. Preview Changes

Click **"Preview Changes"** to see:

- **Total cabinets affected**: Number of cabinets that will be updated
- **Cost change**: Total cost difference and percentage
- **Detailed table**: Shows each affected cabinet with:
  - Product SKU
  - Quantity
  - Current cost vs New cost
  - Cost difference per cabinet

**Cost Change Warnings**:
- Changes over 20% increase trigger a confirmation warning
- Color coding: Green for savings, Red for increases, Gray for minimal change

### 5. Apply Changes

If the preview looks correct:
1. Review the summary one final time
2. Click **"Apply Changes"**
3. System updates all cabinets in a single transaction
4. Success notification shows total cabinets updated and final cost impact
5. All displays automatically refresh with new costs

## Material Validation Rules

The system enforces these compatibility rules:

1. **Sheet Materials** can only replace other sheet materials
   - Melamine, MDF, Plywood, Laminate

2. **Edgeband** can only replace other edgeband
   - Any edgeband type can replace another

3. **Hardware** can only replace other hardware
   - Maintains the same quantity structure

4. **Inactive Materials** cannot be used as replacements
   - Only active materials from the price list are available

## Real-World Example

**Scenario**: Client wants to change all Kitchen cabinets from "White Melamine" to "Gray Melamine"

**Traditional Method** (50 cabinets):
1. Open each cabinet individually (50 times)
2. Find and click Box Material dropdown (50 times)
3. Search for new material (50 times)
4. Save changes (50 times)
5. **Total time: 45-60 minutes**

**With Bulk Material Change**:
1. Click area's refresh button
2. Select "Box Construction Material"
3. Select "White Melamine" as current
4. Select "Gray Melamine" as new
5. Preview → Apply
6. **Total time: 30 seconds**

## Technical Details

### Database Changes

The system creates a `material_change_log` table that records:
- What material was changed (type and IDs)
- Scope of the change (area/project)
- How many cabinets were affected
- Cost impact (before, after, difference)
- Timestamp of the change

### Cost Recalculation

When materials change, the system automatically recalculates:
- Material costs (based on square footage)
- Edgeband costs (based on linear meters)
- Cabinet subtotals
- Area subtotals
- Project total
- Sheet material optimization
- Edgeband roll calculations

### Version Compatibility

The bulk material change system works with:
- Regular projects (area_cabinets table)
- Versioned projects (version_area_cabinets table)
- All changes respect the current version context

## Best Practices

1. **Always Preview First**: Review the impact before applying changes

2. **Use Descriptive Scopes**:
   - For finish changes across all similar cabinets: use "Entire Project"
   - For room-specific changes: use "Single Area" or "Selected Areas"

3. **Check Cost Changes**: If costs change significantly (>20%), verify:
   - Correct material was selected
   - Price list is up to date
   - Material dimensions match expectations

4. **Update Interior Finishes Thoughtfully**: Only enable "Update matching interior finish" when the interior finish should genuinely match the exterior

5. **Document Major Changes**: Add notes in project details about significant material changes for future reference

## Troubleshooting

### "No cabinets found with the selected material"
- The selected material isn't used in any cabinets within your chosen scope
- Try expanding the scope or selecting a different material

### "Cannot replace [type] with non-[type] material"
- You're trying to replace incompatible material types
- Example: Cannot replace Melamine (sheet) with Edgeband
- Select a compatible material from the same category

### "New material is not active"
- The replacement material has been deactivated in the price list
- Update the price list or choose an active material

### Cost calculations seem incorrect
- Verify the new material's price and dimensions in the price list
- Check that waste percentages are configured correctly in Settings
- Review the product catalog to ensure square footage values are accurate

## Support

For issues or questions about the bulk material change system:
1. Check this guide first
2. Review the audit log in `material_change_log` table
3. Contact system administrator if problems persist

---

**Last Updated**: November 2025
**Version**: 1.0
