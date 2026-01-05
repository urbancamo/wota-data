import pino from 'pino'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logLevel = process.env.LOG_LEVEL || 'info'
const isDevelopment = process.env.NODE_ENV !== 'production'

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Create a daily log file path
const logFilePath = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`)

// Use different configurations for development and production
const logger = isDevelopment
  ? pino({
      level: logLevel,
      transport: {
        targets: [
          {
            target: 'pino-pretty',
            level: logLevel,
            options: {
              colorize: true,
              translateTime: 'yyyy-mm-dd HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          },
          {
            target: 'pino/file',
            level: logLevel,
            options: {
              destination: logFilePath,
              mkdir: true,
            },
          },
        ],
      },
    })
  : pino(
      {
        level: logLevel,
      },
      pino.multistream([
        { stream: process.stdout },
        { stream: pino.destination(logFilePath) },
      ])
    )

export { logger }
