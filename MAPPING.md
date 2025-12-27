# ADIF to activator_log Field Mapping

## Summary

This document describes how ADIF fields are transformed into `activator_log` database columns during import, and identifies differences between the new and old import systems.

## Test Results Summary

Comparison test with `2025-03-09-Kirk-Fell-SOTA.adi` (10 records):

| Field | Status | Issue |
|-------|--------|-------|
| activatedby | ❌ | M0NOM vs M5TEA (session user) |
| callused | ✅ | Correctly strips suffix from STATION_CALLSIGN |
| wotaid | ✅ | Correctly converts SOTA to WOTA |
| date | ✅ | Correctly parses date |
| year | ✅ | Correctly extracts year |
| stncall | ❌ | Keeps suffix (MW0PJE/P) vs should strip (MW0PJE) |
| ucall | ✅ | Correctly preserves CALL |
| rpt | ✅ | Always null |
| s2s | ❌ | Not detected (0 records) vs should detect (1 record with SOTA_REF) |
| confirmed | ✅ | Always null |
| time | ❌ | Parsed from ADIF vs should always be null |
| band | ❌ | Populated ("2m") vs should be null |
| frequency | ❌ | Populated (145.425) vs should be null |
| mode | ❌ | Populated ("FM") vs should be null |

## Field Mapping Table

| activator_log Column | ADIF Source Field(s) | Current Transformation | Should Be | Max Length | Notes |
|----------------------|----------------------|------------------------|-----------|------------|-------|
| **activatedby** | ~~OPERATOR~~ Session | Uses authenticated user | ✅ (backend) / ❌ (mapping) | 11 chars | Backend uses `req.session.username`, but `mapToActivatorLog()` still sets from OPERATOR |
| **callused** | STATION_CALLSIGN or OPERATOR | Strips `/P` or `/M` suffix | ✅ | 8 chars | Working correctly |
| **wotaid** | SIG_INFO or MY_SIG_INFO | Parses WOTA reference (LDW/LDO) | ✅ | integer | LDW-XXX→XXX, LDO-XXX→XXX+214. Converts SOTA references first |
| **date** | QSO_DATE | Parses YYYYMMDD to Date | ✅ | Date | Required field |
| **time** | TIME_ON | Parses HHMMSS or HHMM | ✅ | Date | Stored when present in ADIF |
| **year** | QSO_DATE | Extracted from parsed date | ✅ | integer | Derived from date field |
| **stncall** | CALL | Direct, truncated to 12 | ❌ Strip suffix | 12 chars | Should strip /P or /M |
| **ucall** | CALL | Direct, truncated to 8 | ✅ | 8 chars | Keeps suffix if it fits |
| **rpt** | ~~RST_SENT~~ | Always null | ✅ | integer | Working correctly |
| **s2s** | SIG + SIG_INFO | Checks MY_SIG="WOTA" | ❌ Check SOTA_REF | integer | S2S = station worked was on summit |
| **confirmed** | - | Always null | ✅ | integer | Not populated from ADIF |
| **band** | BAND | Populated when present | ✅ | 8 chars | Stored and used in duplicate check |
| **frequency** | FREQ | Populated as float | ✅ | float | Stored when present |
| **mode** | MODE | Populated when present | ✅ | 32 chars | Stored and used in duplicate check |

## Required Changes to Match Old System

### 1. stncall - Strip suffix from CALL field ❌

**File**: `src/services/adifService.ts`
**Function**: `mapToActivatorLog()`

**Current**:
```typescript
stncall: record.call.substring(0, 12),
```

**Should be**:
```typescript
stncall: stripPortableSuffix(record.call).substring(0, 12),
```

**Reason**: The old system stores the base callsign without /P or /M suffix in the `stncall` field.

---

### 2. s2s - Check if station worked was on a summit ❌

**File**: `src/services/adifService.ts`
**Function**: `mapToActivatorLog()`

**Current**:
```typescript
// Determine if Summit-to-Summit
const isS2S = record.sig?.toUpperCase() === 'WOTA' && record.sig_info ? 1 : 0
```

**Should be**:
```typescript
// Determine if Summit-to-Summit (station worked was also on a summit)
const isS2S = !!(
  record.sota_ref ||                                          // SOTA_REF field exists
  (record.sig === 'SOTA' && record.sig_info) ||              // SIG=SOTA with reference
  (record.sig?.toUpperCase() === 'WOTA' && record.sig_info)  // SIG=WOTA with reference (e.g., LDW-001)
) ? 1 : 0
```

**Reason**: S2S (Summit-to-Summit) means **the station you worked** was also on a summit. This is indicated by:
- `SOTA_REF` field - dedicated SOTA reference field
- `SIG="SOTA"` + `SIG_INFO` - SOTA using SIG fields
- `SIG="WOTA"` + `SIG_INFO` - WOTA summit reference (e.g., LDW-001)

The current code incorrectly checks `MY_SIG` (your own station) instead of checking if the **contacted station** was on a summit.

---

### 3. time - Now stored when present ✅

**File**: `src/services/adifService.ts`
**Function**: `mapToActivatorLog()`

**Implementation**:
```typescript
// Parse time (format: HHMM or HHMMSS)
let time: Date | undefined
if (record.time_on) {
  const timeStr = record.time_on.padEnd(6, '0') // Pad to HHMMSS if only HHMM
  const hours = parseInt(timeStr.substring(0, 2))
  const minutes = parseInt(timeStr.substring(2, 4))
  const seconds = parseInt(timeStr.substring(4, 6))

  // Create a Date object with time only (MySQL TIME type)
  time = new Date()
  time.setHours(hours, minutes, seconds, 0)
}

return {
  // ...
  time,
  // ...
}
```

**Reason**: Time is now parsed from TIME_ON field (HHMM or HHMMSS format) and stored in the database when present in ADIF files.

---

### 4. band, frequency, mode - Now stored when present ✅

**File**: `src/services/adifService.ts`
**Function**: `mapToActivatorLog()`

**Current**:
```typescript
return {
  // ...
  band: record.band?.substring(0, 8),
  frequency: record.freq ? parseFloat(record.freq) : undefined,
  mode: record.mode?.substring(0, 32),
}
```

**Reason**: Band, frequency, and mode are now stored when present in ADIF files. These fields are also used in duplicate checking to allow multiple QSOs with the same station on different bands/modes to be treated as unique records.

**Duplicate Check**: A duplicate is now defined as a QSO with the same date, wotaid, callused, ucall, **band**, and **mode**. This allows:
- G8CPZ on 2m CW = unique record
- G8CPZ on 2m FM = unique record
- G8CPZ on 2m SSB = unique record

---

## Special Cases

### Callsign Suffix Handling

Different fields handle suffixes differently:

| Field | Suffix Handling | Example Input | Example Output |
|-------|----------------|---------------|----------------|
| callused | Strip /P or /M | M0NOM/P | M0NOM |
| stncall | Strip /P or /M | MW0PJE/P | MW0PJE |
| ucall | Keep as-is | MW0PJE/P | MW0PJE/P |

### WOTA Reference Format

WOTA references use two different prefix formats based on the summit type:

| Prefix | WOTA ID Range | Conversion | Example |
|--------|---------------|------------|---------|
| **LDW** | 1-214 | Direct mapping | LDW-093 → wotaid 93 |
| **LDO** | 215+ | Add 214 to number | LDO-093 → wotaid 307 (93 + 214) |

**Implementation**: The `extractWotaId()` function uses `parseWotaReference()` utility to correctly convert:
- `LDW-XXX` → wotaid = XXX
- `LDO-XXX` → wotaid = XXX + 214
- Plain numbers (backward compatibility) → wotaid = number as-is

### SOTA to WOTA Conversion

Before field mapping, SOTA references are automatically converted:

1. Check for `MY_SOTA_REF` field
2. Look up SOTA reference in database (e.g., "G/LD-014" → wotaid 32)
3. Set `MY_SIG_INFO` to WOTA ID and `MY_SIG` to "WOTA"

### Summit-to-Summit (S2S) Detection

S2S means **both stations were operating from summits**:

- **Your station**: Indicated by MY_SOTA_REF or MY_SIG/MY_SIG_INFO
- **Station worked**: Indicated by one of:
  - `SOTA_REF` field (dedicated SOTA reference)
  - `SIG="SOTA"` + `SIG_INFO` (SOTA using SIG fields)
  - `SIG="WOTA"` + `SIG_INFO` (WOTA summit reference like LDW-001)

Set `s2s=1` if **any of the above conditions for the contacted station** are true.

## Example Transformation

**ADIF Record**:
```
<STATION_CALLSIGN:7>M0NOM/P
<CALL:7>G0EVV/P
<QSO_DATE:8>20250309
<MY_SOTA_REF:8>G/LD-014
<SOTA_REF:8>G/LD-027
<OPERATOR:5>M0NOM
<BAND:2>2m
<MODE:2>FM
<FREQ:7>145.425
```

**activator_log Record** (after authenticated user M5TEA imports):

| Field | Value | Source |
|-------|-------|--------|
| activatedby | M5TEA | Session username (not OPERATOR) |
| callused | M0NOM | STATION_CALLSIGN with /P stripped |
| wotaid | 32 | G/LD-014 converted to WOTA ID |
| date | 2025-03-09 | Parsed from QSO_DATE |
| time | null | Not stored by old system |
| year | 2025 | Extracted from date |
| stncall | G0EVV | CALL with /P stripped |
| ucall | G0EVV/P | CALL as-is (fits in 8 chars) |
| rpt | null | Always null |
| s2s | 1 | SOTA_REF field present |
| confirmed | null | Always null |
| band | null | Not stored by old system |
| frequency | null | Not stored by old system |
| mode | null | Not stored by old system |

## Testing

Run the comparison test to verify changes:

```bash
npm test -- adif-to-csv-comparison.test.ts
```

Add more test fixtures by:
1. Creating ADIF file in `tests/fixtures/adif/`
2. Exporting matching records from old system to CSV in `tests/fixtures/activator_log/`
3. Adding test case to `adif-to-csv-comparison.test.ts`
