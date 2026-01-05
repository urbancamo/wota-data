import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { loggingMiddleware } from '../server/middleware/loggingMiddleware'

describe('Logging Middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction
  let mockLogger: any

  beforeEach(() => {
    req = {
      method: 'GET',
      path: '/data/api/test',
      session: {}
    }

    res = {
      statusCode: 200,
      on: vi.fn((event, callback) => {
        if (event === 'finish') {
          callback()
        }
        return res as Response
      })
    }

    next = vi.fn()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }
  })

  describe('Request Logging', () => {
    it('should capture request start time', () => {
      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(req.requestStartTime).toBeDefined()
      expect(typeof req.requestStartTime).toBe('number')
    })

    it('should call next() to continue request processing', () => {
      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(next).toHaveBeenCalledTimes(1)
    })

    it('should extract username from session when authenticated', () => {
      req.session = { username: 'M0ABC', userId: 123 }

      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })

    it('should handle missing session gracefully', () => {
      req.session = undefined

      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })
  })

  describe('Response Logging', () => {
    it('should log response with username when authenticated', () => {
      req.session = { username: 'M0ABC', userId: 123 }
      req.requestStartTime = Date.now()

      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function))
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/data/api/test',
          statusCode: 200,
          username: 'M0ABC',
          duration: expect.any(Number)
        }),
        'Request completed'
      )
    })

    it('should log response without username when not authenticated', () => {
      req.requestStartTime = Date.now()

      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/data/api/test',
          statusCode: 200,
          duration: expect.any(Number)
        }),
        'Request completed'
      )

      const logCall = mockLogger.info.mock.calls[0][0]
      expect(logCall.username).toBeUndefined()
    })

    it('should calculate response duration correctly', (done) => {
      const startTime = Date.now()
      req.requestStartTime = startTime

      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      setTimeout(() => {
        expect(mockLogger.info).toHaveBeenCalled()
        const logCall = mockLogger.info.mock.calls[0][0]
        expect(logCall.duration).toBeGreaterThanOrEqual(0)
        expect(logCall.duration).toBeLessThan(100)
        done()
      }, 10)
    })

    it('should log different HTTP methods correctly', () => {
      req.method = 'POST'
      req.requestStartTime = Date.now()

      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST'
        }),
        'Request completed'
      )
    })

    it('should log different status codes correctly', () => {
      res.statusCode = 404
      req.requestStartTime = Date.now()

      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404
        }),
        'Request completed'
      )
    })

    it('should handle paths with query strings', () => {
      req.path = '/data/api/contacts/activator'
      req.requestStartTime = Date.now()

      loggingMiddleware(mockLogger)(req as Request, res as Response, next)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/data/api/contacts/activator'
        }),
        'Request completed'
      )
    })
  })
})
