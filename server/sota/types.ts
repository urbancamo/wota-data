// Mirrors the SOTA API JSON response from http://api2.sota.org.uk/api/spots/1
export interface SotaSpot {
  id: number
  timeStamp: string
  comments: string
  callsign: string
  associationCode: string
  summitCode: string
  activatorCallsign: string
  activatorName: string
  frequency: string
  mode: string
  summitDetails: string
  highlightColor: string | null
}

// Fields we INSERT into the spots table (no id - MySQL auto-generates it)
export interface WotaSpotInsert {
  datetime: string
  call: string
  wotaid: number
  freqmode: string
  comment: string
  spotter: string
}

// Associates a SOTA spot ID with the WOTA spot composite key for deletion tracking
export interface TrackedSpot {
  datetime: string
  call: string
  wotaid: number
}
