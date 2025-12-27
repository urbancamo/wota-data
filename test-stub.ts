/**
 * Test script to demonstrate database stub mode
 *
 * Run with: tsx test-stub.ts
 */

import { createPrismaStub } from './server/db-stub'

// Create a stub instance (in real usage, you'd pass the real prisma instance)
const stubPrisma = createPrismaStub({})

async function testStubOperations() {
  console.log('=== Testing Database Stub Mode ===\n')

  // Test 1: Create operation
  console.log('Test 1: Creating an activator log entry')
  await stubPrisma.activatorLog.create({
    data: {
      activatedby: 'M0ABC',
      callused: 'M0ABC/P',
      wotaid: 123,
      date: new Date('2025-01-15'),
      year: 2025,
      stncall: 'G4XYZ',
      ucall: 'M0ABC',
      band: '40m',
      mode: 'SSB',
    },
  })

  // Test 2: Find many operation
  console.log('\nTest 2: Querying activator logs')
  await stubPrisma.activatorLog.findMany({
    where: {
      ucall: 'M0ABC',
      year: 2025,
    },
    orderBy: { date: 'desc' },
  })

  // Test 3: Count operation
  console.log('\nTest 3: Counting total activations')
  await stubPrisma.activatorLog.count()

  // Test 4: Group by operation
  console.log('\nTest 4: Getting unique activators')
  await stubPrisma.activatorLog.groupBy({
    by: ['activatedby'],
  })

  console.log('\n=== All stub operations completed successfully ===')
  console.log('Note: No actual database changes were made!')
}

testStubOperations()
