// @ts-ignore
import express from 'express'
// @ts-ignore
import cors from 'cors'
// @ts-ignore
import dotenv from 'dotenv'
// @ts-ignore
import session from 'express-session'
// @ts-ignore
import cookieParser from 'cookie-parser'
import { prisma as realPrisma, getCmsDb, disconnectDatabases } from './db'
import { createPrismaStub } from './db-stub'
import { authService, AuthError } from './services/authService'
import { requireAuth } from './middleware/authMiddleware'
import { logger } from './logger'
import { loggingMiddleware } from './middleware/loggingMiddleware'
import { stripPortableSuffix } from '../src/services/adifService'
import { PrismaClient } from "@prisma/client";

// Type definitions
type ActivatorLogExport = {
  id: number
  activatedby: string
  callused: string
  wotaid: number
  date: Date
  time: Date | null
  year: number
  stncall: string
  ucall: string
  rpt: string | null
  s2s: string | null
  confirmed: boolean | null
  band: string | null
  frequency: string | null
  mode: string | null
}

// Load environment variables
dotenv.config()

// Check for stub database flag
const STUB_DB = process.argv.includes('--stub-db') || process.argv.includes('--dry-run')

if (STUB_DB) {
  logger.info('🔧 STUB MODE ENABLED - Mutations will be logged (not executed), reads will execute normally')
}

// Use stubbed or real Prisma based on flag
const prisma = STUB_DB ? createPrismaStub(realPrisma) : realPrisma

const app = express()
const PORT = process.env.PORT || 3003

// Middleware
app.use(cors({
  origin: 'http://localhost:3002', // Vite dev server
  credentials: true // Allow credentials (cookies)
}))
app.use(express.json())
app.use(cookieParser())
app.use(session({
  secret: process.env.SESSION_SECRET || 'wota-adif-development-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'lax'
  }
}))

// Logging middleware
app.use(loggingMiddleware(logger))

// Health check endpoint
app.get('/data/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Authentication endpoints
app.post('/data/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    // Verify credentials
    const [user] = await Promise.all([authService.verifyCredentials(username, password)])

    // Check if account is expired
    if (authService.isUserExpired(user)) {
      return res.status(401).json({ error: 'Account has expired' })
    }

    // Check if user is admin
    const adminUsers = process.env.ADMIN_USERS?.split(',').map(u => u.trim().toUpperCase()) || []
    const isAdmin = adminUsers.includes(user.username.toUpperCase())

    // Set session data
    req.session.userId = user.id
    req.session.username = user.username
    req.session.isAdmin = isAdmin

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: isAdmin
      }
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method }, 'Login error')

    if (error instanceof AuthError) {
      switch (error.code) {
        case 'USER_NOT_FOUND':
          return res.status(401).json({ error: 'Username not recognized' })
        case 'INVALID_PASSWORD':
          return res.status(401).json({ error: 'Password is incorrect' })
        case 'DATABASE_TIMEOUT':
          return res.status(504).json({ error: 'Database connection timeout. Please try again.' })
        case 'DATABASE_ERROR':
          return res.status(500).json({ error: 'Database error occurred. Please try again later.' })
      }
    }

    res.status(500).json({ error: 'Login failed' })
  }
})

app.post('/data/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ error: err, path: req.path, method: req.method }, 'Logout error')
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.clearCookie('connect.sid')
    res.json({ success: true })
  })
})

app.get('/data/api/auth/session', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        isAdmin: req.session.isAdmin || false
      }
    })
  } else {
    res.json({ authenticated: false })
  }
})

// ADIF import endpoint
app.post('/data/api/import/adif', requireAuth, async (req, res) => {
  try {
    const { records } = req.body

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid request: records array required' })
    }

    // Get the authenticated user's username
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const results = []
    const errors = []
    let skipped = 0

    // Track unique activations for points calculation (per summit per year)
    const uniqueActivations = new Set<string>()

    // Import records using Prisma transaction
    for (let i = 0; i < records.length; i++) {
      const record = records[i]

      try {
        // Validate required fields (activatedby is set from session, not from record)
        if (!record.wotaid || !record.stncall || !record.date) {
          errors.push({ record: i, reason: 'Missing required fields' })
          continue
        }

        // Validate WOTA ID is a valid number
        if (typeof record.wotaid !== 'number' || record.wotaid <= 0) {
          errors.push({ record: i, reason: 'Invalid WOTA reference' })
          continue
        }

        // Validate year (matches PHP log_activation.php lines 135-155)
        const validYears = [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                            2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
        if (!validYears.includes(record.year)) {
          errors.push({ record: i, reason: `Invalid year: ${record.year}. Must be between 2009-2026` })
          continue
        }

        // Strip /P or /M suffix from callused (matches PHP stncall function)
        const cleanCallused = stripPortableSuffix(record.callused)

        // Parse date to compare only the date part (not time)
        // Use UTC to avoid timezone offset issues
        const recordDate = new Date(record.date)
        const utcDate = new Date(Date.UTC(
          recordDate.getUTCFullYear(),
          recordDate.getUTCMonth(),
          recordDate.getUTCDate()
        ))

        // Check if this is a duplicate (matches PHP log_activation.php lines 53-54)
        // Include activatedby, wotaid, stncall, date, band, mode
        const existing = await prisma.activatorLog.findFirst({
          where: {
            activatedby: userCallsign,
            date: utcDate,
            wotaid: record.wotaid,
            stncall: record.stncall,
            band: record.band || null,
            mode: record.mode || null,
          },
        })

        if (existing) {
          logger.info({ recordIndex: i, callused: record.callused, stncall: record.stncall, date: utcDate.toISOString().split('T')[0] }, 'Skipping duplicate record')
          skipped++
          continue
        }

        // Check for matching chaser log entry to confirm the contact
        // Match criteria: ucall (chaser) = stncall (activator worked), wotaid, stncall (chaser) = callused (activator), date
        const matchingChaserLog = await prisma.chaserLog.findFirst({
          where: {
            ucall: record.ucall,
            wotaid: record.wotaid,
            stncall: cleanCallused,
            date: utcDate
          }
        })

        let confirmed = false
        if (matchingChaserLog) {
          confirmed = true
          // Update the matching chaser log record to confirmed
          await prisma.chaserLog.update({
            where: { id: matchingChaserLog.id },
            data: { confirmed: true }
          })
          logger.info({
            activator: cleanCallused,
            chaser: record.ucall,
            wotaid: record.wotaid,
            date: utcDate.toISOString().split('T')[0]
          }, 'Contact confirmed with matching chaser log')
        }

        // Insert into database
        const result = await prisma.activatorLog.create({
          data: {
            activatedby: userCallsign, // Use authenticated user's username
            callused: cleanCallused.substring(0, 8),
            wotaid: record.wotaid,
            date: utcDate,
            time: record.time || null,
            year: record.year,
            stncall: record.stncall,
            ucall: record.ucall,
            rpt: null,
            s2s: record.s2s,
            confirmed: confirmed,
            band: record.band || null,
            frequency: record.frequency || null,
            mode: record.mode || null,
          },
        })

        // Update summit table with last activator details
        // Only update if this activation is more recent than the existing last_act_date
        const summit = await prisma.summit.findUnique({
          where: { wotaid: record.wotaid },
          select: { last_act_date: true }
        })

        if (!summit?.last_act_date || utcDate >= summit.last_act_date) {
          await prisma.summit.update({
            where: { wotaid: record.wotaid },
            data: {
              last_act_by: cleanCallused,
              last_act_date: utcDate
            }
          })

          logger.info({
            summit: record.wotaid,
            activator: cleanCallused,
            date: utcDate.toISOString().split('T')[0]
          }, 'Updated summit last activation details')
        }

        results.push(result)

        // Track this activation for points calculation
        const activationKey = `${record.wotaid}-${record.year}`
        uniqueActivations.add(activationKey)
      } catch (error) {
        logger.error({ error, recordIndex: i, record }, 'Error importing record')
        errors.push({
          record: i,
          reason: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Calculate activator points for unique activations (matches PHP log_activation.php lines 158-170)
    let totalActPoints = 0
    let totalActPointsYr = 0

    if (results.length > 0) {
      // Group by unique activations
      for (const activationKey of Array.from(uniqueActivations)) {
        const [wotaidStr, yearStr] = activationKey.split('-')
        const wotaid = parseInt(wotaidStr)
        const year = parseInt(yearStr)

        const points = await calculateActivatorPoints(userCallsign, wotaid, year, prisma)
        totalActPoints += points.act_points
        totalActPointsYr += points.act_points_yr
      }

      logger.info({
        activator: userCallsign,
        uniqueActivations: uniqueActivations.size,
        actPoints: totalActPoints,
        actPointsYr: totalActPointsYr
      }, 'Calculated activator points')
    }

    res.json({
      success: true,
      imported: results.length,
      skipped: skipped,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      activatorPoints: {
        allTime: totalActPoints,
        yearly: totalActPointsYr,
        uniqueActivations: uniqueActivations.size
      }
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Import error')
    res.status(500).json({ error: 'Import failed' })
  }
})

// Check for duplicate records in activator_log
app.post('/data/api/import/check-duplicates', requireAuth, async (req, res) => {
  try {
    const { records } = req.body
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid request: records array required' })
    }

    const duplicateFlags = []
    const possibleDuplicateFlags = []

    for (const record of records) {
      // Skip records without required fields
      if (!record.date || !record.wotaid || !record.callused || !record.stncall) {
        duplicateFlags.push(false)
        possibleDuplicateFlags.push(false)
        continue
      }

      // Parse date to compare only the date part (not time)
      const recordDate = new Date(record.date)
      recordDate.setHours(0, 0, 0, 0)

      // Base criteria for matching (date, wotaid, callused, stncall)
      // Must also match activatedby to ensure we only check this user's logs
      const baseWhere = {
        date: recordDate,
        wotaid: record.wotaid,
        OR: [
          { callused: record.callused },
          { callused: `${record.callused}/P` },
          { callused: `${record.callused}/M` },
        ],
        stncall: record.stncall,
        activatedby: userCallsign,
      }

      // Check for exact duplicate (including band/mode)
      const exactDuplicate = await prisma.activatorLog.findFirst({
        where: {
          ...baseWhere,
          band: record.band || null,
          mode: record.mode || null,
        },
      })

      if (exactDuplicate) {
        logger.info({
          userCallsign,
          recordDate: recordDate.toISOString().split('T')[0],
          wotaid: record.wotaid,
          stncall: record.stncall,
          callused: record.callused,
          band: record.band,
          mode: record.mode,
          duplicateId: exactDuplicate.id
        }, 'Found exact duplicate record')
        duplicateFlags.push(true)
        possibleDuplicateFlags.push(false)
        continue
      }

      // Check for possible duplicate (matching base fields but database has null band/mode)
      const possibleDuplicate = await prisma.activatorLog.findFirst({
        where: {
          ...baseWhere,
          band: null,
          mode: null,
        },
      })

      duplicateFlags.push(false)
      possibleDuplicateFlags.push(!!possibleDuplicate)
    }

    res.json({
      duplicates: duplicateFlags,
      possibleDuplicates: possibleDuplicateFlags
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Duplicate check error')
    res.status(500).json({ error: 'Duplicate check failed' })
  }
})

// Check for duplicate chaser records
app.post('/data/api/import/check-chaser-duplicates', requireAuth, async (req, res) => {
  try {
    const { records } = req.body
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid request: records array required' })
    }

    const duplicateIndices: number[] = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]

      // Skip invalid records
      if (!record.wotaid || !record.date || !record.stncall) {
        continue
      }

      // Check for existing chaser log entry
      const existing = await prisma.chaserLog.findFirst({
        where: {
          wkdby: userCallsign,
          wotaid: record.wotaid,
          date: new Date(record.date),
          stncall: record.stncall
        }
      })

      if (existing) {
        duplicateIndices.push(i)
      }
    }

    res.json({ duplicates: duplicateIndices })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Chaser duplicate check error')
    res.status(500).json({ error: 'Duplicate check failed' })
  }
})

// Calculate activator points for first-time activations (matches PHP log_activation.php lines 14-32, 158-170)
async function calculateActivatorPoints(
  activatedby: string,
  wotaid: number,
  year: number,
  prisma: PrismaClient
): Promise<{
  act_points: number
  act_points_yr: number
}> {
  // Check all-time: has this activator activated this summit before?
  const existingAllTime = await prisma.activatorLog.findFirst({
    where: {
      activatedby: activatedby,
      wotaid: wotaid
    },
    select: { id: true }
  })
  const act_points = existingAllTime ? 0 : 1

  // Check yearly: has this activator activated this summit this year?
  const existingYearly = await prisma.activatorLog.findFirst({
    where: {
      activatedby: activatedby,
      wotaid: wotaid,
      year: year
    },
    select: { id: true }
  })
  const act_points_yr = existingYearly ? 0 : 1

  return { act_points, act_points_yr }
}

// Calculate chaser points based on existing contacts (matches PHP log_contact.php lines 54-69)
async function calculateChaserPoints(
  wkdby: string,
  wotaid: number,
  stncall: string,
  year: number,
  prisma: PrismaClient
): Promise<{
  wawpoints: number
  points: number
  wawpoints_yr: number
  points_yr: number
}> {
  // Default: award all points
  let wawpoints = 1
  let points = 1
  let wawpoints_yr = 1
  let points_yr = 1

  // Check all-time: any contact with this summit?
  const existingWaw = await prisma.chaserLog.findFirst({
    where: {
      wkdby: wkdby,
      wotaid: wotaid
    },
    select: { id: true }
  })
  if (existingWaw) wawpoints = 0

  // Check all-time: any contact with this summit and activator?
  const existingPoints = await prisma.chaserLog.findFirst({
    where: {
      wkdby: wkdby,
      wotaid: wotaid,
      stncall: stncall
    },
    select: { id: true }
  })
  if (existingPoints) points = 0

  // Check yearly: any contact with this summit this year?
  const existingWawYr = await prisma.chaserLog.findFirst({
    where: {
      wkdby: wkdby,
      wotaid: wotaid,
      year: year
    },
    select: { id: true }
  })
  if (existingWawYr) wawpoints_yr = 0

  // Check yearly: any contact with this summit and activator this year?
  const existingPointsYr = await prisma.chaserLog.findFirst({
    where: {
      wkdby: wkdby,
      wotaid: wotaid,
      stncall: stncall,
      year: year
    },
    select: { id: true }
  })
  if (existingPointsYr) points_yr = 0

  return { wawpoints, points, wawpoints_yr, points_yr }
}

// Import chaser ADIF records
app.post('/data/api/import/chaser-adif', requireAuth, async (req, res) => {
  try {
    const { records } = req.body
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid request: records array required' })
    }

    let imported = 0
    let skipped = 0
    let failed = 0

    for (const record of records) {
      try {
        // Validate required fields
        if (!record.wotaid || !record.ucall || !record.stncall || !record.date) {
          logger.warn({ record }, 'Skipping record with missing required fields')
          failed++
          continue
        }

        // Validate year (matches PHP log_contact.php lines 31-51)
        const validYears = [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                            2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
        if (!validYears.includes(record.year)) {
          logger.warn({ record, year: record.year }, 'Skipping record with invalid year')
          failed++
          continue
        }

        // Strip /P or /M suffix from stncall (matches PHP stncall function)
        const cleanStncall = stripPortableSuffix(record.stncall)

        // Check for duplicate (using cleaned stncall)
        const existing = await prisma.chaserLog.findFirst({
          where: {
            wkdby: userCallsign,
            wotaid: record.wotaid,
            date: new Date(record.date),
            stncall: cleanStncall
          }
        })

        if (existing) {
          logger.debug({ record }, 'Skipping duplicate chaser record')
          skipped++
          continue
        }

        // Parse time if provided
        let timeValue = null
        if (record.time) {
          // time is in format "HH:MM:SS"
          timeValue = new Date(`1970-01-01T${record.time}`)
        }

        // Check for matching activator log entry to confirm the contact
        // Match criteria: ucall (activator) = ucall (chaser), wotaid, callused (activator) = stncall (chaser), date
        // Use UTC to avoid timezone offset issues
        const recordDate = new Date(record.date)
        const utcDate = new Date(Date.UTC(
          recordDate.getUTCFullYear(),
          recordDate.getUTCMonth(),
          recordDate.getUTCDate()
        ))

        const matchingActivatorLog = await prisma.activatorLog.findFirst({
          where: {
            ucall: record.ucall,
            wotaid: record.wotaid,
            callused: cleanStncall,
            date: utcDate
          }
        })

        let confirmed = false
        if (matchingActivatorLog) {
          confirmed = true
          // Update the matching activator log record to confirmed
          await prisma.activatorLog.update({
            where: { id: matchingActivatorLog.id },
            data: { confirmed: true }
          })
          logger.info({
            chaser: record.ucall,
            activator: record.stncall,
            wotaid: record.wotaid,
            date: utcDate.toISOString().split('T')[0]
          }, 'Contact confirmed with matching activator log')
        }

        // Calculate points based on existing contacts (matches PHP log_contact.php lines 54-69)
        const calculatedPoints = await calculateChaserPoints(
          userCallsign,
          record.wotaid,
          cleanStncall,
          record.year,
          prisma
        )

        // Insert record
        await prisma.chaserLog.create({
          data: {
            wkdby: userCallsign,
            ucall: record.ucall.substring(0, 8),
            stncall: cleanStncall.substring(0, 12),
            wotaid: record.wotaid,
            date: utcDate,
            time: timeValue,
            year: record.year,
            points: calculatedPoints.points,
            wawpoints: calculatedPoints.wawpoints,
            points_yr: calculatedPoints.points_yr,
            wawpoints_yr: calculatedPoints.wawpoints_yr,
            confirmed: confirmed
          }
        })

        logger.info({ wkdby: userCallsign, wotaid: record.wotaid, stncall: record.stncall, confirmed }, 'Imported chaser record')
        imported++
      } catch (error) {
        logger.error({ error, record }, 'Failed to import chaser record')
        failed++
      }
    }

    logger.info({ imported, skipped, failed, username: userCallsign }, 'Chaser ADIF import complete')
    res.json({ imported, skipped, failed })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Chaser ADIF import error')
    res.status(500).json({ error: 'Import failed' })
  }
})

// Get all spots
app.get('/data/api/spots', requireAuth, async (req, res) => {
  try {
    const spots = await prisma.spot.findMany({
      orderBy: { datetime: 'desc' },
      take: 50,
    })
    res.json(spots)
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching spots')
    res.status(500).json({ error: 'Failed to fetch spots' })
  }
})

// Get all summits
app.get('/data/api/summits', requireAuth, async (req, res) => {
  try {
    const summits = await prisma.summit.findMany({
      orderBy: { wotaid: 'asc' },
    })
    res.json(summits)
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching summits')
    res.status(500).json({ error: 'Failed to fetch summits' })
  }
})

// Look up summit by SOTA reference
app.get('/data/api/summits/sota/:reference', requireAuth, async (req, res) => {
  try {
    const sotaRef = req.params.reference.toUpperCase()
    logger.info({ sotaRef }, 'Looking up SOTA reference')

    // Parse SOTA reference (e.g., "G/LD-014" -> "014")
    // SOTA references for Lake District start with G/LD-
    const match = sotaRef.match(/^G\/LD-(\d+)$/)
    if (!match) {
      logger.info({ sotaRef }, 'Invalid SOTA reference format')
      return res.status(400).json({ error: 'Invalid SOTA reference format' })
    }

    const sotaNumber = match[1] // e.g., "014"
    const sotaId = parseInt(sotaNumber, 10) // Convert to integer: 14
    logger.info({ sotaNumber, sotaId }, 'Parsed SOTA number')

    const summit = await prisma.summit.findFirst({
      where: {
        sotaid: sotaId,
      },
    })

    if (!summit) {
      logger.info({ sotaRef, sotaId }, 'Summit not found for SOTA reference')
      return res.status(404).json({ error: 'Summit not found for SOTA reference' })
    }

    logger.info({ summitName: summit.name, wotaid: summit.wotaid }, 'Found summit')
    res.json(summit)
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error looking up SOTA reference')
    res.status(500).json({ error: 'Failed to look up SOTA reference' })
  }
})

// Validate WOTA summit references
app.post('/data/api/summits/validate', async (req, res) => {
  try {
    const { references } = req.body

    if (!Array.isArray(references)) {
      return res.status(400).json({ error: 'Invalid request: references array required' })
    }

    const summits = await prisma.summit.findMany({
      where: {
        ref: { in: references }
      },
      select: {
        wotaid: true,
        ref: true,
        name: true
      }
    })

    const validRefs = summits.map((s: { wotaid: any; ref: any; name: any }) => ({ id: s.wotaid, ref: s.ref, name: s.name }))
    const invalidRefs = references.filter(
      ref => !summits.find((s: { ref: any }) => s.ref === ref)
    )

    res.json({ valid: validRefs, invalid: invalidRefs })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method }, 'Summit validation error')
    res.status(500).json({ error: 'Validation failed' })
  }
})

// Get all alerts
app.get('/data/api/alerts', requireAuth, async (req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      orderBy: { datetime: 'desc' },
      take: 50,
    })
    res.json(alerts)
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching alerts')
    res.status(500).json({ error: 'Failed to fetch alerts' })
  }
})

// Get database statistics
app.get('/data/api/statistics', requireAuth, async (req, res) => {
  try {
    // Get activator statistics
    const totalActivations = await prisma.activatorLog.count()
    const uniqueActivators = await prisma.activatorLog.groupBy({
      by: ['activatedby'],
    })
    const uniqueActivatedSummits = await prisma.activatorLog.groupBy({
      by: ['wotaid'],
    })

    // Get chaser statistics
    const totalChases = await prisma.chaserLog.count()
    const uniqueChasers = await prisma.chaserLog.groupBy({
      by: ['wkdby'],
    })
    const uniqueChasedSummits = await prisma.chaserLog.groupBy({
      by: ['wotaid'],
    })

    // Get total summits
    const totalSummits = await prisma.summit.count()

    // Get 5 most recently activated summits
    const recentActivations = await prisma.activatorLog.findMany({
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        wotaid: true,
        date: true,
        callused: true,
      },
      distinct: ['wotaid'],
    })

    // Get summit details for the recent activations
    const recentSummits = await Promise.all(
      recentActivations.map(async (activation: { wotaid: any; date: any; callused: any }) => {
        const summit = await prisma.summit.findUnique({
          where: { wotaid: activation.wotaid },
          select: { wotaid: true, name: true },
        })
        return {
          wotaid: activation.wotaid,
          name: summit?.name || `Summit ${activation.wotaid}`,
          date: activation.date,
          callsign: activation.callused,
        }
      })
    )

    // Get recent activity dates
    const recentActivation = await prisma.activatorLog.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    })

    const recentChase = await prisma.chaserLog.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    })

    res.json({
      activations: {
        total: totalActivations,
        uniqueActivators: uniqueActivators.length,
        uniqueSummits: uniqueActivatedSummits.length,
        lastActivity: recentActivation?.date || null,
      },
      chases: {
        total: totalChases,
        uniqueChasers: uniqueChasers.length,
        uniqueSummits: uniqueChasedSummits.length,
        lastActivity: recentChase?.date || null,
      },
      summits: {
        total: totalSummits,
        recentActivations: recentSummits,
      },
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching statistics')
    res.status(500).json({ error: 'Failed to fetch statistics' })
  }
})

// Get paginated activator contacts for logged-in user
app.get('/data/api/contacts/activator', requireAuth, async (req, res) => {
  try {
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Parse pagination and filter parameters
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 25
    const yearFilter = req.query.year ? parseInt(req.query.year as string) : null
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc'
    const skip = (page - 1) * pageSize

    // Build where clause
    const whereClause: any = { activatedby: userCallsign }
    if (yearFilter) {
      whereClause.year = yearFilter
    }

    // Get available years for this user
    const allRecords = await prisma.activatorLog.findMany({
      where: { activatedby: userCallsign },
      select: { year: true },
      orderBy: { year: 'desc' },
    })
    const availableYears = Array.from(new Set(allRecords.map((r: { year: any }) => r.year))).sort((a, b) => (b as number) - (a as number))

    // Get total count with filter
    const total = await prisma.activatorLog.count({
      where: whereClause,
    })

    // Get paginated records
    const contacts = await prisma.activatorLog.findMany({
      where: whereClause,
      orderBy: [
        { date: sortOrder },
        { time: sortOrder },
      ],
      skip,
      take: pageSize,
    })

    // Get summit names for each contact
    const contactsWithSummits = await Promise.all(
      contacts.map(async (contact: { wotaid: any }) => {
        const summit = await prisma.summit.findUnique({
          where: { wotaid: contact.wotaid },
          select: { name: true },
        })
        return {
          ...contact,
          summitName: summit?.name || null,
        }
      })
    )

    res.json({
      contacts: contactsWithSummits,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      availableYears,
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching activator contacts')
    res.status(500).json({ error: 'Failed to fetch contacts' })
  }
})

// Get chaser contacts for authenticated user
app.get('/data/api/contacts/chaser', requireAuth, async (req, res) => {
  try {
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Parse pagination and filter parameters
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 25
    const yearFilter = req.query.year ? parseInt(req.query.year as string) : null
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc'
    const skip = (page - 1) * pageSize

    // Build where clause
    const whereClause: any = { wkdby: userCallsign }
    if (yearFilter) {
      whereClause.year = yearFilter
    }

    // Get available years for this user
    const allRecords = await prisma.chaserLog.findMany({
      where: { wkdby: userCallsign },
      select: { year: true },
      orderBy: { year: 'desc' },
    })
    const availableYears = Array.from(new Set(allRecords.map((r: { year: any }) => r.year))).sort((a, b) => (b as number) - (a as number));

    // Get total count with filter
    const total = await prisma.chaserLog.count({
      where: whereClause,
    })

    // Get paginated records
    const contacts = await prisma.chaserLog.findMany({
      where: whereClause,
      orderBy: [
        { date: sortOrder },
        { time: sortOrder },
      ],
      skip,
      take: pageSize,
    })

    // Get summit names for each contact
    const contactsWithSummits = await Promise.all(
      contacts.map(async (contact: { wotaid: any }) => {
        const summit = await prisma.summit.findUnique({
          where: { wotaid: contact.wotaid },
          select: { name: true },
        })
        return {
          ...contact,
          summitName: summit?.name || null,
        }
      })
    )

    res.json({
      contacts: contactsWithSummits,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      availableYears,
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching chaser contacts')
    res.status(500).json({ error: 'Failed to fetch contacts' })
  }
})

// Get user-specific statistics
app.get('/data/api/statistics/user', requireAuth, async (req, res) => {
  try {
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Get activator statistics for this user (ucall)
    const totalActivations = await prisma.activatorLog.count({
      where: { activatedby: userCallsign }
    })
    const uniqueActivatedSummits = await prisma.activatorLog.groupBy({
      by: ['wotaid'],
      where: { activatedby: userCallsign }
    })

    // Get chaser statistics for this user (ucall)
    const totalChases = await prisma.chaserLog.count({
      where: { wkdby: userCallsign }
    })
    const uniqueChasedSummits = await prisma.chaserLog.groupBy({
      by: ['wotaid'],
      where: { wkdby: userCallsign }
    })

    // Get recent activity dates for this user
    const recentActivation = await prisma.activatorLog.findFirst({
      where: { activatedby: userCallsign },
      orderBy: { date: 'desc' },
      select: { date: true },
    })

    const recentChase = await prisma.chaserLog.findFirst({
      where: { wkdby: userCallsign },
      orderBy: { date: 'desc' },
      select: { date: true },
    })

    res.json({
      callsign: userCallsign,
      activations: {
        total: totalActivations,
        uniqueSummits: uniqueActivatedSummits.length,
        lastActivity: recentActivation?.date || null,
      },
      chases: {
        total: totalChases,
        uniqueSummits: uniqueChasedSummits.length,
        lastActivity: recentChase?.date || null,
      },
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching user statistics')
    res.status(500).json({ error: 'Failed to fetch user statistics' })
  }
})

// Helper function to format WOTA reference
function formatWotaReference(wotaid: number): string {
  if (wotaid <= 214) {
    return `LDW-${String(wotaid).padStart(3, '0')}`
  } else {
    return `LDO-${String(wotaid - 214).padStart(3, '0')}`
  }
}

// Export activator log as CSV
app.get('/data/api/export/activator', requireAuth, async (req, res) => {
  try {
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Parse query parameters
    const callsignsParam = req.query.callsigns as string | undefined
    const yearParam = req.query.year as string | undefined

    logger.info({ callsignsParam, yearParam }, 'Export activator - query parameters')

    // Build dynamic where clause
    const whereClause: any = {}

    // Add callsign filter - ONLY match on ucall column
    if (callsignsParam) {
      const callsigns = callsignsParam.split(',').map(c => c.trim().toUpperCase()).filter(c => c)
      logger.info({ callsigns }, 'Export activator - parsed callsigns')
      if (callsigns.length > 0) {
        // Match ONLY on ucall field
        whereClause.activatedby = { in: callsigns }
      }
    } else {
      // If no callsigns specified, default to the logged-in user's callsign
      whereClause.activatedby = userCallsign
    }

    // Add year filter
    if (yearParam) {
      const year = parseInt(yearParam, 10)
      if (!isNaN(year) && year >= 1900 && year <= 2099) {
        whereClause.year = year
      }
    }

    logger.info({ whereClause }, 'Export activator - where clause')

    // Filter logs by user's callsign (ucall field) and optional filters
    const logs = await prisma.activatorLog.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
    })

    logger.info({ count: logs.length }, 'Export activator - found logs')

    // Get summit names for all unique WOTA IDs
    const uniqueWotaIds = Array.from(new Set(logs.map((log: { wotaid: number }) => log.wotaid)))
    const summits = await prisma.summit.findMany({
      where: { wotaid: { in: uniqueWotaIds } },
      select: { wotaid: true, name: true },
    })
    const summitMap = new Map(summits.map((s: { wotaid: any; name: any }) => [s.wotaid, s.name]))

    // Create CSV header
    const headers = [
      'ID',
      'Activated By',
      'Call Used',
      'WOTA Reference',
      'WOTA Name',
      'Date',
      'Time',
      'Year',
      'Station Call',
      'Your Call',
      'RPT',
      'S2S',
      'Confirmed',
      'Band',
      'Frequency',
      'Mode',
    ]

    // Create CSV rows
    const rows = logs.map((log: ActivatorLogExport) => [
      log.id,
      log.activatedby,
      log.callused,
      formatWotaReference(log.wotaid),
      summitMap.get(log.wotaid) || '',
      log.date.toISOString().split('T')[0],
      log.time ? log.time.toISOString().split('T')[1].split('.')[0] : '',
      log.year,
      log.stncall,
      log.ucall,
      log.rpt ?? '',
      log.s2s ?? '',
      log.confirmed ?? '',
      log.band ?? '',
      log.frequency ?? '',
      log.mode ?? '',
    ])

    // Combine header and rows
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=${userCallsign}_activator_log.csv`)
    res.send(csv)
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error exporting activator log')
    res.status(500).json({ error: 'Failed to export activator log' })
  }
})

// Export chaser log as CSV
app.get('/data/api/export/chaser', requireAuth, async (req, res) => {
  try {
    const userCallsign = req.session.username

    if (!userCallsign) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Parse query parameters
    const callsignsParam = req.query.callsigns as string | undefined
    const yearParam = req.query.year as string | undefined

    logger.info({ callsignsParam, yearParam }, 'Export chaser - query parameters')

    // Build dynamic where clause
    const whereClause: any = {}

    // Add callsign filter - ONLY match on ucall column
    if (callsignsParam) {
      const callsigns = callsignsParam.split(',').map(c => c.trim().toUpperCase()).filter(c => c)
      logger.info({ callsigns }, 'Export chaser - parsed callsigns')
      if (callsigns.length > 0) {
        // Match ONLY on ucall field
        whereClause.wkdby = { in: callsigns }
      }
    } else {
      // If no callsigns specified, default to the logged-in user's callsign
      whereClause.wkdby = userCallsign
    }

    // Add year filter
    if (yearParam) {
      const year = parseInt(yearParam, 10)
      if (!isNaN(year) && year >= 1900 && year <= 2099) {
        whereClause.year = year
      }
    }

    logger.info({ whereClause }, 'Export chaser - where clause')

    // Filter logs by user's callsign (ucall field) and optional filters
    const logs = await prisma.chaserLog.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
    })

    logger.info({ count: logs.length }, 'Export chaser - found logs')

    // Get summit names for all unique WOTA IDs
    const uniqueWotaIds = Array.from(new Set(logs.map((log: { wotaid: number }) => log.wotaid)))
    const summits = await prisma.summit.findMany({
      where: { wotaid: { in: uniqueWotaIds } },
      select: { wotaid: true, name: true },
    })
    const summitMap = new Map(summits.map((s: { wotaid: number; name: string }) => [s.wotaid, s.name]))

    // Create CSV header
    const headers = [
      'ID',
      'Worked By',
      'Unique Call',
      'WOTA Reference',
      'WOTA Name',
      'Date',
      'Time',
      'Year',
      'Station Call',
      'RPT',
      'Points',
      'WAW Points',
      'Points Year',
      'WAW Points Year',
      'Confirmed',
    ]

    // Create CSV rows
    const rows = logs.map((log: { id: any; wkdby: any; ucall: any; wotaid: number; date: { toISOString: () => string }; time: { toISOString: () => string }; year: any; stncall: any; rpt: any; points: any; wawpoints: any; points_yr: any; wawpoints_yr: any; confirmed: any }) => [
      log.id,
      log.wkdby,
      log.ucall,
      formatWotaReference(log.wotaid),
      summitMap.get(log.wotaid) || '',
      log.date.toISOString().split('T')[0],
      log.time ? log.time.toISOString().split('T')[1].split('.')[0] : '',
      log.year,
      log.stncall,
      log.rpt ?? '',
      log.points,
      log.wawpoints,
      log.points_yr,
      log.wawpoints_yr,
      log.confirmed ?? '',
    ])

    // Combine header and rows
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=${userCallsign}_chaser_log.csv`)
    res.send(csv)
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error exporting chaser log')
    res.status(500).json({ error: 'Failed to export chaser log' })
  }
})

// Example CMS database query
// This demonstrates how to query the CMS database
app.get('/data/api/cms/test', async (req, res) => {
  try {
    const cmsDb = getCmsDb()
    // Example query - adjust table name and columns as needed
    const [rows] = await cmsDb.query('SELECT 1 as test')
    res.json({ status: 'CMS database connected', data: rows })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method }, 'Error querying CMS database')
    res.status(500).json({ error: 'Failed to query CMS database' })
  }
})

// Admin-only endpoint to fetch logs
app.get('/data/api/admin/logs', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 50
    const level = req.query.level as string | undefined
    const skip = (page - 1) * pageSize

    // Build where clause
    const whereClause: any = {}
    if (level) {
      whereClause.level = level
    }

    // Get total count
    const total = await prisma.log.count({ where: whereClause })

    // Get logs
    const logs = await prisma.log.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize
    })

    // Convert BigInt to string for JSON serialization
    const logsWithStringIds = logs.map(log => ({
      ...log,
      id: log.id.toString()
    }))

    res.json({
      logs: logsWithStringIds,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching logs')
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDatabases()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await disconnectDatabases()
  process.exit(0)
})

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, `API server running on http://localhost:${PORT}`)
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error({ port: PORT }, `Error: Port ${PORT} is already in use. Please stop the other process or use a different port`)
    process.exit(1)
  } else {
    logger.error({ error }, `Server error: ${error.message}`)
    process.exit(1)
  }
})
