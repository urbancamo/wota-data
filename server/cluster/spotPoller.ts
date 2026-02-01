import type { ClusterClient } from './types'
import { formatSpot } from './spotFormatter'
import { sendToClient } from './client'
import { spotCache } from './spotCache'
import { logger } from '../logger'

export class SpotPoller {
  private pollInterval: NodeJS.Timeout | null = null
  private clients: Map<string, ClusterClient>
  private intervalMs: number

  constructor(clients: Map<string, ClusterClient>, intervalMs: number = 5000) {
    this.clients = clients
    this.intervalMs = intervalMs
  }

  async start(): Promise<void> {
    // Initialize the cache
    await spotCache.initialize()

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

  private async poll(): Promise<void> {
    const newSpots = await spotCache.pollForNewSpots()

    // Get all authenticated clients
    const authenticatedClients = Array.from(this.clients.values())
      .filter(c => c.authenticated)

    if (authenticatedClients.length === 0) {
      return
    }

    // Backfill clients who logged in during a DB outage (lastSeenSpotId = 0)
    // and haven't received any spots yet
    if (spotCache.hasSpots()) {
      const clientsNeedingBackfill = authenticatedClients.filter(c => c.lastSeenSpotId === 0)
      if (clientsNeedingBackfill.length > 0) {
        const backfillSpots = spotCache.getRecentSpots(10)
        if (backfillSpots.length > 0) {
          logger.info({
            clientCount: clientsNeedingBackfill.length,
            spotCount: backfillSpots.length
          }, 'Backfilling spots to clients who missed initial spots')

          for (const spot of backfillSpots) {
            const formatted = formatSpot(spot)
            for (const client of clientsNeedingBackfill) {
              try {
                sendToClient(client, formatted)
              } catch (error) {
                logger.error({ error, callsign: client.callsign }, 'Error backfilling spot to client')
              }
            }
          }

          // Update lastSeenSpotId for backfilled clients
          const lastBackfillId = backfillSpots[backfillSpots.length - 1].id
          for (const client of clientsNeedingBackfill) {
            client.lastSeenSpotId = lastBackfillId
          }
        }
      }
    }

    // Broadcast new spots
    if (newSpots.length === 0) {
      return
    }

    logger.info({
      spotCount: newSpots.length,
      clientCount: authenticatedClients.length
    }, 'Broadcasting new spots')

    for (const spot of newSpots) {
      const formatted = formatSpot(spot)

      for (const client of authenticatedClients) {
        // Skip if client has already seen this spot
        if (spot.id <= client.lastSeenSpotId) {
          continue
        }

        try {
          sendToClient(client, formatted)
          client.lastSeenSpotId = spot.id
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
