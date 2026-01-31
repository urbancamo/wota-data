import type {ClusterClient, SpotWithSummit} from './types'
import {cleanupClient, sendPrompt, sendToClient, setupPingInterval} from './client'
import {formatSpotList} from './spotFormatter'
import {prisma} from '../db'
import {logger} from '../logger'

export type CommandResult = {
  handled: boolean
  disconnect?: boolean
}

/**
 * Get recent spots with summit info
 */
async function getRecentSpots(limit: number = 25): Promise<SpotWithSummit[]> {
  const spots = await prisma.spot.findMany({
    orderBy: { datetime: 'desc' },
    take: limit
  })

  // Get summit info for each spot
  return await Promise.all(
    spots.map(async (spot) => {
      const summit = await prisma.summit.findUnique({
        where: {wotaid: spot.wotaid},
        select: {reference: true, name: true}
      })
      return {
        ...spot,
        summit
      }
    })
  )
}

/**
 * Handle sh/dx command - show recent spots
 */
async function handleShowDx(client: ClusterClient, args: string[]): Promise<void> {
  // Parse optional count argument (default 25, max 50)
  let count = 25
  if (args.length > 0) {
    const parsed = parseInt(args[0], 10)
    if (!isNaN(parsed) && parsed > 0) {
      count = Math.min(parsed, 50)
    }
  }

  try {
    const spots = await getRecentSpots(count)
    const output = formatSpotList(spots)
    sendToClient(client, output)
  } catch (error) {
    logger.error({ error, callsign: client.callsign }, 'Error fetching spots for sh/dx')
    sendToClient(client, 'Error fetching spots. Please try again.\r\n')
  }
}

/**
 * Handle sh/users command - show connected users
 */
function handleShowUsers(client: ClusterClient, clients: Map<string, ClusterClient>): void {
  const authenticatedClients = Array.from(clients.values())
    .filter(c => c.authenticated && c.callsign)

  if (authenticatedClients.length === 0) {
    sendToClient(client, 'No users currently connected.\r\n')
    return
  }

  sendToClient(client, `\r\nConnected users (${authenticatedClients.length}):\r\n`)
  sendToClient(client, '-'.repeat(40) + '\r\n')

  for (const c of authenticatedClients) {
    const connectedFor = Math.floor((Date.now() - c.connectedAt.getTime()) / 60000)
    sendToClient(client, `${c.callsign?.padEnd(12)} connected for ${connectedFor} mins\r\n`)
  }

  sendToClient(client, '\r\n')
}

/**
 * Handle ping commands - set keepalive interval
 */
function handlePing(
  client: ClusterClient,
  minutes: number,
  sendPromptFn: () => void
): void {
  if (minutes < 1) {
    sendToClient(client, 'Invalid ping interval. Use ping1, ping5, ping10, etc.\r\n')
    return
  }

  setupPingInterval(client, minutes, sendPromptFn)
  sendToClient(client, `Keepalive set to ${minutes} minute${minutes > 1 ? 's' : ''}.\r\n`)
}

/**
 * Handle help command
 */
function handleHelp(client: ClusterClient): void {
  const help = [
    '',
    'WOTA Cluster Commands:',
    '-'.repeat(40),
    'sh/dx [n]     Show last n spots (default 25, max 50)',
    'sh/users      Show connected users',
    'ping1         Send keepalive every 1 minute',
    'ping5         Send keepalive every 5 minutes',
    'ping10        Send keepalive every 10 minutes',
    'ping15        Send keepalive every 15 minutes',
    'bye / quit    Disconnect from cluster',
    'help          Show this help message',
    '',
    'Spots are broadcast automatically when they arrive.',
    ''
  ].join('\r\n')

  sendToClient(client, help)
}

/**
 * Parse and execute a command
 */
export async function executeCommand(
  client: ClusterClient,
  input: string,
  clients: Map<string, ClusterClient>
): Promise<CommandResult> {
  const trimmed = input.trim().toLowerCase()

  if (!trimmed) {
    return { handled: true }
  }

  // Parse command and arguments
  const parts = trimmed.split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1)

  logger.debug({ callsign: client.callsign, command, args }, 'Executing cluster command')

  const CTRL_C = '\x03';

  // Handle commands
  switch (command) {
    case 'sh/dx':
    case 'show/dx':
      await handleShowDx(client, args)
      sendPrompt(client)
      return { handled: true }

    case 'sh/users':
    case 'show/users':
      handleShowUsers(client, clients)
      sendPrompt(client)
      return { handled: true }

    case 'ping1':
      handlePing(client, 1, () => sendPrompt(client))
      sendPrompt(client)
      return { handled: true }

    case 'ping5':
      handlePing(client, 5, () => sendPrompt(client))
      sendPrompt(client)
      return { handled: true }

    case 'ping10':
      handlePing(client, 10, () => sendPrompt(client))
      sendPrompt(client)
      return { handled: true }

    case 'ping15':
      handlePing(client, 15, () => sendPrompt(client))
      sendPrompt(client)
      return { handled: true }

    case 'bye':
    case 'quit':
    case 'exit':
    case CTRL_C:
      sendToClient(client, '73 de WOTA cluster. Goodbye!\r\n')
      cleanupClient(client)
      return { handled: true, disconnect: true }

    case 'help':
    case '?':
      handleHelp(client)
      sendPrompt(client)
      return { handled: true }

    default:
      sendToClient(client, `Unknown command: ${command}. Type "help" for available commands.\r\n`)
      sendPrompt(client)
      return { handled: true }
  }
}

/**
 * Send initial spots to newly authenticated client
 */
export async function sendInitialSpots(client: ClusterClient): Promise<void> {
  try {
    const spots = await getRecentSpots(10)
    if (spots.length > 0) {
      const output = formatSpotList(spots)
      sendToClient(client, output)
    }
  } catch (error) {
    logger.error({ error, callsign: client.callsign }, 'Error sending initial spots')
  }
}
