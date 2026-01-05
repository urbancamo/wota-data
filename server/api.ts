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
    maxAge: null, // Non-expiring session
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

    // Set session data
    req.session.userId = user.id
    req.session.username = user.username

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
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
        username: req.session.username
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

        // Parse date to compare only the date part (not time)
        const recordDate = new Date(record.date)
        recordDate.setHours(0, 0, 0, 0)

        // Check if this is a duplicate
        // Include band and mode in duplicate check if present in ADIF file
        const existing = await prisma.activatorLog.findFirst({
          where: {
            date: recordDate,
            wotaid: record.wotaid,
            OR: [
              { callused: record.callused },
              { callused: `${record.callused}/P` },
              { callused: `${record.callused}/M` },
            ],
            ucall: record.ucall,
            band: record.band || null,
            mode: record.mode || null,
          },
        })

        if (existing) {
          logger.info({ recordIndex: i, callused: record.callused, stncall: record.stncall, date: recordDate.toISOString().split('T')[0] }, 'Skipping duplicate record')
          skipped++
          continue
        }

        // Insert into database
        const result = await prisma.activatorLog.create({
          data: {
            activatedby: userCallsign, // Use authenticated user's username
            callused: record.callused,
            wotaid: record.wotaid,
            date: recordDate,
            time: record.time || null,
            year: record.year,
            stncall: record.stncall,
            ucall: record.ucall,
            rpt: null,
            s2s: record.s2s,
            confirmed: false, // Defaults to false (updated by separate job)
            band: record.band || null,
            frequency: record.frequency || null,
            mode: record.mode || null,
          },
        })

        results.push(result)
      } catch (error) {
        logger.error({ error, recordIndex: i, record }, 'Error importing record')
        errors.push({
          record: i,
          reason: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    res.json({
      success: true,
      imported: results.length,
      skipped: skipped,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
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
    const userCallsign = req.user?.username?.toUpperCase()

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
      recentActivations.map(async (activation) => {
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
    const availableYears = Array.from(new Set(allRecords.map(r => r.year))).sort((a, b) => (b as number) - (a as number))

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
      contacts.map(async (contact) => {
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
    const availableYears = Array.from(new Set(allRecords.map(r => r.year))).sort((a, b) => (b as number) - (a as number));

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
      contacts.map(async (contact) => {
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
    const uniqueWotaIds = Array.from(new Set(logs.map(log => log.wotaid)))
    const summits = await prisma.summit.findMany({
      where: { wotaid: { in: uniqueWotaIds } },
      select: { wotaid: true, name: true },
    })
    const summitMap = new Map(summits.map(s => [s.wotaid, s.name]))

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
    const rows = logs.map((log) => [
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
    const uniqueWotaIds = Array.from(new Set(logs.map(log => log.wotaid)))
    const summits = await prisma.summit.findMany({
      where: { wotaid: { in: uniqueWotaIds } },
      select: { wotaid: true, name: true },
    })
    const summitMap = new Map(summits.map(s => [s.wotaid, s.name]))

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
    const rows = logs.map((log) => [
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
