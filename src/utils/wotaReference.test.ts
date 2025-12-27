import { describe, it, expect } from 'vitest'
import { formatWotaReference, parseWotaReference } from './wotaReference'

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
