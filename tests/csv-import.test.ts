import { describe, it, expect, vi, beforeAll } from 'vitest'
import { parseCsvContent, calculateStatistics } from '../src/services/csvService'
import { mapToActivatorLog } from '../src/services/adifService'
import { readFileSync } from 'fs'
import { join } from 'path'

// Mock the API client
vi.mock('../src/services/api', () => ({
  apiClient: {
    lookupSotaReference: vi.fn(async (sotaRef: string) => {
      // Mock database lookups for SOTA references
      const sotaToWotaMap: Record<string, { wotaid: number; name: string } | null> = {
        'G/LD-056': { wotaid: 323, name: 'Whitbarrow' },
        'G/LD-018': { wotaid: 232, name: 'High Street' },
        'LA/OS-001': null, // Norwegian SOTA, not WOTA
        'SP/BZ-084': null, // Polish SOTA, not WOTA
      }

      return sotaToWotaMap[sotaRef] || null
    }),
  },
}))

describe('CSV Import', () => {
  const csvFilename = '2025-11-26-School-Knott-Hagg-End-WOTA-IMPORT.csv'

  it('should parse SOTA CSV format correctly', async () => {
    // Read test CSV file
    const csvPath = join(__dirname, 'fixtures/csv', csvFilename)
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    expect(parsed.records.length).toBe(3)
    expect(parsed.errors.length).toBe(0)
  })

  it('should convert CSV records to correct format', async () => {
    const csvPath = join(__dirname, 'fixtures/csv', csvFilename)
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    // Check first record
    const firstRecord = parsed.records[0]
    expect(firstRecord.call).toBe('G8CPZ')
    expect(firstRecord.qso_date).toBe('20251126')
    expect(firstRecord.time_on).toBe('1258')
    expect(firstRecord.station_callsign).toBe('M5TEA/P')
    expect(firstRecord.my_sig_info).toBe('LDO-093')
    expect(firstRecord.band).toBe('2m')
    expect(firstRecord.mode).toBe('FM')
  })

  it('should map frequency to correct band', async () => {
    const csvPath = join(__dirname, 'fixtures/csv', csvFilename)
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    // All records should have 144MHz mapped to 2m
    parsed.records.forEach((record) => {
      expect(record.band).toBe('2m')
    })
  })

  it('should parse dd/mm/yy date format', async () => {
    const csvPath = join(__dirname, 'fixtures/csv', csvFilename)
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    // 26/11/25 should be converted to 20251126
    parsed.records.forEach((record) => {
      expect(record.qso_date).toBe('20251126')
    })
  })

  it('should map CSV to ActivatorLogInput correctly', async () => {
    const csvPath = join(__dirname, 'fixtures/csv', csvFilename)
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)
    const mapped = parsed.records
      .map(mapToActivatorLog)
      .filter((r) => r !== null)

    expect(mapped.length).toBe(3)

    // Check first record
    const first = mapped[0]
    expect(first.wotaid).toBe(307) // LDO-093 = 93 + 214
    expect(first.stncall).toBe('G8CPZ')
    expect(first.callused).toBe('M5TEA')
    expect(first.band).toBe('2m')
    expect(first.mode).toBe('FM')
  })

  it('should calculate statistics correctly', async () => {
    const csvPath = join(__dirname, 'fixtures/csv', csvFilename)
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)
    const stats = calculateStatistics(parsed.records, parsed.errors)

    expect(stats.totalQsos).toBe(3)
    expect(stats.validRecords).toBe(3)
    expect(stats.errors).toBe(0)
    expect(stats.summits).toEqual([307]) // LDO-093
  })

  it('should handle different modes correctly', async () => {
    const csvPath = join(__dirname, 'fixtures/csv', csvFilename)
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    // Should have FM, SSB, and CW
    const modes = parsed.records.map(r => r.mode)
    expect(modes).toContain('FM')
    expect(modes).toContain('SSB')
    expect(modes).toContain('CW')
  })

  it('should handle S2S references in column 9', async () => {
    const csvPath = join(__dirname, 'fixtures/csv/2025-11-26-S2S-Test.csv')
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    expect(parsed.records.length).toBe(4)

    // Record 1: S2S with LDW-001
    expect(parsed.records[0].sig_info).toBe('LDW-001')
    expect(parsed.records[0].sig).toBe('WOTA')

    // Record 2: S2S with LDO-042
    expect(parsed.records[1].sig_info).toBe('LDO-042')
    expect(parsed.records[1].sig).toBe('WOTA')

    // Record 3: No S2S reference
    expect(parsed.records[2].sig_info).toBeUndefined()
    expect(parsed.records[2].sig).toBeUndefined()

    // Record 4: S2S with LDW-001 and comment (comment should be ignored)
    expect(parsed.records[3].sig_info).toBe('LDW-001')
    expect(parsed.records[3].sig).toBe('WOTA')
  })

  it('should set s2s flag when S2S reference is present', async () => {
    const csvPath = join(__dirname, 'fixtures/csv/2025-11-26-S2S-Test.csv')
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)
    const mapped = parsed.records
      .map(mapToActivatorLog)
      .filter((r) => r !== null)

    expect(mapped.length).toBe(4)

    // Records with S2S references should have s2s = true
    expect(mapped[0].s2s).toBe(true)  // LDW-001
    expect(mapped[1].s2s).toBe(true)  // LDO-042
    expect(mapped[2].s2s).toBe(false) // No S2S
    expect(mapped[3].s2s).toBe(true)  // LDW-001 with comment
  })

  it('should parse Whitbarrow Scar SOTA CSV correctly', async () => {
    const csvPath = join(__dirname, 'fixtures/csv/2022-03-19-Whitbarrow-Scar-SOTA-POTA-WWFF.csv')
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    // Should have 134 records
    expect(parsed.records.length).toBe(134)
    expect(parsed.errors.length).toBe(0)

    // Check first record
    const first = parsed.records[0]
    expect(first.call).toBe('F4WBN')
    expect(first.qso_date).toBe('20220319')
    expect(first.time_on).toBe('1423')
    expect(first.station_callsign).toBe('M0NOM/P')
    expect(first.mode).toBe('SSB')

    // Check SOTA reference was converted to WOTA
    // G/LD-056 will be looked up in database and converted to appropriate WOTA reference
    expect(first.my_sig).toBe('WOTA')

    // Check different frequency bands
    const bands = new Set(parsed.records.map(r => r.band))
    expect(bands.has('20m')).toBe(true)  // 14MHz
    expect(bands.has('40m')).toBe(true)  // 7MHz
    expect(bands.has('2m')).toBe(true)   // 144MHz
    expect(bands.has('17m')).toBe(true)  // 18MHz
    expect(bands.has('10m')).toBe(true)  // 28MHz
  })

  it('should handle non-WOTA S2S SOTA references correctly', async () => {
    const csvPath = join(__dirname, 'fixtures/csv/2022-03-19-Whitbarrow-Scar-SOTA-POTA-WWFF.csv')
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    // Line 6: LB9HI/P,LA/OS-001 - Norwegian SOTA, not WOTA
    // Should NOT set S2S since LA/OS-001 is not a WOTA summit
    const record6 = parsed.records[5] // 0-indexed
    expect(record6.call).toBe('LB9HI/P')
    // S2S reference should be cleared since LA/OS-001 is not WOTA
    expect(record6.sig_info).toBeUndefined()
    expect(record6.sig).toBeUndefined()

    // Line 19: DQ9JTR/P,SP/BZ-084 - Polish SOTA, not WOTA
    const record19 = parsed.records[18]
    expect(record19.call).toBe('DQ9JTR/P')
    expect(record19.sig_info).toBeUndefined()
    expect(record19.sig).toBeUndefined()
  })

  it('should map Whitbarrow CSV to ActivatorLogInput correctly', async () => {
    const csvPath = join(__dirname, 'fixtures/csv/2022-03-19-Whitbarrow-Scar-SOTA-POTA-WWFF.csv')
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)
    const mapped = parsed.records
      .map(mapToActivatorLog)
      .filter((r) => r !== null)

    expect(mapped.length).toBe(134)

    // Check first record mapping
    const first = mapped[0]
    expect(first.wotaid).toBe(323)  // LDO-109 = 109 + 214 = 323
    expect(first.stncall).toBe('F4WBN')
    expect(first.callused).toBe('M0NOM')  // /P should be stripped
    expect(first.band).toBe('20m')
    expect(first.mode).toBe('SSB')
    expect(first.s2s).toBe(false)  // No S2S WOTA reference
  })

  it('should correctly separate activator and S2S summit references', async () => {
    const csvPath = join(__dirname, 'fixtures/csv/2020-09-19-Loft-Crag-WOTA.csv')
    const csvContent = readFileSync(csvPath, 'utf-8')

    const parsed = await parseCsvContent(csvContent)

    // Last record is M1BUU/P on G/LD-018 (S2S contact)
    const lastRecord = parsed.records[parsed.records.length - 1]

    // Activator's summit should be in my_sig_info
    expect(lastRecord.my_sig_info).toBe('LDW-097')
    expect(lastRecord.my_sig).toBe('WOTA')

    // S2S summit should be converted from G/LD-018 to LDO-018 (wotaid 232 = 18 + 214)
    expect(lastRecord.sig_info).toBe('LDO-018')
    expect(lastRecord.sig).toBe('WOTA')

    // Station call should be correct
    expect(lastRecord.call).toBe('M1BUU/P')
  })
})
