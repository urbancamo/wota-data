import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId?: number
    username?: string
  }
}

declare global {
  namespace Express {
    interface Request {
      requestStartTime?: number
    }
  }
}
