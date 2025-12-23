import mysql from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'

// Prisma client for WOTA Spotter database
export const prisma = new PrismaClient()

// MySQL connection pool for CMS database
let cmsPool: mysql.Pool | null = null

export function getCmsDb(): mysql.Pool {
  if (!cmsPool) {
    const cmsUrl = process.env.CMS_DATABASE_URL
    if (!cmsUrl) {
      throw new Error('CMS_DATABASE_URL environment variable is not set')
    }

    cmsPool = mysql.createPool({
      uri: cmsUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  }

  return cmsPool
}

// Graceful shutdown helper
export async function disconnectDatabases() {
  await prisma.$disconnect()
  if (cmsPool) {
    await cmsPool.end()
  }
}