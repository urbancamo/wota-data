import type { SotaSpot, WotaSpotInsert } from './types'

// "LD-056" -> 56
export function parseSotaNumber(summitCode: string): number {
  const parts = summitCode.split('-')
  return parseInt(parts[1], 10)
}

// Keep only Lake District spots that have a WOTA mapping
export function filterLakeDistrictSpots(
  spots: SotaSpot[],
  sotaToWotaMap: Map<number, number>
): SotaSpot[] {
  return spots.filter((spot) => {
    if (spot.associationCode !== 'G') return false
    if (!spot.summitCode.startsWith('LD-')) return false
    const sotaNumber = parseSotaNumber(spot.summitCode)
    return sotaToWotaMap.has(sotaNumber)
  })
}

// "2019-05-21T19:06:59.999" -> "2019-05-21 19:06:59"
export function convertTimestamp(sotaTimestamp: string): string {
  return sotaTimestamp.replace('T', ' ').split('.')[0]
}

// Truncate to 79 chars; prepend "[SOTA>WOTA] " only if there's room
// Matches Go code: truncate first, then check if adding prefix still fits under 79
export function buildComment(comments: string): string {
  let commentLen = comments.length
  if (commentLen > 79) {
    commentLen = 79
  }
  let comment = comments.substring(0, commentLen)
  if (comment.length < 79 - '[SOTA>WOTA] '.length) {
    comment = '[SOTA>WOTA] ' + comments
  }
  return comment
}

export function convertSotaToWotaSpot(
  spot: SotaSpot,
  sotaToWotaMap: Map<number, number>
): WotaSpotInsert {
  const sotaNumber = parseSotaNumber(spot.summitCode)
  const wotaid = sotaToWotaMap.get(sotaNumber)!

  return {
    datetime: convertTimestamp(spot.timeStamp),
    call: spot.activatorCallsign,
    wotaid,
    freqmode: spot.frequency + '-' + spot.mode,
    comment: buildComment(spot.comments),
    spotter: spot.callsign,
  }
}

export function convertSotaToWotaSpots(
  spots: SotaSpot[],
  sotaToWotaMap: Map<number, number>
): WotaSpotInsert[] {
  return spots.map((spot) => convertSotaToWotaSpot(spot, sotaToWotaMap))
}
