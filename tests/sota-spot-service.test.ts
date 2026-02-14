import { describe, it, expect } from 'vitest'
import {
  convertTimestamp,
  buildComment,
  parseSotaNumber,
  filterLakeDistrictSpots,
  convertSotaToWotaSpot,
} from '../server/sota/spotConverter'
import { SotaSpotTracker } from '../server/sota/spotTracker'
import type { SotaSpot } from '../server/sota/types'

function makeSotaSpot(overrides: Partial<SotaSpot> = {}): SotaSpot {
  return {
    Id: 12345,
    Timestamp: '2019-05-21T19:06:59.999',
    Comments: 'TEST PLEASE IGNORE',
    Callsign: 'G1OHH',
    AssociationCode: 'G',
    SummitCode: 'LD-056',
    ActivatorCallsign: 'M0NOM/P',
    ActivatorName: 'Mark',
    Frequency: '14.285',
    Mode: 'ssb',
    SummitDetails: '',
    HighlightColor: '',
    ...overrides,
  }
}

describe('SOTA Spot Service - spotConverter', () => {
  describe('convertTimestamp', () => {
    it('should convert SOTA timestamp to MySQL format', () => {
      expect(convertTimestamp('2019-05-21T19:06:59.999')).toBe('2019-05-21 19:06:59')
    })

    it('should handle timestamp without milliseconds', () => {
      expect(convertTimestamp('2019-05-21T19:06:59')).toBe('2019-05-21 19:06:59')
    })
  })

  describe('buildComment', () => {
    it('should prepend [SOTA>WOTA] for short comments', () => {
      expect(buildComment('TEST')).toBe('[SOTA>WOTA] TEST')
    })

    it('should not prepend [SOTA>WOTA] when comment is too long', () => {
      // 79 - 12 = 67; a comment of length 67 should NOT get the prefix (not < 67)
      const comment67 = 'A'.repeat(67)
      expect(buildComment(comment67)).toBe(comment67)
    })

    it('should prepend [SOTA>WOTA] when comment is exactly at boundary minus 1', () => {
      // A comment of length 66 should get the prefix (66 < 67)
      const comment66 = 'A'.repeat(66)
      expect(buildComment(comment66)).toBe('[SOTA>WOTA] ' + comment66)
    })

    it('should truncate comments longer than 79 chars', () => {
      const longComment = 'A'.repeat(100)
      const result = buildComment(longComment)
      expect(result).toBe('A'.repeat(79))
    })

    it('should handle empty comments', () => {
      expect(buildComment('')).toBe('[SOTA>WOTA] ')
    })
  })

  describe('parseSotaNumber', () => {
    it('should parse summit code to number', () => {
      expect(parseSotaNumber('LD-056')).toBe(56)
      expect(parseSotaNumber('LD-001')).toBe(1)
      expect(parseSotaNumber('LD-100')).toBe(100)
    })
  })

  describe('filterLakeDistrictSpots', () => {
    const sotaToWotaMap = new Map<number, number>([
      [56, 42],
      [1, 1],
    ])

    it('should keep G/LD spots with a WOTA mapping', () => {
      const spots = [makeSotaSpot()]
      expect(filterLakeDistrictSpots(spots, sotaToWotaMap)).toHaveLength(1)
    })

    it('should reject non-G association spots', () => {
      const spots = [makeSotaSpot({ AssociationCode: 'HB' })]
      expect(filterLakeDistrictSpots(spots, sotaToWotaMap)).toHaveLength(0)
    })

    it('should reject non-LD region spots', () => {
      const spots = [makeSotaSpot({ SummitCode: 'NP-001' })]
      expect(filterLakeDistrictSpots(spots, sotaToWotaMap)).toHaveLength(0)
    })

    it('should reject LD spots without a WOTA mapping', () => {
      const spots = [makeSotaSpot({ SummitCode: 'LD-999' })]
      expect(filterLakeDistrictSpots(spots, sotaToWotaMap)).toHaveLength(0)
    })

    it('should filter a mixed batch correctly', () => {
      const spots = [
        makeSotaSpot({ Id: 1, AssociationCode: 'G', SummitCode: 'LD-056' }),
        makeSotaSpot({ Id: 2, AssociationCode: 'HB', SummitCode: 'LD-056' }),
        makeSotaSpot({ Id: 3, AssociationCode: 'G', SummitCode: 'NP-001' }),
        makeSotaSpot({ Id: 4, AssociationCode: 'G', SummitCode: 'LD-001' }),
        makeSotaSpot({ Id: 5, AssociationCode: 'G', SummitCode: 'LD-999' }),
      ]
      const result = filterLakeDistrictSpots(spots, sotaToWotaMap)
      expect(result).toHaveLength(2)
      expect(result[0].Id).toBe(1)
      expect(result[1].Id).toBe(4)
    })
  })

  describe('convertSotaToWotaSpot', () => {
    it('should convert a full SOTA spot to a WOTA spot insert', () => {
      const sotaToWotaMap = new Map([[56, 42]])
      const result = convertSotaToWotaSpot(makeSotaSpot(), sotaToWotaMap)

      expect(result.datetime).toBe('2019-05-21 19:06:59')
      expect(result.call).toBe('M0NOM/P')
      expect(result.wotaid).toBe(42)
      expect(result.freqmode).toBe('14.285-ssb')
      expect(result.comment).toBe('[SOTA>WOTA] TEST PLEASE IGNORE')
      expect(result.spotter).toBe('G1OHH')
    })
  })
})

describe('SOTA Spot Service - spotTracker', () => {
  it('should track a spot and report it as tracked', () => {
    const tracker = new SotaSpotTracker()
    tracker.track(100, '2024-01-01 12:00:00', 'M0NOM/P', 42)
    expect(tracker.isTracked(100)).toBe(true)
    expect(tracker.isTracked(999)).toBe(false)
  })

  it('should find deleted spots when SOTA IDs disappear from API', () => {
    const tracker = new SotaSpotTracker()
    tracker.track(100, '2024-01-01 12:00:00', 'M0NOM/P', 42)
    tracker.track(200, '2024-01-01 13:00:00', 'G1OHH', 10)
    tracker.track(300, '2024-01-01 14:00:00', 'G4YSS', 5)

    // Spot 200 is gone from the API
    const currentIds = new Set([100, 300])
    const deleted = tracker.findDeletedSpots(currentIds)

    expect(deleted).toHaveLength(1)
    expect(deleted[0]).toEqual({
      datetime: '2024-01-01 13:00:00',
      call: 'G1OHH',
      wotaid: 10,
    })
    // Should no longer be tracked
    expect(tracker.isTracked(200)).toBe(false)
  })

  it('should return empty when all spots are still present', () => {
    const tracker = new SotaSpotTracker()
    tracker.track(100, '2024-01-01 12:00:00', 'M0NOM/P', 42)
    tracker.track(200, '2024-01-01 13:00:00', 'G1OHH', 10)

    const currentIds = new Set([100, 200])
    const deleted = tracker.findDeletedSpots(currentIds)
    expect(deleted).toHaveLength(0)
  })

  it('should return all when all spots are removed', () => {
    const tracker = new SotaSpotTracker()
    tracker.track(100, '2024-01-01 12:00:00', 'M0NOM/P', 42)
    tracker.track(200, '2024-01-01 13:00:00', 'G1OHH', 10)

    const currentIds = new Set<number>()
    const deleted = tracker.findDeletedSpots(currentIds)
    expect(deleted).toHaveLength(2)
    expect(tracker.isTracked(100)).toBe(false)
    expect(tracker.isTracked(200)).toBe(false)
  })
})
