# CSV Export Feature - Project Areas

## Overview

Added the ability to export project areas and their details to CSV format. This provides a convenient way to analyze, share, and archive project data in spreadsheet applications like Excel or Google Sheets.

## Access

**Location**: Main project toolbar in ProjectDetails page

**Button**: "Export CSV" button (with spreadsheet icon)
- Located between "Print / Export PDF" and "Save Changes" buttons
- Disabled when project has no areas
- Opens a dropdown menu with export options

## Export Options

### 1. Areas Summary

**What it exports:**
- Compact overview of all areas and their totals
- Perfect for quick analysis and reporting

**CSV Structure:**
```
Project: [Project Name]

Area Name,Cabinets,Items,Countertops,Cabinets Total,Items Total,Countertops Total,Area Total
Kitchen,24,3,2,12500.00,450.00,1200.00,14150.00
Master Bedroom,8,1,0,3200.00,150.00,0.00,3350.00
Living Room,12,2,0,5400.00,300.00,0.00,5700.00

TOTAL,44,6,2,21100.00,900.00,1200.00,23200.00
```

**Columns:**
- Area Name
- Cabinets (count of non-accessory cabinets)
- Items (count of additional items)
- Countertops (count of countertops)
- Cabinets Total ($ amount)
- Items Total ($ amount)
- Countertops Total ($ amount)
- Area Total ($ amount)

**Use Cases:**
- Quick area comparison
- Budget allocation analysis
- Client presentations
- Progress tracking
- Cost breakdowns by area

### 2. Detailed Report

**What it exports:**
- Complete itemized listing of every cabinet, countertop, and item
- Full project details for comprehensive analysis

**CSV Structure:**
```
Project: [Project Name]
Detailed Areas Report

Area: Kitchen

Cabinets:
SKU,Description,Quantity,Unit Price,Subtotal
W3012,Wall Cabinet 30x12,2,250.00,500.00
B36,Base Cabinet 36,4,350.00,1400.00
,,Cabinets Total:,2500.00

Countertops:
Description,Length (in),Width (in),Square Feet,Unit Price,Subtotal
Granite Countertop,120,25,20.83,85.00,1770.55
,,Countertops Total:,1770.55

Additional Items:
Description,Quantity,Unit Price,Subtotal,Notes
Backsplash Installation,1,450.00,450.00,Ceramic tile
,,Items Total:,450.00

Area Total:,4720.55
---

Area: Master Bedroom
[... continues for all areas ...]

Project Total:,23200.00
```

**Use Cases:**
- Detailed material lists
- Vendor ordering
- Installation planning
- Cost verification
- Archive records
- Full project documentation

## File Naming Convention

Both export types generate files with standardized names:

**Format**: `[project_name]_areas_[type]_[date].csv`

**Examples:**
- `smith_residence_areas_2025-11-05.csv` (Summary)
- `smith_residence_areas_detailed_2025-11-05.csv` (Detailed)

**Naming Logic:**
- Project name sanitized (spaces → underscores, special chars removed)
- Lowercase
- ISO date format (YYYY-MM-DD)
- Prevents filename conflicts with timestamps

## Features

### CSV Formatting

✅ **Proper Escaping**: Handles commas, quotes, and line breaks in data
✅ **UTF-8 Encoding**: Supports international characters
✅ **Excel Compatible**: Opens directly in Microsoft Excel
✅ **Google Sheets Ready**: Import without formatting issues
✅ **No BOM**: Clean UTF-8 without byte order mark

### Data Accuracy

✅ **Real-time Data**: Exports current project state
✅ **Calculated Totals**: Automatically computed from database
✅ **Formatted Currency**: Two decimal precision
✅ **Complete Information**: All area details included

### User Experience

✅ **Dropdown Menu**: Clean, organized interface
✅ **Clear Descriptions**: Each option explains what it exports
✅ **Instant Download**: No server processing required
✅ **Browser Download**: Uses native browser download
✅ **Auto-cleanup**: Temporary URLs properly revoked

## Technical Implementation

### Files Created

- `src/utils/exportAreasCSV.ts` - Core export logic and utilities

### Files Modified

- `src/pages/ProjectDetails.tsx` - Added export button and handlers

### Key Functions

**`downloadAreasCSV()`**
- Exports areas summary
- Parameters: areas array, project name
- Returns: void (triggers download)

**`downloadDetailedAreasCSV()`**
- Exports detailed report
- Parameters: areas array, project name
- Returns: void (triggers download)

**`generateAreasCSV()`**
- Creates CSV string for summary
- Returns formatted CSV text

**`generateDetailedAreasCSV()`**
- Creates CSV string for detailed report
- Returns formatted CSV text with full itemization

**`escapeCSVField()`**
- Properly escapes CSV special characters
- Handles quotes, commas, newlines

## Usage Examples

### Example 1: Budget Analysis

**Scenario**: Need to compare costs across different areas

**Steps:**
1. Click "Export CSV" button
2. Select "Areas Summary"
3. Open in Excel
4. Sort by "Area Total" column
5. Create pivot tables or charts

**Result**: Quick visual analysis of where budget is allocated

### Example 2: Vendor Ordering

**Scenario**: Need to order all cabinets for specific areas

**Steps:**
1. Click "Export CSV" button
2. Select "Detailed Report"
3. Open in Excel
4. Filter by area (e.g., "Kitchen")
5. Extract SKUs and quantities

**Result**: Complete cabinet list ready for vendor

### Example 3: Client Presentation

**Scenario**: Client wants area-by-area breakdown

**Steps:**
1. Click "Export CSV" button
2. Select "Areas Summary"
3. Import to Google Sheets
4. Format as needed
5. Share with client

**Result**: Professional, shareable cost breakdown

### Example 4: Project Archive

**Scenario**: Save project details for records

**Steps:**
1. Click "Export CSV" button
2. Select "Detailed Report"
3. Save to project folder
4. Include in project documentation

**Result**: Complete project record in standard format

## Data Structure

### Areas Summary CSV

```typescript
interface AreaExportData {
  areaName: string;
  cabinetCount: number;
  itemCount: number;
  countertopCount: number;
  cabinetsTotal: number;
  itemsTotal: number;
  countertopsTotal: number;
  areaTotal: number;
}
```

### Detailed Report CSV

Structured sections for each area:
- Area header
- Cabinets table (SKU, description, qty, price, subtotal)
- Countertops table (description, dimensions, sq ft, price, subtotal)
- Items table (description, qty, price, subtotal, notes)
- Area total
- Separator line

## Common Use Cases

1. **Financial Analysis**: Import into accounting software
2. **Progress Tracking**: Compare exports over time
3. **Client Communication**: Share via email or cloud storage
4. **Material Planning**: Calculate totals by type
5. **Subcontractor Quotes**: Provide detailed lists
6. **Change Orders**: Compare before/after versions
7. **Project Archives**: Long-term record keeping
8. **Management Reports**: Aggregate data across projects

## Tips & Best Practices

### For Best Results:

1. **Export After Saving**: Click "Save Changes" before exporting to ensure latest data
2. **Use Descriptive Area Names**: They become row labels in the CSV
3. **Regular Exports**: Create snapshots at project milestones
4. **Version Naming**: Rename files to include version info if needed
5. **Backup Practice**: Include CSV exports in project backups

### Excel Tips:

- Use "Format as Table" for better sorting/filtering
- Create pivot tables from detailed exports
- Use SUM() formulas to verify totals
- Apply currency formatting to dollar columns
- Freeze top row for easier scrolling

### Google Sheets Tips:

- File → Import → Upload for best results
- Use conditional formatting to highlight high costs
- Share with view-only permissions for clients
- Create charts from summary data
- Use QUERY() function for custom reports

## Limitations & Notes

- **No Images**: CSV format is text-only, no cabinet photos
- **No Formulas**: Exports values, not formulas
- **Static Snapshot**: Data is from export time, doesn't auto-update
- **Local Download**: Files saved to browser's download folder
- **Requires Areas**: Button disabled if project has no areas

## Future Enhancements (Optional)

Potential improvements for future versions:
- Excel (.xlsx) format with formatting
- Custom column selection
- Multiple project export (batch)
- Scheduled/automated exports
- Cloud storage integration
- Email export directly
- PDF version of CSV data
- Material summary export
- Custom date ranges

---

**Feature Added**: November 2025
**Files**: `src/utils/exportAreasCSV.ts`, `src/pages/ProjectDetails.tsx`
**Build Status**: ✅ Successful
