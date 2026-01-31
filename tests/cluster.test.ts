import { describe, it, expect } from 'vitest'
import {
  parseFrequency,
  formatWotaReference,
  formatZuluTime,
  formatSpot
} from '../server/cluster/spotFormatter'
import { isValidCallsign } from '../server/cluster/client'
import type { SpotWithSummit } from '../server/cluster/types'

describe('Cluster Server - Spot Formatter', () => {
  describe('parseFrequency', () => {
    it('should parse MHz frequency and convert to kHz', () => {
      expect(parseFrequency('7.032 SSB')).toBe(7032)
      expect(parseFrequency('14.285 CW')).toBe(14285)
      expect(parseFrequency('145.500 FM')).toBe(145500)
    })

    it('should handle frequency already in kHz', () => {
      expect(parseFrequency('7032 SSB')).toBe(7032)
      expect(parseFrequency('14285 CW')).toBe(14285)
    })

    it('should handle frequency with extra spaces', () => {
      expect(parseFrequency('  7.032   SSB  ')).toBe(7032)
    })

    it('should return 0 for invalid frequency', () => {
      expect(parseFrequency('')).toBe(0)
      expect(parseFrequency('SSB')).toBe(0)
      expect(parseFrequency('invalid')).toBe(0)
    })
  })

  describe('formatWotaReference', () => {
    it('should format LDW references (1-214)', () => {
      expect(formatWotaReference(1)).toBe('LDW-001')
      expect(formatWotaReference(14)).toBe('LDW-014')
      expect(formatWotaReference(214)).toBe('LDW-214')
    })

    it('should format LDO references (215+)', () => {
      expect(formatWotaReference(215)).toBe('LDO-001')
      expect(formatWotaReference(220)).toBe('LDO-006')
      expect(formatWotaReference(300)).toBe('LDO-086')
    })
  })

  describe('formatZuluTime', () => {
    it('should format time in Zulu format', () => {
      const date = new Date('2025-01-31T14:23:00Z')
      expect(formatZuluTime(date)).toBe('1423Z')
    })

    it('should pad hours and minutes with zeros', () => {
      const date = new Date('2025-01-31T09:05:00Z')
      expect(formatZuluTime(date)).toBe('0905Z')
    })
  })

  describe('formatSpot', () => {
    it('should format a spot with summit info', () => {
      const spot: SpotWithSummit = {
        id: 1,
        datetime: new Date('2025-01-31T14:23:00Z'),
        call: 'G4XYZ/P',
        wotaid: 1,
        freqmode: '7.032 SSB',
        comment: 'Test',
        spotter: 'M0ABC',
        summit: {
          reference: 'LDW-001',
          name: 'Scafell Pike'
        }
      }

      const output = formatSpot(spot)

      expect(output).toContain('DX de M0ABC')
      expect(output).toContain('7032.0')
      expect(output).toContain('G4XYZ/P')
      expect(output).toContain('LDW-001')
      expect(output).toContain('Scafell Pike')
      expect(output).toContain('1423Z')
      expect(output.endsWith('\r\n')).toBe(true)
    })

    it('should format a spot without summit info using wotaid', () => {
      const spot: SpotWithSummit = {
        id: 2,
        datetime: new Date('2025-01-31T10:30:00Z'),
        call: 'G0XYZ',
        wotaid: 50,
        freqmode: '14.285 CW',
        comment: 'Loud',
        spotter: 'M7DEF',
        summit: null
      }

      const output = formatSpot(spot)

      expect(output).toContain('DX de M7DEF')
      expect(output).toContain('14285.0')
      expect(output).toContain('G0XYZ')
      expect(output).toContain('LDW-050')
      expect(output).toContain('1030Z')
    })
  })
})

describe('Cluster Server - Client', () => {
  describe('isValidCallsign', () => {
    it('should accept valid callsigns', () => {
      expect(isValidCallsign('M0ABC')).toBe(true)
      expect(isValidCallsign('G4XYZ')).toBe(true)
      expect(isValidCallsign('2E0AAA')).toBe(true)
      expect(isValidCallsign('VK3AB')).toBe(true)
      expect(isValidCallsign('W1AW')).toBe(true)
    })

    it('should accept portable and mobile suffixes', () => {
      expect(isValidCallsign('G4XYZ/P')).toBe(true)
      expect(isValidCallsign('M0ABC/M')).toBe(true)
      expect(isValidCallsign('G0DEF/A')).toBe(true)
    })

    it('should reject invalid callsigns', () => {
      expect(isValidCallsign('')).toBe(false)
      expect(isValidCallsign('AB')).toBe(false)
      expect(isValidCallsign('NOTACALLSIGN')).toBe(false)
      expect(isValidCallsign('123456')).toBe(false)
    })

    it('should reject callsigns that are too long', () => {
      expect(isValidCallsign('VERYLONGCALLSIGN')).toBe(false)
    })
  })
})
