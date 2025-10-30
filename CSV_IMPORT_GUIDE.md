# CSV Import Guide

This guide explains how to import your Products Catalog and Price List data into the Millwork Quotation System.

## Overview

The system includes a built-in CSV import feature that allows you to bulk-load:
1. **Products Catalog** - All cabinet SKUs with specifications
2. **Price List** - Materials, hardware, and pricing information

## Access the Import Tool

1. Start the application
2. Navigate to **Import Data** in the main menu
3. You'll see two import sections: one for Products and one for Price List

## Import Process

### 1. Import Products Catalog

**File:** `Evita_Cabinets_CDS_2025.csv`

**Required Columns:**
- `SKU (CDS)` - Cabinet SKU code (required, unique)
- `Description` - Cabinet description (required)
- `Box SF` - Box square feet (required)
- `Box Edgeband` - Box edgeband meters
- `Box Edgeband Color` - Box edgeband color meters
- `Doors & Fronts SF` - Doors & drawer fronts square feet (required)
- `Doors & Fronts Edgeband` - Doors & fronts edgeband meters
- `Total Edgeband Color` - Total edgeband meters (used for calculations)

**Automatic Processing:**
- Products with "Drawer" in the description are automatically marked as `has_drawers = true`
- Existing products (matched by SKU) will be updated
- All products are marked as active by default

**Steps:**
1. Click "Choose Products CSV"
2. Select your `Evita_Cabinets_CDS_2025.csv` file
3. Wait for import to complete
4. Review the success count and any errors

### 2. Import Price List

**File:** `Price_List_2025.csv`

**Required Columns:**
- `SKU/Code` - Optional SKU/code identifier
- `Concept / Description` - Material/hardware description (required)
- `Type` - Category (Melamine, Edgeband, Hinges, etc.)
- `Material` - Material type (optional)
- `Dimensions` - Size specifications (e.g., "4ft x 8ft", "19x1mm")
- `Unit` - Unit of measure (Sheet, Meter, Piece, etc.)
- `Price` - Price in USD (required)

**Automatic Processing:**
- Prices with `$` and `,` are automatically cleaned (e.g., "$2,399.00" → 2399.00)
- `sf_per_sheet` is automatically calculated from dimensions:
  - "4ft x 8ft" = 32 sq ft
  - "1.22m x 2.44m" = 32.08 sq ft (converted from metric)
- Empty or invalid rows are skipped
- Rows with "Select the concept" description are skipped

**Steps:**
1. Click "Choose Price List CSV"
2. Select your `Price_List_2025.csv` file
3. Wait for import to complete
4. Review the success count and any errors

## CSV Format Requirements

### General Rules
- First row must contain column headers
- Use commas as field separators
- Text fields with commas should be enclosed in double quotes
- Numeric fields should not contain quotes
- Empty fields are allowed (will use default values)

### Example Product Row
```csv
SKU (CDS),Description,Box SF,Box Edgeband,Box Edgeband Color,Doors & Fronts SF,Doors & Fronts Edgeband,Total Edgeband Color
301-9"x12"x12",Wall Hung Cabinet | 1 Door,4.9,0.75,1.78,1.5,5.5,7.28
```

### Example Price List Row
```csv
SKU/Code,Concept / Description,Type,Material,Dimensions,Unit,Price
MEL-EVITA-15,Melamine Evita Plus TBD 15mm x 4ft x 8ft,Melamine,MDF,4ft x 8ft,Sheet,"$52.00"
```

## Verification After Import

After importing, verify your data:

1. **Products Catalog:**
   - Navigate to "Products Catalog"
   - Check that all products appear
   - Verify SKUs, descriptions, and specifications
   - Confirm "Has Drawers" flag is correct

2. **Price List:**
   - Navigate to "Price List"
   - Check that all materials and hardware appear
   - Verify prices are correct (without $ signs)
   - Filter by Type to review categories
   - Check that sf_per_sheet is calculated for sheet materials

## Troubleshooting

### Common Issues

**Import shows 0 successes:**
- Check that your CSV has the correct column headers
- Ensure the first row contains headers, not data
- Verify file encoding is UTF-8

**Some rows failed to import:**
- Review error messages in the import results
- Check for missing required fields (SKU, Description, Price)
- Verify numeric fields contain valid numbers
- Look for special characters that might cause parsing issues

**Prices imported as 0:**
- Ensure price column contains numeric values
- Remove currency symbols or use quotes: `"$52.00"` works, `$52.00` might not
- Check for empty price cells

**Products not marked as has_drawers:**
- Verify the word "Drawer" or "drawer" appears in the description
- Manual edit available in Products Catalog if needed

### Data Conflicts

**Duplicate SKUs in Products:**
- The system will update existing products with the same SKU
- Latest import overwrites previous data

**Duplicate Descriptions in Price List:**
- Each import creates new entries
- Consider clearing data before re-importing if you have many duplicates

## Clear All Data

The Import Data page includes a "Clear All Data" button in the Danger Zone section.

**This will delete:**
- All products from the catalog
- All items from the price list
- All projects and their areas
- All cabinets and configurations

**Use this when:**
- Starting fresh with new CSV data
- Correcting major import errors
- Resetting the system for testing

**Warning:** This action cannot be undone! Always have backups of your CSV files.

## Best Practices

1. **Test with small files first:** Import 5-10 rows to verify format
2. **Keep backups:** Save your CSV files in a safe location
3. **Version your data:** Use filenames like `Products_2025_v1.csv`
4. **Review before importing:** Open CSVs in a text editor to check format
5. **Import in order:** Import Products first, then Price List
6. **Verify immediately:** Check imported data before creating quotations

## Data from Multiple Sources

If you have data in different formats:

1. **Excel/Google Sheets:**
   - Format your data with the required columns
   - Export as CSV (UTF-8 encoding)
   - Review the CSV in a text editor before importing

2. **Other systems:**
   - Map your fields to the required column names
   - Ensure data types match (numbers for SF, text for descriptions)
   - Export and test with a small sample first

## Getting Help

If you encounter issues:
1. Check error messages in the import results
2. Review this guide for common issues
3. Verify your CSV format matches the examples
4. Check the browser console for detailed error messages (F12 → Console tab)

## Next Steps

After successful import:
1. Navigate to Products Catalog to verify all cabinets are loaded
2. Navigate to Price List to verify all materials and hardware
3. Create a test project to ensure calculations work correctly
4. Review the cost breakdown for accuracy

The system is now ready for creating quotations!
