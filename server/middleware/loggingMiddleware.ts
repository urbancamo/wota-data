import { Request, Response, NextFunction } from 'express'
import { Logger } from 'pino'

export function loggingMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.requestStartTime = Date.now()

    res.on('finish', () => {
      const duration = Date.now() - (req.requestStartTime || Date.now())
      const username = req.session?.username

      const logData: any = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration
      }

      if (username) {
        logData.username = username
      }

      logger.info(logData, 'Request completed')
    })

    next()
  }
}
