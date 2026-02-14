import type { TrackedSpot } from './types'

export class SotaSpotTracker {
  private tracked = new Map<number, TrackedSpot>()

  track(sotaSpotId: number, datetime: string, call: string, wotaid: number): void {
    this.tracked.set(sotaSpotId, { datetime, call, wotaid })
  }

  isTracked(sotaSpotId: number): boolean {
    return this.tracked.has(sotaSpotId)
  }

  // Returns TrackedSpots whose SOTA IDs are no longer in the current API response,
  // and removes them from tracking
  findDeletedSpots(currentSotaSpotIds: Set<number>): TrackedSpot[] {
    const deleted: TrackedSpot[] = []

    for (const [sotaId, trackedSpot] of this.tracked) {
      if (!currentSotaSpotIds.has(sotaId)) {
        deleted.push(trackedSpot)
        this.tracked.delete(sotaId)
      }
    }

    return deleted
  }
}
