import { prisma } from '../db'
import { logger } from '../logger'
import { fetchSotaSpots } from './sotaApi'
import { filterLakeDistrictSpots, convertSotaToWotaSpots } from './spotConverter'
import { SotaSpotTracker } from './spotTracker'
import type { WotaSpotInsert } from './types'

const POLL_INTERVAL_MS = 60_000

export class SotaSpotService {
  private interval: NodeJS.Timeout | null = null
  private isPolling = false
  private sotaToWotaMap = new Map<number, number>()
  private tracker = new SotaSpotTracker()

  async loadSummitMapping(): Promise<void> {
    const summits = await prisma.summit.findMany({
      where: { sotaid: { not: null } },
      select: { wotaid: true, sotaid: true },
    })

    this.sotaToWotaMap.clear()
    for (const summit of summits) {
      if (summit.sotaid !== null) {
        this.sotaToWotaMap.set(summit.sotaid, summit.wotaid)
      }
    }

    logger.info({ count: this.sotaToWotaMap.size }, 'Loaded SOTA-to-WOTA summit mapping')
  }

  async start(): Promise<void> {
    await this.loadSummitMapping()
    await this.poll()
    this.interval = setInterval(() => this.poll(), POLL_INTERVAL_MS)
    logger.info({ intervalMs: POLL_INTERVAL_MS }, 'SOTA spot service started')
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    logger.info('SOTA spot service stopped')
  }

  private async poll(): Promise<void> {
    if (this.isPolling) return
    this.isPolling = true

    try {
      const sotaSpots = await fetchSotaSpots()
      if (sotaSpots.length === 0) {
        logger.info({ sotaSpots: 0 }, 'SOTA spot poll: no spots returned from API')
        return
      }

      // Filter to Lake District spots with WOTA mapping
      const ldSpots = filterLakeDistrictSpots(sotaSpots, this.sotaToWotaMap)
      const wotaSpots = convertSotaToWotaSpots(ldSpots, this.sotaToWotaMap)

      // Build set of current SOTA spot IDs (only LD ones we care about)
      const currentSotaIds = new Set(ldSpots.map((s) => s.Id))

      // Insert new spots
      let insertedCount = 0
      let skippedTracked = 0
      let skippedDuplicate = 0
      for (let i = 0; i < ldSpots.length; i++) {
        const sotaSpot = ldSpots[i]
        const wotaSpot = wotaSpots[i]

        // Skip if already tracked from a previous poll
        if (this.tracker.isTracked(sotaSpot.Id)) {
          skippedTracked++
          continue
        }

        try {
          const wasInserted = await this.insertSpot(wotaSpot)
          this.tracker.track(sotaSpot.Id, wotaSpot.datetime, wotaSpot.call, wotaSpot.wotaid)
          if (wasInserted) {
            insertedCount++
          } else {
            skippedDuplicate++
          }
        } catch (error) {
          logger.error({ error, sotaSpotId: sotaSpot.Id }, 'Failed to insert SOTA->WOTA spot')
        }
      }

      // Detect and delete removed spots
      const deletedSpots = this.tracker.findDeletedSpots(currentSotaIds)
      let deletedCount = 0
      for (const spot of deletedSpots) {
        try {
          const result = await prisma.$executeRaw`
            DELETE FROM spots
            WHERE datetime = ${spot.datetime}
              AND \`call\` = ${spot.call}
              AND wotaid = ${spot.wotaid}`
          if (result > 0) deletedCount++
        } catch (error) {
          logger.error({ error, spot }, 'Failed to delete removed SOTA->WOTA spot')
        }
      }

      logger.info(
        { sotaSpots: sotaSpots.length, ldSpots: ldSpots.length, inserted: insertedCount, skippedDuplicate, skippedTracked, deleted: deletedCount },
        'SOTA spot poll complete'
      )
    } catch (error) {
      logger.error({ error }, 'SOTA spot poll cycle failed')
    } finally {
      this.isPolling = false
    }
  }

  private async insertSpot(spot: WotaSpotInsert): Promise<boolean> {
    // Check for duplicate
    const existing = await prisma.spot.findFirst({
      where: {
        datetime: new Date(spot.datetime),
        call: spot.call,
        wotaid: spot.wotaid,
      },
    })

    if (existing) return false

    // Raw SQL insert - lets MySQL auto-increment the id
    await prisma.$executeRaw`
      INSERT INTO spots (datetime, \`call\`, wotaid, freqmode, comment, spotter)
      VALUES (${spot.datetime}, ${spot.call}, ${spot.wotaid}, ${spot.freqmode}, ${spot.comment}, ${spot.spotter})`
    return true
  }
}
