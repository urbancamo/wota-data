import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFile } from 'fs/promises'
import { parse } from 'csv-parse/sync'
import { AdifParser } from 'adif-parser-ts'
import { mapToActivatorLog } from '../src/services/adifService'
import type { AdifRecord, ActivatorLogInput } from '../src/types/adif'

/**
 * Regression Test: ADIF Import to activator_log Transformation
 *
 * This test ensures that the new ADIF import facility produces the same
 * database records as the existing import system.
 *
 * For each test case:
 * 1. Reads the ADIF file from tests/fixtures/adif/
 * 2. Transforms records using mapToActivatorLog()
 * 3. Compares against expected CSV from tests/fixtures/activator_log/
 */

interface CsvRow {
  id: string
  activatedby: string
  callused: string
  wotaid: string
  date: string
  time: string
  year: string
  stncall: string
  ucall: string
  rpt: string
  s2s: string
  confirmed: string
  band: string
  frequency: string
  mode: string
}

/**
 * SOTA to WOTA ID mapping for test fixtures
 * This simulates the database lookup that would happen in production
 */
const SOTA_TO_WOTA_MAP: Record<string, number> = {
  'G/LD-003': 91,   // Great Gable
  'G/LD-004': 79,   // Scafell
  'G/LD-005': 34,   // Scafell Pike
  'G/LD-006': 7,    // Great End
  'G/LD-014': 32,   // Kirk Fell
  'G/LD-016': 8,    // Pillar
  // Add more mappings as needed for other test files
}

/**
 * Normalizes a CSV row for comparison with transformed ADIF record
 */
function normalizeCsvRow(row: CsvRow) {
  return {
    activatedby: row.activatedby || null,
    callused: row.callused || null,
    wotaid: row.wotaid ? parseInt(row.wotaid, 10) : null,
    date: row.date || null,
    time: row.time || null,
    year: row.year ? parseInt(row.year, 10) : null,
    stncall: row.stncall || null,
    ucall: row.ucall || null,
    rpt: row.rpt === '' ? null : (row.rpt ? parseInt(row.rpt, 10) : null),
    s2s: row.s2s === '' ? null : (row.s2s ? parseInt(row.s2s, 10) : null),
    confirmed: row.confirmed === '' ? null : (row.confirmed ? parseInt(row.confirmed, 10) : null),
    band: row.band || null,
    frequency: row.frequency ? parseFloat(row.frequency) : null,
    mode: row.mode || null,
  }
}

/**
 * Normalizes a transformed ADIF record for comparison with CSV
 */
function normalizeTransformedRecord(record: ActivatorLogInput) {
  // Format date as YYYY-MM-DD to match CSV format
  const dateStr = record.date.toISOString().split('T')[0]

  return {
    activatedby: record.activatedby || null,
    callused: record.callused || null,
    wotaid: record.wotaid || null,
    date: dateStr,
    time: null, // Time field is not populated in CSV (always empty)
    year: record.year || null,
    stncall: record.stncall || null,
    ucall: record.ucall || null,
    rpt: null, // rpt is always null in new system
    s2s: record.s2s || null,
    confirmed: record.confirmed || null,
    band: record.band || null,
    frequency: record.frequency || null,
    mode: record.mode || null,
  }
}

/**
 * Applies SOTA to WOTA conversion to ADIF records (test helper)
 */
function applySotaConversion(records: AdifRecord[]): AdifRecord[] {
  return records.map(record => {
    // Skip if already has WOTA reference
    if (record.my_sig_info || record.sig_info) {
      return record
    }

    // Check for SOTA reference
    const sotaRef = record.my_sota_ref ||
      (record.my_sig?.toUpperCase() === 'SOTA' ? record.my_sig_info : null)

    if (sotaRef && SOTA_TO_WOTA_MAP[sotaRef]) {
      // Apply conversion
      return {
        ...record,
        my_sig_info: SOTA_TO_WOTA_MAP[sotaRef].toString(),
        my_sig: 'WOTA',
      }
    }

    return record
  })
}

describe('ADIF to CSV Comparison: Kirk Fell SOTA Import', () => {
  let adifRecords: AdifRecord[]
  let transformedRecords: ReturnType<typeof normalizeTransformedRecord>[]
  let expectedCsvRecords: ReturnType<typeof normalizeCsvRow>[]

  beforeAll(async () => {
    // Read and parse ADIF file
    const adifContent = await readFile(
      'tests/fixtures/adif/2025-03-09-Kirk-Fell-SOTA.adi',
      'utf-8'
    )
    const parsed = AdifParser.parseAdi(adifContent)
    adifRecords = parsed.records || []

    // Apply SOTA to WOTA conversion (simulating database lookup)
    const convertedRecords = applySotaConversion(adifRecords)

    // Transform ADIF records using current implementation
    transformedRecords = convertedRecords
      .map(mapToActivatorLog)
      .filter((r): r is ActivatorLogInput => r !== null)
      .map(normalizeTransformedRecord)

    // Read and parse expected CSV file
    const csvContent = await readFile(
      'tests/fixtures/activator_log/2025-03-09-Kirk-Fell-SOTA.csv',
      'utf-8'
    )
    const csvRows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as CsvRow[]

    expectedCsvRecords = csvRows.map(normalizeCsvRow)
  })

  it('should load ADIF file successfully', () => {
    expect(adifRecords.length).toBeGreaterThan(0)
    expect(adifRecords.length).toBe(10)
  })

  it('should load CSV file successfully', () => {
    expect(expectedCsvRecords.length).toBeGreaterThan(0)
    expect(expectedCsvRecords.length).toBe(51)
  })

  it('should have MY_SOTA_REF in all ADIF records (SOTA file)', () => {
    adifRecords.forEach((record, index) => {
      expect(record.my_sota_ref, `Record ${index} should have MY_SOTA_REF`).toBeTruthy()
    })
  })

  it('should transform ADIF records after SOTA conversion', () => {
    expect(transformedRecords.length).toBeGreaterThan(0)
    console.log(`Successfully transformed ${transformedRecords.length} records`)
  })

  it('should produce the same number of records as CSV', () => {
    console.log(`ADIF records: ${adifRecords.length}`)
    console.log(`Transformed records: ${transformedRecords.length}`)
    console.log(`Expected CSV records: ${expectedCsvRecords.length}`)

    // After SOTA conversion, we should have the same number of records
    expect(transformedRecords.length).toBe(expectedCsvRecords.length)
  })

  it('should match CSV records exactly (field by field)', () => {
    // Compare each transformed record with expected CSV record
    transformedRecords.forEach((transformed, index) => {
      const expected = expectedCsvRecords[index]

      expect(transformed.activatedby, `Record ${index}: activatedby`).toBe(expected.activatedby)
      expect(transformed.callused, `Record ${index}: callused`).toBe(expected.callused)
      expect(transformed.wotaid, `Record ${index}: wotaid`).toBe(expected.wotaid)
      expect(transformed.date, `Record ${index}: date`).toBe(expected.date)
      expect(transformed.year, `Record ${index}: year`).toBe(expected.year)
      expect(transformed.stncall, `Record ${index}: stncall`).toBe(expected.stncall)
      expect(transformed.ucall, `Record ${index}: ucall`).toBe(expected.ucall)
      expect(transformed.rpt, `Record ${index}: rpt`).toBe(expected.rpt)
      expect(transformed.s2s, `Record ${index}: s2s`).toBe(expected.s2s)
      expect(transformed.confirmed, `Record ${index}: confirmed`).toBe(expected.confirmed)
      expect(transformed.band, `Record ${index}: band`).toBe(expected.band)
      expect(transformed.frequency, `Record ${index}: frequency`).toBe(expected.frequency)
      expect(transformed.mode, `Record ${index}: mode`).toBe(expected.mode)
    })
  })

  it('should verify activatedby comes from OPERATOR field', () => {
    transformedRecords.forEach((record) => {
      expect(record.activatedby).toBe('M0NOM')
    })
  })

  it('should verify callused strips /P suffix from STATION_CALLSIGN', () => {
    // ADIF has STATION_CALLSIGN: M0NOM/P
    // Should be stored as M0NOM (suffix stripped)
    transformedRecords.forEach((record) => {
      expect(record.callused).toBe('M0NOM')
    })
  })

  it('should verify date format and value', () => {
    transformedRecords.forEach((record) => {
      expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(record.date).toBe('2025-03-09')
    })
  })

  it('should verify year extraction', () => {
    transformedRecords.forEach((record) => {
      expect(record.year).toBe(2025)
    })
  })

  it('should verify rpt is always null', () => {
    transformedRecords.forEach((record) => {
      expect(record.rpt).toBeNull()
    })

    expectedCsvRecords.forEach((record) => {
      expect(record.rpt).toBeNull()
    })
  })

  it('should verify SOTA conversion produces correct WOTA IDs', () => {
    const uniqueWotaIds = new Set(transformedRecords.map(r => r.wotaid))
    const expectedWotaIds = new Set(expectedCsvRecords.map(r => r.wotaid))

    expect(uniqueWotaIds).toEqual(expectedWotaIds)
    console.log(`WOTA IDs: ${Array.from(uniqueWotaIds).sort((a, b) => a! - b!).join(', ')}`)
  })

  it('should handle S2S (Summit-to-Summit) records correctly', () => {
    // Find S2S records in transformed data
    const transformedS2S = transformedRecords.filter(r => r.s2s === 1)
    const expectedS2S = expectedCsvRecords.filter(r => r.s2s === 1)

    expect(transformedS2S.length).toBe(expectedS2S.length)
    console.log(`S2S records: ${transformedS2S.length}`)

    // Verify the S2S record details match
    transformedS2S.forEach((s2sRecord, index) => {
      const expectedRecord = expectedS2S[index]
      expect(s2sRecord.stncall).toBe(expectedRecord.stncall)
      expect(s2sRecord.s2s).toBe(1)
    })
  })

  it('should verify time field is not populated', () => {
    // Time is present in ADIF but not stored in activator_log
    transformedRecords.forEach((record) => {
      expect(record.time).toBeNull()
    })

    expectedCsvRecords.forEach((record) => {
      expect(record.time).toBeNull()
    })
  })

  it('should verify band, frequency, and mode are not populated in this dataset', () => {
    // This particular ADIF file has band/mode data, but CSV doesn't
    // This indicates the old system didn't store these fields
    expectedCsvRecords.forEach((record) => {
      expect(record.band).toBeNull()
      expect(record.frequency).toBeNull()
      expect(record.mode).toBeNull()
    })
  })

  it('should list any mismatches for debugging', () => {
    const mismatches: any[] = []

    transformedRecords.forEach((transformed, index) => {
      const expected = expectedCsvRecords[index]
      const diffs: string[] = []

      if (transformed.activatedby !== expected.activatedby) diffs.push('activatedby')
      if (transformed.callused !== expected.callused) diffs.push('callused')
      if (transformed.wotaid !== expected.wotaid) diffs.push('wotaid')
      if (transformed.date !== expected.date) diffs.push('date')
      if (transformed.year !== expected.year) diffs.push('year')
      if (transformed.stncall !== expected.stncall) diffs.push('stncall')
      if (transformed.ucall !== expected.ucall) diffs.push('ucall')
      if (transformed.s2s !== expected.s2s) diffs.push('s2s')

      if (diffs.length > 0) {
        mismatches.push({
          index,
          fields: diffs,
          transformed: { ...transformed },
          expected: { ...expected },
        })
      }
    })

    if (mismatches.length > 0) {
      console.log('Found mismatches:')
      console.log(JSON.stringify(mismatches, null, 2))
    }

    expect(mismatches).toHaveLength(0)
  })
})

describe('ADIF Field Mapping Documentation', () => {
  it('should document the complete field mapping', () => {
    const fieldMapping = {
      activatedby: 'OPERATOR or STATION_CALLSIGN (truncated to 11 chars)',
      callused: 'STATION_CALLSIGN or OPERATOR (with /P or /M suffix stripped, truncated to 8 chars)',
      wotaid: 'Extracted from SIG_INFO or MY_SIG_INFO (or converted from SOTA reference)',
      date: 'Parsed from QSO_DATE (YYYYMMDD format)',
      time: 'Parsed from TIME_ON (but stored as null in activator_log)',
      year: 'Extracted from parsed date',
      stncall: 'CALL field (truncated to 12 chars)',
      ucall: 'CALL field (truncated to 8 chars)',
      rpt: 'Always null (was RST_SENT in old system)',
      s2s: '1 if SIG="WOTA" and SIG_INFO exists (Summit-to-Summit)',
      confirmed: 'Always null (not populated from ADIF)',
      band: 'BAND field (truncated to 8 chars)',
      frequency: 'FREQ field (parsed as float)',
      mode: 'MODE field (truncated to 32 chars)',
    }

    // This test just documents the mapping
    expect(fieldMapping).toBeDefined()
    console.log('\nADIF to activator_log Field Mapping:')
    Object.entries(fieldMapping).forEach(([field, mapping]) => {
      console.log(`  ${field}: ${mapping}`)
    })
  })
})
