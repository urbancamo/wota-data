import { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session) {
    // User is authenticated
    next()
  } else {
    // User is not authenticated
    res.status(401).json({ error: 'Authentication required' })
  }
}
