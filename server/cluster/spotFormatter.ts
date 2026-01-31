import type { SpotWithSummit } from './types'

/**
 * Parse frequency from freqmode field
 * Examples: "7.032 SSB", "14.285 CW", "145.500 FM"
 * Returns frequency as a number in kHz (e.g., 7032.0)
 */
export function parseFrequency(freqmode: string): number {
  const parts = freqmode.trim().split(/\s+/)
  if (parts.length === 0) return 0

  const freqStr = parts[0]
  const freq = parseFloat(freqStr)

  if (isNaN(freq)) return 0

  // If frequency is less than 1000, it's in MHz - convert to kHz
  if (freq < 1000) {
    return freq * 1000
  }

  return freq
}

/**
 * Format WOTA reference from wotaid
 * 1-214: LDW-001 to LDW-214
 * 215+: LDO-001 onwards
 */
export function formatWotaReference(wotaid: number): string {
  if (wotaid <= 214) {
    return `LDW-${String(wotaid).padStart(3, '0')}`
  } else {
    return `LDO-${String(wotaid - 214).padStart(3, '0')}`
  }
}

/**
 * Format time as Zulu time (e.g., "1423Z")
 */
export function formatZuluTime(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${hours}${minutes}Z`
}

/**
 * Format a spot in DX cluster format
 *
 * DX cluster output format:
 * DX de SPOTTER:    FREQ  CALL         SUMMIT-REF                     TIMEZ
 *
 * Column alignment:
 * - Columns 1-16: "DX de SPOTTER:"
 * - Columns 17-25: Frequency (right-aligned)
 * - Columns 26-38: Spotted callsign
 * - Columns 39-70: Summit ref + name
 * - Columns 71-75: Time in Zulu
 */
export function formatSpot(spot: SpotWithSummit): string {
  const spotter = spot.spotter.trim().padEnd(8)
  const freq = parseFrequency(spot.freqmode)
  const freqStr = freq.toFixed(1).padStart(9)
  const call = spot.call.trim().padEnd(13)

  // Build summit info
  let summitInfo: string
  if (spot.summit) {
    const ref = spot.summit.reference
    const name = spot.summit.name
    summitInfo = `${ref} ${name}`
  } else {
    summitInfo = formatWotaReference(spot.wotaid)
  }
  // Truncate or pad to 32 chars
  summitInfo = summitInfo.substring(0, 32).padEnd(32)

  const time = formatZuluTime(spot.datetime)

  return `DX de ${spotter}: ${freqStr}  ${call}${summitInfo}${time}\r\n`
}

/**
 * Format multiple spots for sh/dx output
 */
export function formatSpotList(spots: SpotWithSummit[]): string {
  if (spots.length === 0) {
    return 'No spots available.\r\n'
  }

  const lines = spots.map(spot => formatSpot(spot))
  return lines.join('')
}
