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

/*
 * Replicates the my_htmlentities() function from CMS Made Simple's
 * lib/misc.functions.php (lines 346-376).
 *
 * This encoding is applied to passwords before MD5 hashing in the
 * FrontEndUsers module via the CLEAN_STRING parameter type.
 *
 * IMPORTANT: The order of replacements matters - & must be replaced
 * first before other entities that contain &.
 */
function cmsHtmlEntities(val: string): string {
  if (val === "") {
    return "";
  }

  // Replace &#032; with space (line 352)
  val = val.replace(/&#032;/g, " ");

  // Replace & with &amp; FIRST (line 357)
  // This must happen before other replacements that produce & entities
  val = val.replace(/&/g, "&amp;");

  // Replace <!-- with &#60;&#33;-- (line 358)
  val = val.replace(/<!--/g, "&#60;&#33;--");

  // Replace --> with --&#62; (line 359)
  val = val.replace(/-->/g, "--&#62;");

  // Replace <script (case insensitive) with &#60;script (line 360)
  val = val.replace(/<script/gi, "&#60;script");

  // Replace > with &gt; (line 361)
  val = val.replace(/>/g, "&gt;");

  // Replace < with &lt; (line 362)
  val = val.replace(/</g, "&lt;");

  // Replace " with &quot; (line 365)
  val = val.replace(/"/g, "&quot;");

  // Replace $ with &#036; (line 370)
  val = val.replace(/\$/g, "&#036;");

  // Replace ! with &#33; (line 375)
  val = val.replace(/!/g, "&#33;");

  // Replace ' with &#39; (line 376)
  val = val.replace(/'/g, "&#39;");

  return val;
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

      // Modify the supplied password in the same way that CMS Made Simple FrontEndUsers does
      // in escaping HTML characters.
      const mungedPassword = cmsHtmlEntities(password);
      // Hash password with MD5
      const hashedPassword = crypto.createHash('md5').update(mungedPassword).digest('hex')

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
