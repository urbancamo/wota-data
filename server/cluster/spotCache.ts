import type { SpotWithSummit } from './types'
import { prisma } from '../db'
import { logger } from '../logger'

const MAX_CACHED_SPOTS = 100
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000] // Exponential backoff

export class SpotCache {
  private spots: SpotWithSummit[] = []
  private lastSpotId: number = 0
  private isInitialized: boolean = false
  private initPromise: Promise<void> | null = null
  private hasSuccessfullyLoaded: boolean = false

  /**
   * Execute a database operation with retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        if (attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt]
          logger.warn(
            { error: lastError.message, attempt: attempt + 1, delay, operationName },
            `Database operation failed, retrying in ${delay}ms`
          )
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    logger.error(
      { error: lastError, operationName },
      'Database operation failed after all retries'
    )
    throw lastError
  }

  /**
   * Initialize the cache with recent spots
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.doInitialize()
    await this.initPromise
  }

  private async doInitialize(): Promise<void> {
    try {
      await this.withRetry(async () => {
        const recentSpots = await prisma.spot.findMany({
          orderBy: { id: 'desc' },
          take: MAX_CACHED_SPOTS
        })

        if (recentSpots.length > 0) {
          // Get summit info for each spot
          const spotsWithSummits = await Promise.all(
            recentSpots.map(async (spot) => {
              const summit = await prisma.summit.findUnique({
                where: { wotaid: spot.wotaid },
                select: { reference: true, name: true }
              })
              return { ...spot, summit }
            })
          )

          // Store in chronological order (oldest first)
          this.spots = spotsWithSummits.reverse()
          this.lastSpotId = recentSpots[0].id
        }

        this.isInitialized = true
        this.hasSuccessfullyLoaded = true
        logger.info(
          { spotCount: this.spots.length, lastSpotId: this.lastSpotId },
          'Spot cache initialized'
        )
      }, 'initializeCache')
    } catch (error) {
      // Even if init fails, mark as initialized to allow retries on poll
      this.isInitialized = true
      logger.error({ error }, 'Failed to initialize spot cache, will retry on poll')
    }
  }

  /**
   * Remove spots from cache that aren't from the current UTC day
   */
  private pruneStaleSpots(): void {
    if (this.spots.length === 0) return

    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

    const beforeCount = this.spots.length
    this.spots = this.spots.filter(s => {
      const spotDay = Date.UTC(s.datetime.getUTCFullYear(), s.datetime.getUTCMonth(), s.datetime.getUTCDate())
      return spotDay === todayUTC
    })
    const prunedCount = beforeCount - this.spots.length

    if (prunedCount > 0) {
      logger.info({ prunedCount }, 'Removed stale spots from cache')
    }
  }

  /**
   * Remove spots from cache that have been deleted from the database
   */
  private async pruneDeletedSpots(): Promise<void> {
    if (this.spots.length === 0) return

    const cachedIds = this.spots.map(s => s.id)
    const existingSpots = await prisma.spot.findMany({
      where: { id: { in: cachedIds } },
      select: { id: true }
    })
    const existingIds = new Set(existingSpots.map(s => s.id))

    const beforeCount = this.spots.length
    this.spots = this.spots.filter(s => existingIds.has(s.id))
    const prunedCount = beforeCount - this.spots.length

    if (prunedCount > 0) {
      logger.info({ prunedCount }, 'Removed deleted spots from cache')
    }
  }

  /**
   * Poll for new spots and return any new ones
   */
  async pollForNewSpots(): Promise<SpotWithSummit[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const newSpots = await this.withRetry(async () => {
        const spots = await prisma.spot.findMany({
          where: { id: { gt: this.lastSpotId } },
          orderBy: { id: 'asc' }
        })

        if (spots.length === 0) return []

        // Get summit info for each spot
        return Promise.all(
          spots.map(async (spot) => {
            const summit = await prisma.summit.findUnique({
              where: { wotaid: spot.wotaid },
              select: { reference: true, name: true }
            })
            return { ...spot, summit }
          })
        )
      }, 'pollForNewSpots')

      // Mark as successfully loaded even if no new spots (DB connection worked)
      this.hasSuccessfullyLoaded = true

      // Add new spots first before pruning
      if (newSpots.length > 0) {
        // Update cache
        this.spots.push(...newSpots)
        this.lastSpotId = newSpots[newSpots.length - 1].id

        // Trim cache to max size
        if (this.spots.length > MAX_CACHED_SPOTS) {
          this.spots = this.spots.slice(-MAX_CACHED_SPOTS)
        }

        logger.debug(
          { newSpotCount: newSpots.length, lastSpotId: this.lastSpotId },
          'Added new spots to cache'
        )
      }

      // Remove spots from previous days
      this.pruneStaleSpots()

      // Check for deleted spots and remove them from cache (non-blocking)
      try {
        await this.pruneDeletedSpots()
      } catch (error) {
        logger.warn({ error }, 'Failed to prune deleted spots, will retry next poll')
      }

      return newSpots
    } catch (error) {
      // On failure, return empty array - will retry on next poll
      logger.error({ error }, 'Failed to poll for new spots')
      return []
    }
  }

  /**
   * Get recent spots for a client, optionally filtered by what they've already seen
   */
  getRecentSpots(count: number, afterSpotId?: number): SpotWithSummit[] {
    let spots = this.spots

    if (afterSpotId !== undefined) {
      spots = spots.filter(s => s.id > afterSpotId)
    }

    // Return most recent spots (from the end of the array)
    return spots.slice(-count)
  }

  /**
   * Get the current last spot ID
   */
  getLastSpotId(): number {
    return this.lastSpotId
  }

  /**
   * Check if cache has spots
   */
  hasSpots(): boolean {
    return this.spots.length > 0
  }

  /**
   * Check if cache has successfully connected to the database at least once
   */
  isReady(): boolean {
    return this.hasSuccessfullyLoaded
  }
}

// Singleton instance
export const spotCache = new SpotCache()
