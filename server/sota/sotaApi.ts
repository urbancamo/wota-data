import {logger} from '../logger'
import type {SotaSpot} from './types'

const SOTA_API_URL = 'https://api2.sota.org.uk/api/spots/1'
const TIMEOUT_MS = 15_000

export async function fetchSotaSpots(): Promise<SotaSpot[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(SOTA_API_URL, { signal: controller.signal })

    if (!response.ok) {
      logger.warn({ status: response.status }, 'SOTA API returned non-OK status')
      return []
    }

    const spots = (await response.json()) as SotaSpot[]
    for (const spot of spots) {
      logger.debug(
        { id: spot.Id, call: spot.ActivatorCallsign, assoc: spot.AssociationCode, summit: spot.SummitCode, freq: spot.Frequency, mode: spot.Mode, time: spot.Timestamp, comments: spot.Comments },
        'SOTA spot from API'
      )
    }
    return spots
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.warn('SOTA API request timed out')
    } else {
      logger.warn({ error }, 'Failed to fetch SOTA spots')
    }
    return []
  } finally {
    clearTimeout(timeout)
  }
}
