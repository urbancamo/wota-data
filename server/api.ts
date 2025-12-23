import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import { prisma, getCmsDb, disconnectDatabases } from './db'
import { authService } from './services/authService'
import { requireAuth } from './middleware/authMiddleware'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    // Verify credentials
    const user = await authService.verifyCredentials(username, password)

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

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
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err)
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.clearCookie('connect.sid')
    res.json({ success: true })
  })
})

app.get('/api/auth/session', (req, res) => {
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

// Get all spots
app.get('/api/spots', requireAuth, async (req, res) => {
  try {
    const spots = await prisma.spot.findMany({
      orderBy: { datetime: 'desc' },
      take: 50,
    })
    res.json(spots)
  } catch (error) {
    console.error('Error fetching spots:', error)
    res.status(500).json({ error: 'Failed to fetch spots' })
  }
})

// Get all summits
app.get('/api/summits', requireAuth, async (req, res) => {
  try {
    const summits = await prisma.summit.findMany({
      orderBy: { wotaid: 'asc' },
    })
    res.json(summits)
  } catch (error) {
    console.error('Error fetching summits:', error)
    res.status(500).json({ error: 'Failed to fetch summits' })
  }
})

// Get all alerts
app.get('/api/alerts', requireAuth, async (req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      orderBy: { datetime: 'desc' },
      take: 50,
    })
    res.json(alerts)
  } catch (error) {
    console.error('Error fetching alerts:', error)
    res.status(500).json({ error: 'Failed to fetch alerts' })
  }
})

// Example CMS database query
// This demonstrates how to query the CMS database
app.get('/api/cms/test', async (req, res) => {
  try {
    const cmsDb = getCmsDb()
    // Example query - adjust table name and columns as needed
    const [rows] = await cmsDb.query('SELECT 1 as test')
    res.json({ status: 'CMS database connected', data: rows })
  } catch (error) {
    console.error('Error querying CMS database:', error)
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

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})