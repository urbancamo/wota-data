import type { SpotWithSummit, AlertWithSummit } from '../types/adif'

/**
 * Filter spots to only those from today (since midnight local time)
 */
export function filterTodaySpots(spots: SpotWithSummit[]): SpotWithSummit[] {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)

  return spots.filter(spot => {
    const spotDate = new Date(spot.datetime)
    return spotDate >= midnight
  })
}

/**
 * Filter alerts to future only, deduplicate by call+wotaid+freqmode
 * (keeping the highest ID), and sort by datetime ascending (soonest first)
 */
export function filterAndDeduplicateAlerts(alerts: AlertWithSummit[]): AlertWithSummit[] {
  const now = new Date()

  const futureAlerts = alerts.filter(alert => {
    const alertDate = new Date(alert.datetime)
    return alertDate >= now
  })

  // Deduplicate: keep highest id for each call+wotaid+freqmode combo
  const alertsByKey = new Map<string, AlertWithSummit>()
  for (const alert of futureAlerts) {
    const key = `${alert.call}|${alert.wotaid}|${alert.freqmode}`
    const existing = alertsByKey.get(key)
    if (!existing || alert.id > existing.id) {
      alertsByKey.set(key, alert)
    }
  }

  // Sort by datetime ASC (soonest first)
  return Array.from(alertsByKey.values()).sort((a, b) =>
    new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  )
}

/**
 * Check if a spot is recent (within the last 30 minutes)
 */
export function isSpotRecent(datetime: string): boolean {
  const spotDate = new Date(datetime)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
  return spotDate >= thirtyMinutesAgo
}

/**
 * Check if an alert is for today (between now and end of day)
 */
export function isAlertToday(datetime: string): boolean {
  const alertDate = new Date(datetime)
  const now = new Date()
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  return alertDate >= now && alertDate <= endOfDay
}