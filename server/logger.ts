import pino from 'pino'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logLevel = process.env.LOG_LEVEL || 'info'

const logger = pino({
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
          destination: path.join(__dirname, '..', 'logs', `app-${new Date().toISOString().split('T')[0]}.log`),
          mkdir: true,
        },
      },
    ],
  },
})

export { logger }
