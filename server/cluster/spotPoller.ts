import type { ClusterClient, SpotWithSummit } from './types'
import { formatSpot } from './spotFormatter'
import { sendToClient } from './client'
import { prisma } from '../db'
import { logger } from '../logger'

export class SpotPoller {
  private lastSpotId: number = 0
  private pollInterval: NodeJS.Timeout | null = null
  private clients: Map<string, ClusterClient>
  private intervalMs: number

  constructor(clients: Map<string, ClusterClient>, intervalMs: number = 5000) {
    this.clients = clients
    this.intervalMs = intervalMs
  }

  async start(): Promise<void> {
    // Initialize lastSpotId with the current max
    await this.initializeLastSpotId()

    // Start polling
    this.pollInterval = setInterval(() => {
      this.poll().catch(err => {
        logger.error({ error: err }, 'Error polling for new spots')
      })
    }, this.intervalMs)

    logger.info({ intervalMs: this.intervalMs }, 'Spot poller started')
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
      logger.info('Spot poller stopped')
    }
  }

  private async initializeLastSpotId(): Promise<void> {
    try {
      const latestSpot = await prisma.spot.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true }
      })

      this.lastSpotId = latestSpot?.id ?? 0
      logger.info({ lastSpotId: this.lastSpotId }, 'Initialized spot poller')
    } catch (error) {
      logger.error({ error }, 'Error initializing spot poller')
      this.lastSpotId = 0
    }
  }

  private async poll(): Promise<void> {
    try {
      // Get new spots since last poll
      const newSpots = await prisma.spot.findMany({
        where: {
          id: { gt: this.lastSpotId }
        },
        orderBy: { id: 'asc' }
      })

      if (newSpots.length === 0) {
        return
      }

      // Update lastSpotId
      this.lastSpotId = newSpots[newSpots.length - 1].id

      // Get summit info for each spot
      const spotsWithSummits: SpotWithSummit[] = await Promise.all(
        newSpots.map(async (spot) => {
          const summit = await prisma.summit.findUnique({
            where: { wotaid: spot.wotaid },
            select: { reference: true, name: true }
          })
          return {
            ...spot,
            summit
          }
        })
      )

      // Broadcast to all authenticated clients
      this.broadcastSpots(spotsWithSummits)
    } catch (error) {
      logger.error({ error }, 'Error polling for new spots')
    }
  }

  private broadcastSpots(spots: SpotWithSummit[]): void {
    const authenticatedClients = Array.from(this.clients.values())
      .filter(c => c.authenticated)

    if (authenticatedClients.length === 0) {
      return
    }

    logger.info({
      spotCount: spots.length,
      clientCount: authenticatedClients.length
    }, 'Broadcasting new spots')

    for (const spot of spots) {
      const formatted = formatSpot(spot)

      for (const client of authenticatedClients) {
        try {
          sendToClient(client, formatted)
        } catch (error) {
          logger.error({
            error,
            callsign: client.callsign
          }, 'Error sending spot to client')
        }
      }
    }
  }
}
