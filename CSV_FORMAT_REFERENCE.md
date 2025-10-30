# CSV Format Reference

Quick reference for CSV file formats required by the import system.

## Products Catalog CSV Format

### Required Columns (in order)

| Column Name | Type | Required | Description | Example |
|-------------|------|----------|-------------|---------|
| SKU (CDS) | Text | Yes | Unique cabinet identifier | `301-9"x12"x12"` |
| Description | Text | Yes | Cabinet description | `Wall Hung Cabinet \| 1 Door` |
| Box SF | Number | Yes | Box square feet | `4.9` |
| Box Edgeband | Number | No | Box edgeband meters | `0.75` |
| Box Edgeband Color | Number | No | Box edgeband color meters | `1.78` |
| Doors & Fronts SF | Number | Yes | Doors/fronts square feet | `1.5` |
| Doors & Fronts Edgeband | Number | No | Doors/fronts edgeband meters | `5.5` |
| Total Edgeband Color | Number | Yes | Total edgeband for calculations | `7.28` |

### Example Row
```csv
301-9"x12"x12",Wall Hung Cabinet | 1 Door,4.9,0.75,1.78,1.5,5.5,7.28
223-24"x30"x24",Base Cabinet with | 2 Drawers,42.3,3.1,15.75,5,6.15,21.9
```

### Special Rules
- **has_drawers** is automatically detected: Any description containing the word "drawer" (case-insensitive) will be marked as `has_drawers = true`
- SKU must be unique - duplicate SKUs will update existing records
- Empty numeric fields default to 0
- **Total Edgeband Color** is the critical field used for all edgeband calculations

---

## Price List CSV Format

### Required Columns (in order)

| Column Name | Type | Required | Description | Example |
|-------------|------|----------|-------------|---------|
| SKU/Code | Text | No | Optional identifier | `MEL-EVITA-15` |
| Concept / Description | Text | Yes | Material/hardware description | `Melamine Evita Plus TBD 15mm x 4ft x 8ft` |
| Type | Text | Yes | Category | `Melamine`, `Edgeband`, `Hinges` |
| Material | Text | No | Material type | `MDF`, `PVC`, `Metal` |
| Dimensions | Text | No | Size specification | `4ft x 8ft`, `19x1mm` |
| Unit | Text | Yes | Unit of measure | `Sheet`, `Meter`, `Piece` |
| Price | Currency | Yes | Price in USD | `$52.00`, `52`, `"$2,399.00"` |

### Example Rows
```csv
MEL-EVITA-15,Melamine Evita Plus TBD 15mm x 4ft x 8ft,Melamine,MDF,4ft x 8ft,Sheet,"$52.00"
EB-EVITA-19,Edgeband Evita Plus Matching Finish 19x1mm,Edgeband,PVC,19x1mm,Meter,$8.30
HW-HINGE-SC,Soft Close Hinges,Hinges,Metal,,Piece,$4.50
```

### Special Rules
- **Price Formatting**: System accepts prices with or without `$` and commas:
  - `$52.00` → 52.00
  - `"$2,399.00"` → 2399.00
  - `52` → 52.00
- **sf_per_sheet** is auto-calculated from dimensions:
  - `4ft x 8ft` → 32 sq ft
  - `1.22m x 2.44m` → 32.08 sq ft (auto-converted)
  - No dimensions → null (manual entry required later)
- Rows with description "Select the concept" are skipped
- Empty rows are skipped

### Common Types
Use these standard types for consistent filtering and organization:

**Sheet Materials:**
- `Melamine`
- `MDF`
- `Plywood`
- `Laminate`
- `Veneer`
- `Acrylic`

**Edgeband:**
- `Edgeband`

**Hardware:**
- `Hinges`
- `Slides`
- `Handles`
- `Special Hardware`

**Other:**
- `Glass`
- `Solid Surface`
- `Steel`
- `Aluminum`
- `Fabric`
- `Service`

---

## CSV File Encoding

- **Encoding**: UTF-8 (recommended)
- **Line Endings**: LF or CRLF (both supported)
- **Field Separator**: Comma (`,`)
- **Text Qualifier**: Double quotes (`"`) when field contains commas
- **Header Row**: Required as first row

## Data Validation

### Products Catalog
✅ **Valid:**
```csv
SKU (CDS),Description,Box SF,Box Edgeband,Box Edgeband Color,Doors & Fronts SF,Doors & Fronts Edgeband,Total Edgeband Color
301-9"x12"x12",Wall Hung Cabinet | 1 Door,4.9,0.75,1.78,1.5,5.5,7.28
```

❌ **Invalid (missing SKU):**
```csv
SKU (CDS),Description,Box SF,Box Edgeband,Box Edgeband Color,Doors & Fronts SF,Doors & Fronts Edgeband,Total Edgeband Color
,Wall Hung Cabinet | 1 Door,4.9,0.75,1.78,1.5,5.5,7.28
```

### Price List
✅ **Valid:**
```csv
SKU/Code,Concept / Description,Type,Material,Dimensions,Unit,Price
MEL-001,Melamine White 15mm x 4ft x 8ft,Melamine,MDF,4ft x 8ft,Sheet,$52.00
```

❌ **Invalid (missing description):**
```csv
SKU/Code,Concept / Description,Type,Material,Dimensions,Unit,Price
MEL-001,,Melamine,MDF,4ft x 8ft,Sheet,$52.00
```

## Tips for Creating CSV Files

### From Excel/Google Sheets
1. Format your data with proper column headers
2. Ensure numeric fields contain only numbers (no text)
3. Use File → Save As → CSV (UTF-8)
4. Open in text editor to verify format

### From Other Systems
1. Export data to CSV format
2. Map columns to match required structure
3. Verify data types match requirements
4. Test with 5-10 rows before full import

### Manual Creation
1. Use a text editor (not Word)
2. Start with header row
3. Add data rows below
4. Use quotes around fields with commas
5. Save with `.csv` extension

## Troubleshooting

**Import shows 0 records:**
- Verify first row contains headers (not data)
- Check column names match exactly
- Ensure file encoding is UTF-8

**Some records skipped:**
- Check for empty required fields (SKU, Description, Price)
- Verify numeric fields contain valid numbers
- Look for special characters causing parsing issues

**Prices imported as 0:**
- Remove currency symbols or use quotes: `"$52.00"`
- Check for empty cells in Price column
- Verify number format (use decimal point, not comma)

**Products not marked as has_drawers:**
- Ensure description contains word "drawer" or "Drawer"
- Check spelling variations
- Can be manually corrected after import

## Data Limits

- **Products Catalog**: ~500 SKUs recommended (no hard limit)
- **Price List**: ~400 items recommended (no hard limit)
- **File Size**: < 5MB recommended for smooth imports
- **Row Length**: < 10,000 characters per row

## Best Practices

1. **Always keep backup CSVs** - Store original files safely
2. **Version your files** - Use naming like `Products_v1.csv`, `Products_v2.csv`
3. **Test small batches first** - Import 5-10 rows to verify format
4. **Review in text editor** - Check format before importing
5. **Clear before re-import** - Avoid duplicates in Price List
6. **Verify after import** - Always check Products Catalog and Price List pages

## Support

For detailed import instructions, see [CSV_IMPORT_GUIDE.md](./CSV_IMPORT_GUIDE.md)
