import build from 'pino-abstract-transport'
import { PrismaClient } from '@prisma/client'
import os from 'os'

// Transport runs in a worker thread, so needs its own client with limited pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `${process.env.WOTA_DATABASE_URL}?connection_limit=3&pool_timeout=30`,
    },
  },
})

// Extract useful information from the log object
function extractLogData(log: any) {
  const {
    level,
    time,
    msg,
    pid,
    hostname,
    error,
    path,
    method,
    username,
    userId,
    statusCode,
    requestId,
    ...context
  } = log

  // Map Pino numeric log levels to string levels
  const levelMap: { [key: number]: string } = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal'
  }

  const levelString = levelMap[level] || 'info'

  // Extract error details if present
  let errorMessage = null
  let errorStack = null
  if (error) {
    if (typeof error === 'object') {
      errorMessage = error.message || JSON.stringify(error)
      errorStack = error.stack || null
    } else {
      errorMessage = String(error)
    }
  }

  // Remove sensitive or redundant fields from context
  const cleanContext = { ...context }
  delete cleanContext.level
  delete cleanContext.time
  delete cleanContext.msg
  delete cleanContext.pid
  delete cleanContext.hostname

  return {
    timestamp: new Date(time),
    level: levelString,
    message: msg || null,
    context: Object.keys(cleanContext).length > 0 ? cleanContext : null,
    hostname: hostname || os.hostname(),
    pid: pid || process.pid,
    request_id: requestId || null,
    user_id: userId != null ? String(userId) : null,
    username: username || null,
    path: path || null,
    method: method || null,
    status_code: statusCode || null,
    error_message: errorMessage,
    error_stack: errorStack
  }
}

const BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 1000

export default async function (opts: any) {
  return build(async function (source) {
    let buffer: ReturnType<typeof extractLogData>[] = []
    let flushTimeout: NodeJS.Timeout | null = null
    let flushing = false

    async function flush() {
      if (buffer.length === 0 || flushing) return
      flushing = true
      const toFlush = buffer
      buffer = []
      if (flushTimeout) {
        clearTimeout(flushTimeout)
        flushTimeout = null
      }
      try {
        await prisma.log.createMany({ data: toFlush })
      } catch (error) {
        console.error('Failed to write logs to database:', error)
      }
      flushing = false
    }

    function scheduleFlush() {
      if (!flushTimeout) {
        flushTimeout = setTimeout(flush, FLUSH_INTERVAL_MS)
      }
    }

    for await (const obj of source) {
      try {
        const logData = extractLogData(obj)
        buffer.push(logData)
        if (buffer.length >= BATCH_SIZE) {
          await flush()
        } else {
          scheduleFlush()
        }
      } catch (error) {
        console.error('Failed to parse log entry:', error)
      }
    }

    // Flush remaining logs on stream end
    await flush()
  })
}
