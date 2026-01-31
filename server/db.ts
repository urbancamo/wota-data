import mysql from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'

// Prisma client for WOTA Spotter database
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `${process.env.WOTA_DATABASE_URL}?connection_limit=20&pool_timeout=30`,
    },
  },
})

// MySQL connection pool for CMS database
let cmsPool: mysql.Pool | null = null

export function getCmsDb(): mysql.Pool {
  if (!cmsPool) {
    const cmsUrl = process.env.CMS_DATABASE_URL
    if (!cmsUrl) {
      throw new Error('CMS_DATABASE_URL environment variable is not set')
    }

    // Parse the connection URL
    // Format: mysql://username:password@host:port/database
    const url = new URL(cmsUrl)

    cmsPool = mysql.createPool({
      host: url.hostname,
      port: parseInt(url.port || '3306'),
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1), // Remove leading slash
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 30000, // 30 seconds timeout for VPN connections
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
