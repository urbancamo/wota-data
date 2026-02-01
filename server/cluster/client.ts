import type { Socket } from 'net'
import type { ClusterClient } from './types'
import { logger } from '../logger'

// Callsign validation
// A valid amateur radio callsign must:
// 1. Contain at least one letter and one digit
// 2. Not be all letters or all digits
// 3. Be a reasonable length (3-15 chars)
// Examples: G4XYZ, M0ABC, 2E0AAA, VK3AB, W1AW, G4XYZ/P

export function isValidCallsign(callsign: string): boolean {
  if (!callsign || callsign.length < 3 || callsign.length > 15) {
    return false
  }

  // Strip the suffix (e.g., /P, /M) for validation
  const baseCallsign = callsign.split('/')[0]

  // Must contain at least one letter
  if (!/[A-Z]/i.test(baseCallsign)) {
    return false
  }

  // Must contain at least one digit
  if (!/[0-9]/.test(baseCallsign)) {
    return false
  }

  // Must only contain alphanumeric characters (in base) and / in suffix
  return /^[A-Z0-9]+(\/[A-Z0-9]+)?$/i.test(callsign);


}

export function createClient(socket: Socket): ClusterClient {
  return {
    socket,
    callsign: null,
    authenticated: false,
    pingInterval: null,
    pingMinutes: 0,
    connectedAt: new Date(),
    lastSeenSpotId: 0
  }
}

export function sendToClient(client: ClusterClient, message: string): void {
  if (client.socket.writable) {
    client.socket.write(message)
  }
}

export function sendWelcome(client: ClusterClient): void {
  const welcome = [
    '',
    'Welcome to the WOTA Cluster',
    'Set your keepalive pings to no less than 15mins',
    '',
    'login: '
  ].join('\r\n')

  sendToClient(client, welcome)
}

export function sendPrompt(client: ClusterClient): void {
  if (client.callsign) {
    sendToClient(client, `${client.callsign} de WOTA cluster > `)
  }
}

export function authenticateClient(client: ClusterClient, callsign: string): boolean {
  const cleanCallsign = callsign.trim().toUpperCase()

  if (!isValidCallsign(cleanCallsign)) {
    sendToClient(client, 'Invalid callsign format. Please try again.\r\nlogin: ')
    return false
  }

  client.callsign = cleanCallsign
  client.authenticated = true

  logger.info({ callsign: cleanCallsign }, 'Cluster client authenticated')

  sendToClient(client, `\r\nHello ${cleanCallsign}, welcome to the WOTA cluster.\r\n`)
  sendToClient(client, 'Type "help" for available commands.\r\n\r\n')

  return true
}

export function setupPingInterval(
  client: ClusterClient,
  minutes: number,
  callback: () => void
): void {
  // Clear existing interval
  if (client.pingInterval) {
    clearInterval(client.pingInterval)
    client.pingInterval = null
  }

  if (minutes > 0) {
    client.pingMinutes = minutes
    client.pingInterval = setInterval(callback, minutes * 60 * 1000)
    logger.debug({ callsign: client.callsign, minutes }, 'Set ping interval')
  }
}

export function cleanupClient(client: ClusterClient): void {
  if (client.pingInterval) {
    clearInterval(client.pingInterval)
    client.pingInterval = null
  }

  if (client.socket && !client.socket.destroyed) {
    client.socket.destroy()
  }

  logger.info({ callsign: client.callsign }, 'Cluster client disconnected')
}
