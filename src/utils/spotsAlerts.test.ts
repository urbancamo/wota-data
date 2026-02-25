import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  filterTodaySpots,
  filterAndDeduplicateAlerts,
  isSpotRecent,
  isAlertToday,
} from './spotsAlerts'
import type { SpotWithSummit, AlertWithSummit } from '../types/adif'

function makeSpot(overrides: Partial<SpotWithSummit> = {}): SpotWithSummit {
  return {
    id: 1,
    datetime: new Date().toISOString(),
    call: 'G4XYZ',
    wotaid: 1,
    freqmode: '145.500-FM',
    comment: 'test',
    spotter: 'M0ABC',
    summitName: 'Helvellyn',
    sotaid: null,
    ...overrides,
  }
}

function makeAlert(overrides: Partial<AlertWithSummit> = {}): AlertWithSummit {
  return {
    id: 1,
    datetime: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
    call: 'G4XYZ',
    wotaid: 1,
    freqmode: '145.500-FM',
    comment: 'test',
    postedby: 'M0ABC',
    summitName: 'Helvellyn',
    sotaid: null,
    ...overrides,
  }
}

describe('filterTodaySpots', () => {
  it('includes spots from today', () => {
    const now = new Date()
    const spot = makeSpot({ datetime: now.toISOString() })
    expect(filterTodaySpots([spot])).toHaveLength(1)
  })

  it('excludes spots from yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(12, 0, 0, 0)
    const spot = makeSpot({ datetime: yesterday.toISOString() })
    expect(filterTodaySpots([spot])).toHaveLength(0)
  })

  it('returns empty array when no spots', () => {
    expect(filterTodaySpots([])).toHaveLength(0)
  })
})

describe('filterAndDeduplicateAlerts', () => {
  it('excludes past alerts', () => {
    const pastAlert = makeAlert({
      datetime: new Date(Date.now() - 3600000).toISOString(),
    })
    expect(filterAndDeduplicateAlerts([pastAlert])).toHaveLength(0)
  })

  it('includes future alerts', () => {
    const futureAlert = makeAlert({
      datetime: new Date(Date.now() + 3600000).toISOString(),
    })
    expect(filterAndDeduplicateAlerts([futureAlert])).toHaveLength(1)
  })

  it('deduplicates by call+wotaid+freqmode, keeping highest ID', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const alert1 = makeAlert({ id: 1, call: 'G4XYZ', wotaid: 5, freqmode: '145.500-FM', datetime: futureDate })
    const alert2 = makeAlert({ id: 5, call: 'G4XYZ', wotaid: 5, freqmode: '145.500-FM', datetime: futureDate })
    const result = filterAndDeduplicateAlerts([alert1, alert2])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(5)
  })

  it('keeps alerts with different call+wotaid+freqmode keys', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const alert1 = makeAlert({ id: 1, call: 'G4XYZ', wotaid: 5, freqmode: '145.500-FM', datetime: futureDate })
    const alert2 = makeAlert({ id: 2, call: 'M0ABC', wotaid: 5, freqmode: '145.500-FM', datetime: futureDate })
    const result = filterAndDeduplicateAlerts([alert1, alert2])
    expect(result).toHaveLength(2)
  })

  it('sorts results by datetime ascending (soonest first)', () => {
    const sooner = new Date(Date.now() + 3600000).toISOString()
    const later = new Date(Date.now() + 7200000).toISOString()
    const alert1 = makeAlert({ id: 1, call: 'G4XYZ', datetime: later })
    const alert2 = makeAlert({ id: 2, call: 'M0ABC', datetime: sooner })
    const result = filterAndDeduplicateAlerts([alert1, alert2])
    expect(result[0].call).toBe('M0ABC')
    expect(result[1].call).toBe('G4XYZ')
  })
})

describe('isSpotRecent', () => {
  it('returns true for spot within last 30 minutes', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(isSpotRecent(tenMinutesAgo)).toBe(true)
  })

  it('returns false for spot older than 30 minutes', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(isSpotRecent(twoHoursAgo)).toBe(false)
  })

  it('returns true for spot exactly now', () => {
    expect(isSpotRecent(new Date().toISOString())).toBe(true)
  })
})

describe('isAlertToday', () => {
  it('returns true for alert scheduled later today', () => {
    const now = new Date()
    // Only test if there's time left in the day
    if (now.getHours() < 23) {
      const laterToday = new Date(now)
      laterToday.setHours(now.getHours() + 1, 0, 0, 0)
      expect(isAlertToday(laterToday.toISOString())).toBe(true)
    }
  })

  it('returns false for alert scheduled tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(12, 0, 0, 0)
    expect(isAlertToday(tomorrow.toISOString())).toBe(false)
  })

  it('returns false for past alert', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(isAlertToday(yesterday.toISOString())).toBe(false)
  })
})