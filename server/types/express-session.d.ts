import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId?: number
    username?: string
    isAdmin?: boolean
  }
}

declare global {
  namespace Express {
    interface Request {
      requestStartTime?: number
    }
  }
}
