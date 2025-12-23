import { getCmsDb } from '../db'
import crypto from 'crypto'

export interface User {
  id: number
  username: string
  createdate: Date | null
  expires: Date | null
}

export class AuthService {
  // Verify credentials against CMS database
  async verifyCredentials(username: string, password: string): Promise<User | null> {
    const cmsDb = getCmsDb()

    // Hash password with MD5
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex')

    // Query CMS database
    const [rows] = await cmsDb.query<any[]>(
      'SELECT id, username, createdate, expires FROM cms_module_feusers_users WHERE username = ? AND password = ?',
      [username, hashedPassword]
    )

    if (rows.length === 0) {
      return null
    }

    const user = rows[0]
    return {
      id: user.id,
      username: user.username,
      createdate: user.createdate,
      expires: user.expires
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
