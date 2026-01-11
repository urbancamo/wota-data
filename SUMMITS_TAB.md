# Summits Tab Implementation

## Overview

Added a new "Summits" tab that displays all summits from the database with formatted references and sortable columns.

## Features

### 1. New Tab
- Located after "Chaser Contacts" and before "Logs" (admin only)
- Displays all summits from the `summits` table

### 2. Formatted References
Three new utility functions added to `src/utils/wotaReference.ts`:

**WOTA References** (existing):
- `formatWotaReference(wotaid)` - Formats as `LDW-001` or `LDO-001`

**SOTA References** (new):
- `formatSotaReference(sotaid)` - Formats as `G/LD-001`
- Returns `-` if null/undefined

**Hump References** (new):
- `formatHumpReference(humpid)` - Formats as `G/HLD-001`
- Zero-pads the humpid to 3 digits
- Returns `-` if null/undefined

### 3. Sortable Columns
All columns can be sorted by clicking the header:
- **WOTA Ref** - Summit WOTA reference (LDW/LDO)
- **Name** - Summit name
- **Height** - Height in meters
- **Book** - Wainwright book reference
- **SOTA Ref** - SOTA reference (G/LD-xxx)
- **Hump Ref** - Hump reference (G/HLD-xxx)
- **Grid** - OS Grid reference
- **Last Activator** - Callsign of last activator
- **Last Activation** - Date of last activation

Sort indicators:
- `↕` - Column not currently sorted
- `↑` - Sorted ascending
- `↓` - Sorted descending

Clicking a column:
- First click: Sort ascending
- Second click: Sort descending
- Click different column: Switch to that column (ascending)

### 4. Search Functionality
Real-time search that filters summits by:
- Summit name
- Reference number
- WOTA reference (e.g., "LDW-001")
- OS Grid reference

### 5. Data Display

**Column Formatting:**
- WOTA/SOTA/Hump references: Blue, monospace font
- Name: Bold
- Height: Right-aligned with "m" suffix
- Book: Centered, grey
- Grid: Monospace
- Callsign: Monospace, bold
- Date: DD/MM/YYYY format
- Null values: Display as `-`

**Styling:**
- Hover effect on rows
- Sticky header when scrolling
- Responsive design for mobile
- Color-coded data types

## Files Created/Modified

### Created:
- `src/components/SummitsView.vue` - Main summits table component

### Modified:
- `src/utils/wotaReference.ts` - Added SOTA and Hump formatting functions
- `src/types/adif.ts` - Updated Summit interface with all database fields
- `src/App.vue` - Added Summits tab and import

## Technical Details

### Summit Interface
```typescript
export interface Summit {
  wotaid: number
  sotaid?: number | null
  name: string
  reference: string
  height: number
  book: string
  last_act_by?: string | null
  last_act_date?: string | null
  humpid?: number | null
  gridid?: string | null
}
```

### API Endpoint
Uses existing endpoint: `GET /data/api/summits`
- Already implemented in API
- Returns all summits from database
- No pagination (all summits loaded at once)

### Sorting Algorithm
- Handles null/undefined values (sorted to end)
- String comparison: Uses `localeCompare()`
- Numeric comparison: Direct subtraction
- Date comparison: Treated as strings
- Case-insensitive for strings

## Usage

1. Navigate to the "Summits" tab
2. View all summits in the table
3. Click any column header to sort by that column
4. Click again to reverse sort direction
5. Use search box to filter summits

## Examples

### WOTA References
- wotaid 1 → `LDW-001`
- wotaid 214 → `LDW-214`
- wotaid 215 → `LDO-001`
- wotaid 300 → `LDO-086`

### SOTA References
- sotaid 1 → `G/LD-001`
- sotaid 42 → `G/LD-042`
- sotaid null → `-`

### Hump References
- humpid 1 → `G/HLD-001`
- humpid 42 → `G/HLD-042`
- humpid 123 → `G/HLD-123`
- humpid null → `-`

## Performance Notes

- All summits loaded at once (no pagination)
- Sorting is client-side (instant)
- Search filtering is client-side (instant)
- Approximately 300-400 summits in database
- Very fast performance expected

## Future Enhancements

Potential improvements:
- Click row to see full summit details in popup
- Filter by book (dropdown)
- Filter by activated/never activated
- Export summits to CSV
- Link to activator logs for each summit
- Show activation count per summit
- Map view of summits
