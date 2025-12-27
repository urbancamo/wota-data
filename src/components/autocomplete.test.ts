import { describe, it, expect } from 'vitest'
import { formatWotaReference } from '../utils/wotaReference'
import type { Summit } from '../types/adif'

// Mock summits data
const mockSummits: Summit[] = [
  { wotaid: 1, name: 'Scafell Pike', reference: 'LDW-001', height: 978, book: 'NW' },
  { wotaid: 50, name: 'Helvellyn', reference: 'LDW-050', height: 950, book: 'EF' },
  { wotaid: 214, name: 'Black Combe', reference: 'LDW-214', height: 600, book: 'SW' },
  { wotaid: 215, name: 'School Knott', reference: 'LDO-001', height: 381, book: 'OF' },
  { wotaid: 250, name: 'Hag End', reference: 'LDO-036', height: 242, book: 'OF' },
]

// Replicate the search logic from AdifPreviewModal
function searchSummits(input: string, summits: Summit[]): Summit[] {
  if (!input || input.length < 1) return []

  const searchTerm = input.trim().toUpperCase()
  const isReference = /^[L\d]/.test(searchTerm)

  return summits.filter((summit) => {
    if (isReference && searchTerm.length >= 1) {
      const formattedRef = formatWotaReference(summit.wotaid)

      if (formattedRef.toUpperCase().startsWith(searchTerm)) {
        return true
      }

      if (summit.wotaid.toString().startsWith(searchTerm)) {
        return true
      }

      if (summit.reference.toUpperCase().includes(searchTerm)) {
        return true
      }
    }

    if (!isReference && searchTerm.length >= 3) {
      return summit.name.toUpperCase().includes(searchTerm)
    }

    return false
  }).slice(0, 10)
}

describe('Summit Autocomplete Search', () => {
  it('finds summits by reference prefix (LDW)', () => {
    const results = searchSummits('LDW', mockSummits)
    expect(results.length).toBe(3) // All LDW summits
    expect(results[0].wotaid).toBe(1)
  })

  it('finds summits by reference prefix (LDO)', () => {
    const results = searchSummits('LDO', mockSummits)
    expect(results.length).toBe(2) // All LDO summits
    expect(results[0].wotaid).toBe(215)
  })

  it('finds summits by specific reference (LDW-050)', () => {
    const results = searchSummits('LDW-050', mockSummits)
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Helvellyn')
  })

  it('finds summits by partial reference (LDW-0)', () => {
    const results = searchSummits('LDW-0', mockSummits)
    expect(results.length).toBe(2) // LDW-001 and LDW-050
  })

  it('finds summits by numeric ID (1)', () => {
    const results = searchSummits('1', mockSummits)
    expect(results.some(s => s.wotaid === 1)).toBe(true)
  })

  it('finds summits by numeric ID (5)', () => {
    const results = searchSummits('5', mockSummits)
    expect(results.some(s => s.wotaid === 50)).toBe(true)
  })

  it('finds summits by name (at least 3 characters)', () => {
    const results = searchSummits('Sca', mockSummits)
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Scafell Pike')
  })

  it('finds summits by partial name (Hel)', () => {
    const results = searchSummits('Hel', mockSummits)
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Helvellyn')
  })

  it('finds summits by partial name (School)', () => {
    const results = searchSummits('School', mockSummits)
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('School Knott')
  })

  it('returns empty for less than 3 characters on name search', () => {
    const results = searchSummits('Sc', mockSummits)
    expect(results.length).toBe(0)
  })

  it('is case insensitive for names', () => {
    const results = searchSummits('scafell', mockSummits)
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Scafell Pike')
  })

  it('is case insensitive for references', () => {
    const results = searchSummits('ldw-001', mockSummits)
    expect(results.length).toBe(1)
    expect(results[0].wotaid).toBe(1)
  })

  it('returns empty for empty input', () => {
    const results = searchSummits('', mockSummits)
    expect(results.length).toBe(0)
  })
})
