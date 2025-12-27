import { describe, it, expect } from 'vitest'
import { extractSotaReference } from './adifService'
import type { AdifRecord } from '../types/adif'

describe('extractSotaReference', () => {
  it('extracts SOTA reference from MY_SOTA_REF field', () => {
    const record: AdifRecord = {
      call: 'M0ABC',
      my_sota_ref: 'G/LD-001',
    }

    const result = extractSotaReference(record)
    expect(result).toBe('G/LD-001')
  })

  it('extracts SOTA reference from MY_SIG_INFO when MY_SIG is SOTA', () => {
    const record: AdifRecord = {
      call: 'M0ABC',
      my_sig: 'SOTA',
      my_sig_info: 'G/LD-050',
    }

    const result = extractSotaReference(record)
    expect(result).toBe('G/LD-050')
  })

  it('returns null when MY_SIG is not SOTA', () => {
    const record: AdifRecord = {
      call: 'M0ABC',
      my_sig: 'WOTA',
      my_sig_info: 'LDW-001',
    }

    const result = extractSotaReference(record)
    expect(result).toBe(null)
  })

  it('prioritizes MY_SOTA_REF over MY_SIG_INFO', () => {
    const record: AdifRecord = {
      call: 'M0ABC',
      my_sota_ref: 'G/LD-001',
      my_sig: 'SOTA',
      my_sig_info: 'G/LD-050',
    }

    const result = extractSotaReference(record)
    expect(result).toBe('G/LD-001')
  })

  it('returns null when no SOTA reference present', () => {
    const record: AdifRecord = {
      call: 'M0ABC',
    }

    const result = extractSotaReference(record)
    expect(result).toBe(null)
  })

  it('trims whitespace from SOTA references', () => {
    const record: AdifRecord = {
      call: 'M0ABC',
      my_sota_ref: '  G/LD-001  ',
    }

    const result = extractSotaReference(record)
    expect(result).toBe('G/LD-001')
  })

  it('is case-insensitive for MY_SIG field', () => {
    const record: AdifRecord = {
      call: 'M0ABC',
      my_sig: 'sota',
      my_sig_info: 'G/LD-100',
    }

    const result = extractSotaReference(record)
    expect(result).toBe('G/LD-100')
  })
})
