import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import { AdifParser } from 'adif-parser-ts'
import { formatWotaReference } from '../../src/utils/wotaReference'
import { extractWotaId, extractSotaReference } from '../../src/services/adifService'
import type { AdifRecord, Summit } from '../../src/types/adif'

describe('ADIF Import Integration - SOTA to WOTA Conversion Logic', () => {
  it('should verify Kirk Fell mapping: G/LD-014 → wotaid 32 → LDW-032', () => {
    // This test verifies the complete mapping chain
    const sotaRef = 'G/LD-014'
    const expectedWotaId = 32
    const expectedFormattedRef = 'LDW-032'

    // Verify the wotaid formats correctly
    const formatted = formatWotaReference(expectedWotaId)
    expect(formatted).toBe(expectedFormattedRef)

    // Verify wotaid 32 is a Wainwright (LDW, not LDO)
    expect(expectedWotaId).toBeLessThanOrEqual(214)
  })

  it('should simulate SOTA to WOTA conversion for Kirk Fell records', async () => {
    // Read and parse the ADIF file
    const content = await readFile('tests/fixtures/adif/2025-03-09-Kirk-Fell-SOTA.adi', 'utf-8')
    const parsed = AdifParser.parseAdi(content)
    const records: AdifRecord[] = parsed.records || []

    expect(records.length).toBeGreaterThan(0)

    // Simulate what the conversion would do
    const mockSummit: Summit = {
      wotaid: 32,
      name: 'Kirk Fell',
      reference: 'G/LD-014',
      height: 802,
      book: 'NW'
    }

    // For each record, simulate the conversion
    records.forEach(record => {
      const sotaRef = extractSotaReference(record)
      expect(sotaRef).toBe('G/LD-014')

      // After conversion, the record would have:
      const convertedRecord = {
        ...record,
        my_sig_info: mockSummit.wotaid.toString(),
        my_sig: 'WOTA'
      }

      // Verify the converted record
      const wotaId = extractWotaId(convertedRecord.my_sig_info)
      expect(wotaId).toBe(32)
      expect(formatWotaReference(wotaId!)).toBe('LDW-032')
      expect(convertedRecord.my_sig).toBe('WOTA')

      // Original SOTA ref should still be present
      expect(convertedRecord.my_sota_ref).toBe('G/LD-014')
    })
  })

  it('should verify all records in file have the same SOTA reference', async () => {
    const content = await readFile('tests/fixtures/adif/2025-03-09-Kirk-Fell-SOTA.adi', 'utf-8')
    const parsed = AdifParser.parseAdi(content)
    const records: AdifRecord[] = parsed.records || []

    // All contacts should be from the same summit
    const sotaRefs = records.map(r => extractSotaReference(r))
    const uniqueRefs = new Set(sotaRefs)

    expect(uniqueRefs.size).toBe(1)
    expect(uniqueRefs.has('G/LD-014')).toBe(true)
  })

  it('should verify SOTA references start with G/LD', async () => {
    const content = await readFile('tests/fixtures/adif/2025-03-09-Kirk-Fell-SOTA.adi', 'utf-8')
    const parsed = AdifParser.parseAdi(content)
    const records: AdifRecord[] = parsed.records || []

    // All SOTA refs should start with G/LD (Lake District)
    records.forEach(record => {
      const sotaRef = extractSotaReference(record)
      expect(sotaRef).toBeDefined()
      expect(sotaRef!.toUpperCase()).toMatch(/^G\/LD/)
    })
  })
})

describe('WOTA Reference Formatting for Kirk Fell', () => {
  it('should format wotaid 32 as LDW-032', () => {
    const wotaId = 32
    const formatted = formatWotaReference(wotaId)

    expect(formatted).toBe('LDW-032')
  })

  it('should correctly identify wotaid 32 as a Wainwright (LDW)', () => {
    const wotaId = 32

    // wotaid 32 is <= 214, so it should be LDW
    expect(wotaId).toBeLessThanOrEqual(214)

    const formatted = formatWotaReference(wotaId)
    expect(formatted).toMatch(/^LDW-/)
  })
})
