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
