import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'fs/promises'
import { AdifParser } from 'adif-parser-ts'
import { formatWotaReference, parseWotaReference } from '../src/utils/wotaReference'
import { extractWotaId } from '../src/services/adifService'
import type { AdifRecord } from '../src/types/adif'

describe('WOTA File Import - School Knott and Hag End', () => {
  let records: AdifRecord[]

  beforeAll(async () => {
    const content = await readFile('tests/fixtures/adif/2025-11-26-School-Knott-Hag-End-WOTA.adi', 'utf-8')
    const parsed = AdifParser.parseAdi(content)
    records = parsed.records || []
  })

  it('should load the WOTA test file', () => {
    expect(records.length).toBeGreaterThan(0)
  })

  it('should have MY_SIG set to WOTA', () => {
    records.forEach(record => {
      expect(record.my_sig).toBe('WOTA')
    })
  })

  it('should have MY_SIG_INFO set to LDO-093', () => {
    records.forEach(record => {
      expect(record.my_sig_info).toBe('LDO-093')
    })
  })

  it('should NOT have MY_SOTA_REF (not a SOTA conversion)', () => {
    records.forEach(record => {
      expect(record.my_sota_ref).toBeUndefined()
    })
  })

  it('should parse LDO-093 as wotaid 307', () => {
    const wotaId = parseWotaReference('LDO-093')

    // LDO-093 means: 093 + 214 = 307
    expect(wotaId).toBe(307)
  })

  it('should format wotaid 307 as LDO-093', () => {
    const formatted = formatWotaReference(307)

    // wotaid 307 is > 214, so it's LDO
    // 307 - 214 = 93, formatted as LDO-093
    expect(formatted).toBe('LDO-093')
  })

  it('should correctly round-trip LDO-093', () => {
    const original = 'LDO-093'

    // Parse to wotaid
    const wotaId = parseWotaReference(original)
    expect(wotaId).toBe(307)

    // Format back
    const formatted = formatWotaReference(wotaId!)
    expect(formatted).toBe(original)
  })

  it('should handle MY_SIG_INFO with formatted reference', () => {
    const record = records[0]
    const sigInfo = record.my_sig_info

    // First try to parse as formatted reference
    let wotaId = parseWotaReference(sigInfo || '')

    if (wotaId === null) {
      // Fall back to extracting number
      wotaId = extractWotaId(sigInfo)
    }

    expect(wotaId).toBe(307)
    expect(formatWotaReference(wotaId!)).toBe('LDO-093')
  })

  it('should verify wotaid 307 is an Outlying Fell (LDO)', () => {
    const wotaId = 307

    // wotaid > 214 means it's an Outlying Fell (LDO)
    expect(wotaId).toBeGreaterThan(214)

    const formatted = formatWotaReference(wotaId)
    expect(formatted).toMatch(/^LDO-/)
  })
})

describe('SOTA Conversion Detection', () => {
  it('should NOT flag WOTA files as SOTA conversions', async () => {
    const content = await readFile('tests/fixtures/adif/2025-11-26-School-Knott-Hag-End-WOTA.adi', 'utf-8')
    const parsed = AdifParser.parseAdi(content)
    const records = parsed.records || []

    // These records should NOT be flagged as SOTA conversions
    // because they don't have MY_SOTA_REF
    records.forEach(record => {
      const isSotaConversion = !!(record.my_sota_ref)
      expect(isSotaConversion).toBe(false)
    })
  })

  it('should flag actual SOTA conversions', async () => {
    const content = await readFile('tests/fixtures/adif/2025-03-09-Kirk-Fell-SOTA.adi', 'utf-8')
    const parsed = AdifParser.parseAdi(content)
    const records = parsed.records || []

    // These records SHOULD be flagged as SOTA conversions
    // because they have MY_SOTA_REF
    records.forEach(record => {
      const isSotaConversion = !!(record.my_sota_ref)
      expect(isSotaConversion).toBe(true)
    })
  })
})
