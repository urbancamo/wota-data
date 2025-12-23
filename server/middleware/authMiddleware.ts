import { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.userId) {
    // User is authenticated
    next()
  } else {
    // User is not authenticated
    res.status(401).json({ error: 'Authentication required' })
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // Always pass through, but user data will be in session if logged in
  next()
}
