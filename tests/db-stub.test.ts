import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPrismaStub } from '../server/db-stub'

describe('Database Stub Behavior', () => {
  let realPrisma: any
  let stubPrisma: any

  beforeEach(() => {
    // Create a mock real Prisma client
    realPrisma = {
      summit: {
        findMany: vi.fn().mockResolvedValue([
          { wotaid: 1, name: 'Scafell Pike', reference: 'G/LD-001' },
          { wotaid: 32, name: 'Kirk Fell', reference: 'G/LD-014' }
        ]),
        findFirst: vi.fn().mockResolvedValue(
          { wotaid: 32, name: 'Kirk Fell', reference: 'G/LD-014' }
        ),
        findUnique: vi.fn().mockResolvedValue(
          { wotaid: 1, name: 'Scafell Pike', reference: 'G/LD-001' }
        ),
        count: vi.fn().mockResolvedValue(214),
        create: vi.fn().mockResolvedValue({ wotaid: 999, name: 'Test Summit' }),
        update: vi.fn().mockResolvedValue({ wotaid: 1, name: 'Updated Summit' }),
        delete: vi.fn().mockResolvedValue({ wotaid: 1 })
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $connect: vi.fn().mockResolvedValue(undefined)
    }

    // Create stub
    stubPrisma = createPrismaStub(realPrisma)
  })

  describe('Read Operations (Execute Normally)', () => {
    it('should execute findMany against real database', async () => {
      const result = await stubPrisma.summit.findMany()

      expect(realPrisma.summit.findMany).toHaveBeenCalled()
      expect(result).toEqual([
        { wotaid: 1, name: 'Scafell Pike', reference: 'G/LD-001' },
        { wotaid: 32, name: 'Kirk Fell', reference: 'G/LD-014' }
      ])
    })

    it('should execute findFirst against real database', async () => {
      const result = await stubPrisma.summit.findFirst({ where: { wotaid: 32 } })

      expect(realPrisma.summit.findFirst).toHaveBeenCalled()
      expect(result).toEqual({ wotaid: 32, name: 'Kirk Fell', reference: 'G/LD-014' })
    })

    it('should execute findUnique against real database', async () => {
      const result = await stubPrisma.summit.findUnique({ where: { wotaid: 1 } })

      expect(realPrisma.summit.findUnique).toHaveBeenCalled()
      expect(result).toEqual({ wotaid: 1, name: 'Scafell Pike', reference: 'G/LD-001' })
    })

    it('should execute count against real database', async () => {
      const result = await stubPrisma.summit.count()

      expect(realPrisma.summit.count).toHaveBeenCalled()
      expect(result).toBe(214)
    })
  })

  describe('Mutation Operations (Stubbed)', () => {
    it('should stub create operations', async () => {
      const result = await stubPrisma.summit.create({
        data: { name: 'Test Summit', reference: 'G/LD-999' }
      })

      // Real prisma should NOT be called
      expect(realPrisma.summit.create).not.toHaveBeenCalled()

      // Should return mock data
      expect(result).toEqual({
        id: 999999,
        name: 'Test Summit',
        reference: 'G/LD-999'
      })
    })

    it('should stub update operations', async () => {
      const result = await stubPrisma.summit.update({
        where: { wotaid: 1 },
        data: { name: 'Updated Name' }
      })

      // Real prisma should NOT be called
      expect(realPrisma.summit.update).not.toHaveBeenCalled()

      // Should return mock data with default ID
      expect(result).toEqual({
        id: 999999,
        name: 'Updated Name'
      })
    })

    it('should stub delete operations', async () => {
      const result = await stubPrisma.summit.delete({
        where: { wotaid: 1 }
      })

      // Real prisma should NOT be called
      expect(realPrisma.summit.delete).not.toHaveBeenCalled()

      // Should return mock data with default ID
      expect(result).toEqual({
        id: 999999
      })
    })
  })

  describe('Special Methods', () => {
    it('should execute $disconnect normally', async () => {
      await stubPrisma.$disconnect()

      expect(realPrisma.$disconnect).toHaveBeenCalled()
    })

    it('should execute $connect normally', async () => {
      await stubPrisma.$connect()

      expect(realPrisma.$connect).toHaveBeenCalled()
    })
  })
})
