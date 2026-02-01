import type { Socket } from 'net'

export interface ClusterClient {
  socket: Socket
  callsign: string | null
  authenticated: boolean
  pingInterval: NodeJS.Timeout | null
  pingMinutes: number
  connectedAt: Date
  lastSeenSpotId: number
}

export interface SpotWithSummit {
  id: number
  datetime: Date
  call: string
  wotaid: number
  freqmode: string
  comment: string
  spotter: string
  summit?: {
    reference: string
    name: string
  } | null
}
