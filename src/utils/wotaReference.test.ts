import { describe, it, expect } from 'vitest'
import { formatWotaReference, parseWotaReference, gridRefToLatLng } from './wotaReference'

describe('formatWotaReference', () => {
  it('formats LDW references correctly (wotaid <= 214)', () => {
    expect(formatWotaReference(1)).toBe('LDW-001')
    expect(formatWotaReference(50)).toBe('LDW-050')
    expect(formatWotaReference(214)).toBe('LDW-214')
  })

  it('formats LDO references correctly (wotaid > 214)', () => {
    expect(formatWotaReference(215)).toBe('LDO-001')
    expect(formatWotaReference(250)).toBe('LDO-036')
    expect(formatWotaReference(314)).toBe('LDO-100')
  })

  it('handles null and undefined', () => {
    expect(formatWotaReference(null)).toBe('N/A')
    expect(formatWotaReference(undefined)).toBe('N/A')
  })

  it('pads numbers correctly', () => {
    expect(formatWotaReference(1)).toBe('LDW-001')
    expect(formatWotaReference(10)).toBe('LDW-010')
    expect(formatWotaReference(100)).toBe('LDW-100')
  })
})

describe('parseWotaReference', () => {
  it('parses LDW references correctly', () => {
    expect(parseWotaReference('LDW-001')).toBe(1)
    expect(parseWotaReference('LDW-050')).toBe(50)
    expect(parseWotaReference('LDW-214')).toBe(214)
  })

  it('parses LDO references correctly', () => {
    expect(parseWotaReference('LDO-001')).toBe(215)
    expect(parseWotaReference('LDO-036')).toBe(250)
    expect(parseWotaReference('LDO-100')).toBe(314)
  })

  it('handles case insensitive input', () => {
    expect(parseWotaReference('ldw-001')).toBe(1)
    expect(parseWotaReference('ldo-001')).toBe(215)
  })

  it('returns null for invalid formats', () => {
    expect(parseWotaReference('invalid')).toBe(null)
    expect(parseWotaReference('123')).toBe(null)
    expect(parseWotaReference('')).toBe(null)
  })
})

describe('round-trip conversion', () => {
  it('converts back and forth correctly', () => {
    for (let i = 1; i <= 400; i++) {
      const formatted = formatWotaReference(i)
      const parsed = parseWotaReference(formatted)
      expect(parsed).toBe(i)
    }
  })
})

describe('gridRefToLatLng', () => {
  it('converts NY grid references correctly (Lake District area)', () => {
    // Helvellyn summit: NY342151
    const result = gridRefToLatLng('NY342151')
    expect(result).not.toBeNull()
    // Helvellyn is approximately at 54.527, -3.016
    expect(result!.lat).toBeCloseTo(54.527, 1)
    expect(result!.lng).toBeCloseTo(-3.016, 1)
  })

  it('handles spaces in grid references', () => {
    const result = gridRefToLatLng('NY 342 151')
    expect(result).not.toBeNull()
    expect(result!.lat).toBeCloseTo(54.527, 1)
  })

  it('handles lowercase grid references', () => {
    const result = gridRefToLatLng('ny342151')
    expect(result).not.toBeNull()
    expect(result!.lat).toBeCloseTo(54.527, 1)
  })

  it('returns null for invalid grid references', () => {
    expect(gridRefToLatLng(null)).toBeNull()
    expect(gridRefToLatLng(undefined)).toBeNull()
    expect(gridRefToLatLng('')).toBeNull()
    expect(gridRefToLatLng('invalid')).toBeNull()
    expect(gridRefToLatLng('XX123456')).toBeNull() // Invalid grid square
  })

  it('returns null for odd number of digits', () => {
    expect(gridRefToLatLng('NY12345')).toBeNull()
  })

  it('converts SD grid references correctly (southern Lake District)', () => {
    // Coniston Old Man area: SD272978
    const result = gridRefToLatLng('SD272978')
    expect(result).not.toBeNull()
    // Approximately at 54.36, -3.08
    expect(result!.lat).toBeCloseTo(54.36, 1)
    expect(result!.lng).toBeCloseTo(-3.08, 1)
  })
})
