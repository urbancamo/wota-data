import { getCmsDb } from '../db'
import * as crypto from 'crypto'

export interface User {
  id: number
  username: string
  createdate: Date | null
  expires: Date | null
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'USER_NOT_FOUND' | 'INVALID_PASSWORD' | 'DATABASE_TIMEOUT' | 'DATABASE_ERROR'
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export class AuthService {
  // Verify credentials against CMS database
  async verifyCredentials(username: string, password: string): Promise<User> {
    const cmsDb = getCmsDb()

    try {
      // First, check if username exists (case-insensitive)
      const [userRows] = await Promise.race([
        cmsDb.query<any[]>(
          'SELECT id, username, password, createdate, expires FROM cms_module_feusers_users WHERE LOWER(username) = LOWER(?)',
          [username]
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database timeout')), 10000)
        )
      ])

      if (userRows.length === 0) {
        throw new AuthError('Username not recognized', 'USER_NOT_FOUND')
      }

      const user = userRows[0]

      // Hash password with MD5
      const hashedPassword = crypto.createHash('md5').update(password).digest('hex')

      // Check if password matches
      if (user.password !== hashedPassword) {
        throw new AuthError('Password is incorrect', 'INVALID_PASSWORD')
      }

      // Return user data (without password)
      return {
        id: user.id,
        username: user.username,
        createdate: user.createdate,
        expires: user.expires
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      if (error instanceof Error && error.message === 'Database timeout') {
        throw new AuthError('Database connection timeout', 'DATABASE_TIMEOUT')
      }
      throw new AuthError('Database error occurred', 'DATABASE_ERROR')
    }
  }

  // Check if user account is expired (if expires field is used)
  isUserExpired(user: User): boolean {
    if (!user.expires) {
      return false
    }
    return new Date() > new Date(user.expires)
  }
}

export const authService = new AuthService()
