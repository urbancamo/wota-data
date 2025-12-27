# Test Documentation

## Test Coverage Summary

**Total: 63 tests passing across 7 test files**

## Test Files

### 1. SOTA to WOTA Conversion Tests
**File:** `tests/sota-conversion.test.ts`
**Tests:** 8
**Purpose:** Verify SOTA reference detection and mapping logic

**Key Tests:**
- ✓ Loads Kirk Fell SOTA test file
- ✓ Detects SOTA reference G/LD-014
- ✓ Verifies MY_SOTA_REF field extraction
- ✓ Confirms G/LD-014 → wotaid 32 → LDW-032 mapping
- ✓ Validates all records have same SOTA reference
- ✓ Extracts SOTA references from real ADIF file

**Test File Used:** `tests/fixtures/adif/2025-03-09-Kirk-Fell-SOTA.adi`

### 2. ADIF Import Integration Tests
**File:** `tests/integration/adif-import-sota.test.ts`
**Tests:** 6
**Purpose:** Verify end-to-end SOTA to WOTA conversion logic

**Key Tests:**
- ✓ Verifies Kirk Fell mapping: G/LD-014 → wotaid 32 → LDW-032
- ✓ Simulates SOTA to WOTA conversion for all records
- ✓ Confirms original SOTA reference is preserved
- ✓ Validates all records have same SOTA reference
- ✓ Verifies SOTA references start with G/LD
- ✓ Tests WOTA reference formatting for Kirk Fell

**Test File Used:** `tests/fixtures/adif/2025-03-09-Kirk-Fell-SOTA.adi`

### 3. WOTA Reference Formatting Tests
**File:** `src/utils/wotaReference.test.ts`
**Tests:** 9
**Purpose:** Verify WOTA reference formatting and parsing

**Key Tests:**
- ✓ Formats LDW references (wotaid ≤ 214)
- ✓ Formats LDO references (wotaid > 214)
- ✓ Handles null/undefined values
- ✓ Pads numbers correctly
- ✓ Parses LDW/LDO references
- ✓ Case-insensitive parsing
- ✓ Round-trip conversion

### 4. ADIF Service Tests
**File:** `src/services/adifService.test.ts`
**Tests:** 7
**Purpose:** Verify ADIF field extraction logic

**Key Tests:**
- ✓ Extracts from MY_SOTA_REF field
- ✓ Extracts from MY_SIG_INFO when MY_SIG is SOTA
- ✓ Returns null when MY_SIG is not SOTA
- ✓ Prioritizes MY_SOTA_REF over MY_SIG_INFO
- ✓ Handles missing references
- ✓ Trims whitespace
- ✓ Case-insensitive MY_SIG field

### 5. Autocomplete Search Tests
**File:** `src/components/autocomplete.test.ts`
**Tests:** 13
**Purpose:** Verify summit autocomplete search logic

**Key Tests:**
- ✓ Finds summits by reference prefix (LDW, LDO)
- ✓ Finds summits by specific reference
- ✓ Finds summits by partial reference
- ✓ Finds summits by numeric ID
- ✓ Finds summits by name (3+ characters)
- ✓ Case-insensitive search
- ✓ Empty input handling

### 6. WOTA File Import Tests
**File:** `tests/wota-file-import.test.ts`
**Tests:** 11
**Purpose:** Verify WOTA file parsing and SOTA conversion detection

**Key Tests:**
- ✓ Loads WOTA test file with MY_SIG/MY_SIG_INFO fields
- ✓ Verifies MY_SIG set to WOTA
- ✓ Verifies MY_SIG_INFO contains LDO-093
- ✓ Confirms no MY_SOTA_REF field (not a SOTA conversion)
- ✓ Parses LDO-093 as wotaid 307
- ✓ Formats wotaid 307 as LDO-093
- ✓ Round-trip conversion for LDO references
- ✓ Verifies wotaid 307 is an Outlying Fell (LDO)
- ✓ Distinguishes SOTA conversions from native WOTA files

**Test File Used:** `tests/fixtures/adif/2025-11-26-School-Knott-Hag-End-WOTA.adi`

### 7. Database Stub Tests
**File:** `tests/db-stub.test.ts`
**Tests:** 9
**Purpose:** Verify stub mode behavior for development/testing

**Key Tests:**
- ✓ Read operations execute against real database (findMany, findFirst, findUnique, count)
- ✓ Mutation operations are stubbed and logged (create, update, delete)
- ✓ Stubbed operations return mock data
- ✓ Real database operations are never called for mutations
- ✓ Special methods ($disconnect, $connect) execute normally

**Stub Mode Usage:**
```bash
npm run start:stub  # Run entire application in stub mode
npm run api:stub    # Run only API server in stub mode
```

## Test Data

### Kirk Fell SOTA Test File
**File:** `tests/fixtures/adif/2025-03-09-Kirk-Fell-SOTA.adi`
**SOTA Reference:** G/LD-014
**Expected WOTA ID:** 32
**Expected Formatted Reference:** LDW-032
**Summit:** Kirk Fell

This file contains actual SOTA activation data that tests the automatic conversion from SOTA to WOTA references.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- sota-conversion.test.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## Test Assertions

The tests verify the complete SOTA to WOTA conversion pipeline:

1. **Detection:** ADIF file contains MY_SOTA_REF="G/LD-014"
2. **Extraction:** `extractSotaReference()` correctly identifies the SOTA ref
3. **Lookup:** SOTA ref G/LD-014 maps to Kirk Fell (wotaid 32)
4. **Conversion:** Record is updated with MY_SIG_INFO="32" and MY_SIG="WOTA"
5. **Formatting:** wotaid 32 displays as "LDW-032" in the UI
6. **Preservation:** Original MY_SOTA_REF="G/LD-014" remains in the record

## CI/CD Integration

These tests should be run:
- On every commit (pre-commit hook)
- In CI/CD pipeline before deployment
- Before merging pull requests

All tests must pass before code is merged to main branch.
